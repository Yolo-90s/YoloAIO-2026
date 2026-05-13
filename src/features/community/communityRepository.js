import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';
import { AVATAR_PALETTE } from '../../data/userProfile.js';

// Mirrors CommunityChannelRepository.kt — single `communityMessages`
// collection, sender info denormalised so render doesn't need to join
// against /users per message.

const COLLECTION = 'communityMessages';

let cachedSender = null;

async function resolveSender() {
  if (cachedSender) return cachedSender;
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');

  let profile = null;
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (snap.exists()) profile = snap.data();
  } catch {
    // ignore — fall back to auth metadata
  }

  const name =
    user.displayName?.trim() ||
    profile?.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'Anonymous';
  const avatarColor =
    profile?.avatarColor ??
    AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];

  cachedSender = { uid: user.uid, name, avatarColor };
  return cachedSender;
}

export function observeMessages(onChange, max = 200) {
  const q = query(
    collection(firestore, COLLECTION),
    orderBy('timestamp', 'desc'),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs
        .map((d) => {
          const data = d.data();
          const ts = data.timestamp?.toMillis?.();
          if (!ts) return null; // pending server-side writes
          return {
            id: d.id,
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatarColor: data.senderAvatarColor,
            text: data.text,
            timestampMs: ts,
          };
        })
        .filter(Boolean)
        .reverse();
      onChange(messages);
    },
    () => onChange([])
  );
}

export async function sendMessage(text) {
  const clean = text.trim();
  if (!clean) throw new Error("Message can't be empty");
  if (clean.length > 2000) throw new Error('Message is too long (2000 char limit)');
  const sender = await resolveSender();
  await addDoc(collection(firestore, COLLECTION), {
    senderId: sender.uid,
    senderName: sender.name,
    senderAvatarColor: sender.avatarColor,
    text: clean,
    timestamp: serverTimestamp(),
  });
}

export async function deleteMessage(message) {
  const me = auth?.currentUser?.uid;
  if (!me) throw new Error('Not signed in');
  if (message.senderId !== me) throw new Error('You can only delete your own messages');
  await deleteDoc(doc(firestore, COLLECTION, message.id));
}

export function formatCommunityTime(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const sameYear = date.getFullYear() === now.getFullYear();
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (sameDay) return time;
  if (sameYear)
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${time}`;
}
