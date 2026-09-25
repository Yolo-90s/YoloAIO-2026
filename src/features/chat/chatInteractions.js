import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';
import { readReceiptsEnabled } from '../settings/privacyPrefs.js';

// Mirrors ChatInteractions.kt — the handful of chat operations that are
// schema-identical for 1:1 and group chats (they only ever need a
// `chatId`, never an `otherUid`), so they're defined once here and
// called from both chatRepository.js (1:1 screens) and
// groupRepository.js (group screens) call sites.

function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

/**
 * Bumps my own read cursor on this chat. Gated on the "Read receipts"
 * privacy toggle — if off, we never write our own key, so others never
 * see we've read (mutual-disable: see the reciprocal gate on the
 * reading side, in whichever screen renders seen ticks).
 */
export async function markChatRead(chatId) {
  const me = currentUid();
  if (!me) return;
  if (!readReceiptsEnabled()) return;
  await updateDoc(doc(firestore, 'chats', chatId), {
    [`lastRead.${me}`]: serverTimestamp(),
  });
}

/** Sets (or replaces) my own reaction on a message. */
export async function setReaction(chatId, messageId, emoji) {
  const me = currentUid();
  if (!me) return;
  await updateDoc(doc(firestore, 'chats', chatId, 'messages', messageId), {
    [`reactions.${me}`]: emoji,
  });
}

/** Removes my own reaction from a message (tapping the same emoji again). */
export async function clearReaction(chatId, messageId) {
  const me = currentUid();
  if (!me) return;
  await updateDoc(doc(firestore, 'chats', chatId, 'messages', messageId), {
    [`reactions.${me}`]: deleteField(),
  });
}

/** Same emoji tapped again clears it, otherwise sets it. */
export async function toggleReaction(chatId, messageId, emoji, myCurrentReaction) {
  if (myCurrentReaction === emoji) return clearReaction(chatId, messageId);
  return setReaction(chatId, messageId, emoji);
}
