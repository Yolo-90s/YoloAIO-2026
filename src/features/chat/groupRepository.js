import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { auth, firestore, storage } from '../../data/firebase.js';
import { MSG_TEXT, MSG_SYSTEM } from './chatRepository.js';

// Mirrors GroupChatRepository.kt — group-chat counterpart to
// chatRepository.js, kept as a fully separate set of functions rather
// than retrofitting the 1:1 ones (every existing chatRepository
// function is otherUid-shaped and derives a 2-party chatId internally;
// groups have no "other uid," only a chatId — a fresh auto-id — from
// the moment they're created).
//
// Two implementation gotchas, load-bearing enough to repeat here (see
// Yolo-Homes-Android/firestore.rules' chats/{chatId} +
// groupInvites/{inviteId} blocks for the actual rule text):
//  - Group creation is two separate top-level calls, never a batch — a
//    batch's getDoc() calls (used by the invite create rule to check
//    adminUids) see the pre-batch snapshot, so batching would make
//    every invite-create fail against a chat doc that "doesn't exist
//    yet" from the rule's point of view.
//  - Invite accept is two separate sequential writes (invite
//    status -> 'accepted', THEN participants arrayUnion) for the same
//    reason. reconcileAcceptedInvites() covers a crash between the two.

export const INVITE_PENDING = 'pending';
export const INVITE_ACCEPTED = 'accepted';
export const INVITE_DECLINED = 'declined';

function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

function inviteRef(chatId, uid) {
  return doc(firestore, 'groupInvites', `${chatId}_${uid}`);
}

export async function createGroup(name, memberUids) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const trimmedName = name.trim() || 'New Group';

  const ref = doc(collection(firestore, 'chats'));
  await setDoc(ref, {
    isGroup: true,
    groupName: trimmedName,
    groupPhotoUrl: '',
    ownerUid: me,
    adminUids: [me],
    participants: [me],
    lastMessage: '',
    lastTime: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  await inviteMembers(ref.id, trimmedName, memberUids);
  return ref.id;
}

/**
 * Invites (or re-invites) each uid to an existing group. A previously
 * declined/pending invite is deleted then re-created (the invite doc's
 * id is deterministic, so a plain create fails on an existing doc —
 * Firestore rules also classify a write to an existing doc as `update`,
 * not `create`, which the invitee-only update rule would reject from
 * the inviter's uid anyway). Already-accepted invitees are skipped.
 */
export async function inviteMembers(chatId, groupName, memberUids) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const myName = auth.currentUser?.displayName?.trim() || 'Unknown';
  for (const uid of memberUids) {
    if (uid === me) continue;
    const ref = inviteRef(chatId, uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      if (existing.data().status === INVITE_ACCEPTED) continue;
      await deleteDoc(ref);
    }
    await setDoc(ref, {
      chatId,
      groupName,
      invitedUid: uid,
      invitedByUid: me,
      invitedByName: myName,
      status: INVITE_PENDING,
      createdAt: serverTimestamp(),
    });
  }
}

export async function cancelInvite(chatId, uid) {
  await deleteDoc(inviteRef(chatId, uid));
}

export function observeMyGroupChats(onChange) {
  const me = currentUid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(firestore, 'chats'), where('participants', 'array-contains', me));
  return onSnapshot(
    q,
    (snap) => {
      const groups = snap.docs
        .filter((d) => d.data().isGroup === true)
        .map((d) => {
          const data = d.data();
          return {
            chatId: d.id,
            groupName: data.groupName || 'Group',
            groupPhotoUrl: data.groupPhotoUrl || '',
            memberCount: (data.participants || []).length,
            lastMessage: data.lastMessage || '',
            lastTimeMs: data.lastTime?.toMillis?.() ?? 0,
          };
        });
      onChange(groups);
    },
    () => onChange([])
  );
}

export function observeGroup(chatId, onChange) {
  return onSnapshot(
    doc(firestore, 'chats', chatId),
    (snap) => onChange(snap.exists() ? { chatId: snap.id, ...snap.data() } : null),
    () => onChange(null)
  );
}

export function observeGroupMessages(chatId, onChange) {
  const q = query(collection(firestore, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

export async function sendGroupText(chatId, text, replyTo = null) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message is empty');

  const chatRef = doc(firestore, 'chats', chatId);
  await updateDoc(chatRef, { lastMessage: trimmed, lastTime: serverTimestamp() });
  await addDoc(collection(chatRef, 'messages'), {
    senderId: me,
    type: MSG_TEXT,
    text: trimmed,
    replyToId: replyTo?.messageId ?? null,
    replyToSenderId: replyTo?.senderId ?? null,
    replyToText: replyTo?.text ?? null,
    timestamp: serverTimestamp(),
  });
}

export async function sendGroupMedia(chatId, file, type, label = null) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const ext = type === 'gif' ? 'gif' : 'jpg';
  const key = `chats/${chatId}/${crypto.randomUUID()}.${ext}`;
  const ref = storageRef(storage, key);
  await uploadBytes(ref, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(ref);

  const chatRef = doc(firestore, 'chats', chatId);
  const previewLabel = type === 'gif' ? '[GIF]' : '[Photo]';
  await updateDoc(chatRef, { lastMessage: previewLabel, lastTime: serverTimestamp() });
  await addDoc(collection(chatRef, 'messages'), {
    senderId: me,
    type,
    mediaUrl: downloadUrl,
    mediaLabel: label,
    timestamp: serverTimestamp(),
  });
}

async function postSystemMessage(chatId, text) {
  const me = currentUid();
  if (!me) return;
  try {
    await addDoc(collection(firestore, 'chats', chatId, 'messages'), {
      senderId: me,
      type: MSG_SYSTEM,
      text,
      timestamp: serverTimestamp(),
    });
  } catch {
    // best-effort — a failed announcement shouldn't block the underlying action
  }
}

// ── Invites (recipient side) ────────────────────────────────────────────

export function observePendingInvites(onChange) {
  const me = currentUid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'groupInvites'),
    where('invitedUid', '==', me),
    where('status', '==', INVITE_PENDING)
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => ({
          inviteId: d.id,
          chatId: d.data().chatId || '',
          groupName: d.data().groupName || 'Group',
          invitedByName: d.data().invitedByName || 'Someone',
        }))
      );
    },
    () => onChange([])
  );
}

/**
 * Pending invites for this group that *I* sent — scoped to
 * invitedByUid == me so the query is guaranteed to satisfy
 * groupInvites' per-doc read rule. A co-admin's own invites aren't
 * visible here — an accepted simplification, same pragmatic rigor
 * level as the rest of this feature.
 */
export function observeMyInvitesFor(chatId, onChange) {
  const me = currentUid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'groupInvites'),
    where('chatId', '==', chatId),
    where('invitedByUid', '==', me),
    where('status', '==', INVITE_PENDING)
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => ({
          inviteId: d.id,
          chatId: d.data().chatId || '',
          groupName: d.data().groupName || '',
          invitedByName: d.data().invitedByName || '',
          invitedUid: d.data().invitedUid || '',
        }))
      );
    },
    () => onChange([])
  );
}

export async function acceptInvite(invite) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  await updateDoc(doc(firestore, 'groupInvites', invite.inviteId), {
    status: INVITE_ACCEPTED,
    respondedAt: serverTimestamp(),
  });
  await updateDoc(doc(firestore, 'chats', invite.chatId), {
    participants: arrayUnion(me),
  });
  await postSystemMessage(invite.chatId, `${auth.currentUser?.displayName?.trim() || 'Someone'} joined the group`);
}

export async function declineInvite(invite) {
  await updateDoc(doc(firestore, 'groupInvites', invite.inviteId), {
    status: INVITE_DECLINED,
    respondedAt: serverTimestamp(),
  });
}

/**
 * Covers a crash between acceptInvite's two writes: any of my own
 * invites already marked accepted whose chat doc doesn't yet list me
 * as a participant gets the join write retried. Cheap, safe to call on
 * every chat-list load.
 */
export async function reconcileAcceptedInvites() {
  const me = currentUid();
  if (!me) return;
  try {
    const snap = await getDocs(
      query(
        collection(firestore, 'groupInvites'),
        where('invitedUid', '==', me),
        where('status', '==', INVITE_ACCEPTED)
      )
    );
    for (const d of snap.docs) {
      const chatId = d.data().chatId;
      if (!chatId) continue;
      const chatSnap = await getDoc(doc(firestore, 'chats', chatId));
      const participants = chatSnap.data()?.participants || [];
      if (!participants.includes(me)) {
        await updateDoc(doc(firestore, 'chats', chatId), { participants: arrayUnion(me) });
      }
    }
  } catch {
    // best-effort reconciliation, never block chat-list load on it
  }
}

// ── Admin toolkit ────────────────────────────────────────────────────────

export async function renameGroup(chatId, newName) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Name is empty');
  await updateDoc(doc(firestore, 'chats', chatId), { groupName: trimmed });
  await postSystemMessage(chatId, `Group renamed to "${trimmed}"`);
}

export async function setGroupPhoto(chatId, file) {
  const key = `chats/${chatId}/group_photo_${crypto.randomUUID()}.jpg`;
  const ref = storageRef(storage, key);
  await uploadBytes(ref, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(ref);
  await updateDoc(doc(firestore, 'chats', chatId), { groupPhotoUrl: downloadUrl });
}

export async function removeMember(chatId, memberUid, memberName) {
  await updateDoc(doc(firestore, 'chats', chatId), { participants: arrayRemove(memberUid) });
  await postSystemMessage(chatId, `${memberName} was removed from the group`);
}

export async function leaveGroup(chatId) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const myName = auth.currentUser?.displayName?.trim() || 'Someone';
  // Post BEFORE removing myself — the message create rule requires being
  // a current participant, which is no longer true right after the
  // arrayRemove below lands.
  await postSystemMessage(chatId, `${myName} left the group`);
  await updateDoc(doc(firestore, 'chats', chatId), { participants: arrayRemove(me) });
}
