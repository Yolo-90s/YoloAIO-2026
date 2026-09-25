import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { auth, firestore, firebaseReady } from '../../data/firebase.js';

// Mirror of ChatNotifications.kt — Option A: while the tab is open we
// listen to the user's chats + messages and post a browser Notification
// for new messages from other users. Doesn't survive tab close; full FCM
// web push would layer on top of this without changing the listener wiring.
//
// Generalized for group chats: every identity/suppression/dedup concept
// that used to be "the other participant's uid" is now a chatId-keyed
// `notificationKey` (== the partner uid for a 1:1 chat, == the chatId for
// a group) — a 1:1 chat's key happens to equal its partner uid, so
// behavior there is unchanged; only group chats exercise the new path.

const STORAGE_KEY = 'yolo_notifications_enabled';

let chatsUnsub = null;
const messageUnsubs = new Map(); // chatId -> unsubscribe
const displayNameCache = new Map();
let activeChatKey = null;
let processStartMs = 0;
const listenerAttachTime = new Map();

export function setActiveChatPartnerUid(key) {
  activeChatKey = key || null;
}

export function isNotificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationsEnabledPref() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function setNotificationsEnabledPref(enabled) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

// Returns the resulting permission state ('granted' / 'denied' / 'default').
// Should be called from a user gesture handler — browsers reject otherwise.
export async function requestNotificationPermission() {
  if (!isNotificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function startChatNotifications() {
  if (!firebaseReady) return;
  if (chatsUnsub) return; // already started
  const me = auth?.currentUser?.uid;
  if (!me) return;
  if (!isNotificationsSupported() || Notification.permission !== 'granted') return;

  processStartMs = Date.now();
  const q = query(
    collection(firestore, 'chats'),
    where('participants', 'array-contains', me)
  );
  chatsUnsub = onSnapshot(
    q,
    (snap) => {
      const seenChatIds = new Set();
      snap.docs.forEach((d) => {
        seenChatIds.add(d.id);
        if (messageUnsubs.has(d.id)) return;
        const data = d.data();
        if (data.isGroup) {
          attachMessagesListener(d.id, me, { isGroup: true, groupName: data.groupName || 'Group' });
        } else {
          const partnerUid = (data.participants || []).find((p) => p !== me);
          if (!partnerUid) return;
          attachMessagesListener(d.id, me, { isGroup: false, partnerUid });
        }
      });
      // Drop listeners for chats we're no longer a part of.
      Array.from(messageUnsubs.keys()).forEach((id) => {
        if (!seenChatIds.has(id)) {
          messageUnsubs.get(id)?.();
          messageUnsubs.delete(id);
          listenerAttachTime.delete(id);
        }
      });
    },
    () => {}
  );
}

export function stopChatNotifications() {
  chatsUnsub?.();
  chatsUnsub = null;
  messageUnsubs.forEach((u) => u());
  messageUnsubs.clear();
  listenerAttachTime.clear();
  activeChatKey = null;
}

function attachMessagesListener(chatId, me, meta) {
  const notificationKey = meta.isGroup ? chatId : meta.partnerUid;
  const attachedAtMs = Date.now();
  listenerAttachTime.set(chatId, attachedAtMs);
  const q = query(
    collection(firestore, 'chats', chatId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  const off = onSnapshot(
    q,
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const ts = data.timestamp?.toMillis?.() ?? 0;
        // Skip backfill — only notify on messages newer than the listener
        // and the page load. System messages (group join/leave/rename
        // announcements) never trigger a notification.
        if (ts <= attachedAtMs || ts <= processStartMs) return;
        if (data.senderId === me) return;
        if (data.type === 'system') return;
        // Suppress when the user is already viewing this chat.
        if (activeChatKey === notificationKey) return;
        postFor(chatId, notificationKey, meta, data);
      });
    },
    () => {}
  );
  messageUnsubs.set(chatId, off);
}

async function resolveDisplayName(uid) {
  if (!uid) return 'Someone';
  if (displayNameCache.has(uid)) return displayNameCache.get(uid);
  let name = 'Someone';
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    const n = snap.exists() ? snap.data().displayName : '';
    if (n && n.trim()) name = n.trim();
  } catch {
    // fall through
  }
  displayNameCache.set(uid, name);
  return name;
}

function previewFor(msg) {
  if (msg.type === 'image') return '📷 Photo';
  if (msg.type === 'gif') return '🎞️ GIF';
  return msg.text || msg.mediaLabel || 'New message';
}

async function postFor(chatId, notificationKey, meta, msg) {
  if (!isNotificationsSupported() || Notification.permission !== 'granted') return;
  const preview = previewFor(msg);
  let title;
  let body;
  if (meta.isGroup) {
    const senderName = await resolveDisplayName(msg.senderId);
    title = meta.groupName;
    body = `${senderName}: ${preview}`;
  } else {
    title = await resolveDisplayName(meta.partnerUid);
    body = preview;
  }
  try {
    const n = new Notification(title, {
      body,
      tag: `chat:${notificationKey}`, // replaces older notifications from the same conversation
      icon: '/icon-192.png',
    });
    n.onclick = () => {
      window.focus();
      window.location.hash = '';
      const path = meta.isGroup ? `/group/${encodeURIComponent(chatId)}` : `/chat/${encodeURIComponent(notificationKey)}`;
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      n.close();
    };
  } catch {
    // Notification API can throw on incognito / locked-down browsers; ignore.
  }
}
