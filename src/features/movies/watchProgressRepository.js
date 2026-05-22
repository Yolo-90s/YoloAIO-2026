import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore, firebaseReady } from '../../data/firebase.js';

// Mirrors WatchProgressRepository.kt — saves resume positions per tmdbId
// under users/{uid}/watchHistory/{tmdbId}. Web and Android share the same
// document layout so progress is portable between platforms.

function docRef(tmdbId) {
  const uid = auth?.currentUser?.uid;
  if (!uid || !tmdbId) return null;
  return doc(firestore, 'users', uid, 'watchHistory', String(tmdbId));
}

export async function saveWatchPosition({ tmdbId, mediaType, currentTime, duration }) {
  if (!firebaseReady) return;
  const ref = docRef(tmdbId);
  if (!ref) return;
  const safeCurrent = Number(currentTime) || 0;
  const safeDuration = Number(duration) || 0;
  const progress = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;
  try {
    await setDoc(ref, {
      tmdbId: String(tmdbId),
      mediaType: mediaType || 'movie',
      currentTime: safeCurrent,
      duration: safeDuration,
      progress,
      updatedAt: Date.now(),
    });
  } catch {
    // Best-effort — losing a write is better than blocking playback.
  }
}

export async function getWatchProgress(tmdbId) {
  if (!firebaseReady) return null;
  const ref = docRef(tmdbId);
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// Parses vidking's iframe postMessage payload. Returns null for messages
// from other origins or with shapes we don't recognise.
export function parsePlayerEvent(raw) {
  let obj = null;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!obj || obj.type !== 'PLAYER_EVENT' || !obj.data) return null;
  const data = obj.data;
  return {
    name: data.event,
    currentTime: Number(data.currentTime) || 0,
    duration: Number(data.duration) || 0,
    progress: Number(data.progress) || 0,
    tmdbId: String(data.id ?? ''),
    mediaType: data.mediaType || 'movie',
  };
}
