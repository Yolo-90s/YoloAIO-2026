import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { auth, firestore, storage } from '../../data/firebase.js';

// Mirrors ChatRepository.kt + ChatModels.kt — same collection layout
// (`chats/{chatId}`, `chats/{chatId}/messages/{messageId}`) so Web and
// Android read each other's chats with no translation layer.

export const MSG_TEXT = 'text';
export const MSG_IMAGE = 'image';
export const MSG_GIF = 'gif';

export function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

// ── Listeners ──────────────────────────────────────────────────────────────

function observeOtherUsers(onChange) {
  const me = currentUid();
  return onSnapshot(
    collection(firestore, 'users'),
    (snap) => {
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => u?.uid && u.uid !== me)
        .sort((a, b) => (a.displayName || '').toLowerCase().localeCompare((b.displayName || '').toLowerCase()));
      onChange(users);
    },
    () => onChange([])
  );
}

function observeMyChats(onChange) {
  const me = currentUid();
  if (!me) {
    onChange({});
    return () => {};
  }
  const q = query(collection(firestore, 'chats'), where('participants', 'array-contains', me));
  return onSnapshot(
    q,
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const other = (data.participants || []).find((p) => p !== me);
        if (other) map[other] = data;
      });
      onChange(map);
    },
    () => onChange({})
  );
}

// Combines the two listeners — emits a sorted ChatPreview[] whenever either
// side updates. Returns an unsubscribe that tears both inner listeners down.
export function observeChatPreviews(onChange) {
  let users = [];
  let chats = {};
  let ready = { users: false, chats: false };

  const emit = () => {
    if (!ready.users || !ready.chats) return;
    const previews = users
      .map((user) => {
        const chat = chats[user.uid];
        const lastTimeMs = chat?.lastTime?.toMillis?.() ?? 0;
        return {
          user,
          lastMessage: chat?.lastMessage ?? '',
          lastTimeMs,
        };
      })
      .sort((a, b) => {
        if (b.lastTimeMs !== a.lastTimeMs) return b.lastTimeMs - a.lastTimeMs;
        return (a.user.displayName || '').toLowerCase().localeCompare((b.user.displayName || '').toLowerCase());
      });
    onChange(previews);
  };

  const offUsers = observeOtherUsers((u) => {
    users = u;
    ready.users = true;
    emit();
  });
  const offChats = observeMyChats((c) => {
    chats = c;
    ready.chats = true;
    emit();
  });

  return () => {
    offUsers();
    offChats();
  };
}

export function observeMessages(otherUid, onChange) {
  const me = currentUid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const cid = chatIdFor(me, otherUid);
  const q = query(
    collection(firestore, 'chats', cid, 'messages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(messages);
    },
    () => onChange([])
  );
}

export async function fetchUser(uid) {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function sendText(otherUid, text) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message is empty');

  const cid = chatIdFor(me, otherUid);
  const chatRef = doc(firestore, 'chats', cid);

  await setDoc(
    chatRef,
    {
      participants: [me, otherUid].sort(),
      lastMessage: trimmed,
      lastTime: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(collection(chatRef, 'messages'), {
    senderId: me,
    type: MSG_TEXT,
    text: trimmed,
    timestamp: serverTimestamp(),
  });
}

export async function sendMedia(otherUid, file, type, label = null) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  if (type !== MSG_IMAGE && type !== MSG_GIF) {
    throw new Error(`Unsupported media type: ${type}`);
  }

  const cid = chatIdFor(me, otherUid);
  const ext = type === MSG_GIF ? 'gif' : 'jpg';
  const key = `chats/${cid}/${crypto.randomUUID()}.${ext}`;
  const ref = storageRef(storage, key);

  await uploadBytes(ref, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(ref);

  const chatRef = doc(firestore, 'chats', cid);
  const previewLabel = type === MSG_GIF ? '[GIF]' : '[Photo]';

  await setDoc(
    chatRef,
    {
      participants: [me, otherUid].sort(),
      lastMessage: previewLabel,
      lastTime: serverTimestamp(),
    },
    { merge: true }
  );

  await addDoc(collection(chatRef, 'messages'), {
    senderId: me,
    type,
    mediaUrl: downloadUrl,
    mediaLabel: label,
    timestamp: serverTimestamp(),
  });
}

// Page through messages 100 at a time, batch-delete each page, then drop
// the chat doc itself. Mirrors deleteChat() in ChatRepository.kt — Storage
// media is left behind, same as the Android side.
export async function deleteChat(otherUid) {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const cid = chatIdFor(me, otherUid);
  const chatRef = doc(firestore, 'chats', cid);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await getDocs(query(collection(chatRef, 'messages'), limit(100)));
    if (page.empty) break;
    const batch = writeBatch(firestore);
    page.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (page.size < 100) break;
  }

  await deleteDoc(chatRef);
}

// ── Helpers (shared with the UI layer) ────────────────────────────────────

// 8 distinct gradients — same set the Android avatars use. Hashing the uid
// gives every user a deterministic identity pair so the visual layout is
// stable across reloads.
export const AVATAR_GRADIENTS = [
  ['#7C9CFF', '#1A237E'],
  ['#E0AAFF', '#6A1B9A'],
  ['#FF7AB6', '#AD1457'],
  ['#FFC36B', '#E65100'],
  ['#00BFA5', '#1B5E20'],
  ['#A8C7FF', '#1565C0'],
  ['#B85AC1', '#311B92'],
  ['#42E6B4', '#00838F'],
];

export function gradientForUser(uid) {
  // Java-compatible string hash so future cross-platform comparisons line up
  // if we ever need them. Result is forced positive via Math.abs.
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

export function formatPreviewTime(epochMs) {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const sameYear = date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (sameYear) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMessageTime(epochMs) {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
