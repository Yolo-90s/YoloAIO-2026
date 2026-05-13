import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';

// Mirrors RingtoneFavoritesRepository.kt + RingtoneFavorite.kt — same
// `users/{uid}/favoriteRingtones` subcollection so the Android and web
// favorites stay in sync.

function uid() {
  return auth?.currentUser?.uid ?? null;
}

// Firestore doc ids can't contain "/" — sanitize to match Android.
function safeId(id) {
  return id.replace(/\//g, '_');
}

export function observeFavorites(onChange) {
  const me = uid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'users', me, 'favoriteRingtones'),
    orderBy('addedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

export async function addFavorite(tone) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await setDoc(doc(firestore, 'users', me, 'favoriteRingtones', safeId(tone.id)), {
    toneId: tone.id,
    name: tone.name,
    subtitle: tone.subtitle,
    durationSec: tone.durationSec,
    tags: tone.tags,
    streamUrl: tone.streamUrl,
    source: tone.source,
    mimeType: tone.mimeType,
    fileExtension: tone.fileExtension,
    artUrl: tone.artUrl ?? null,
    addedAt: Date.now(),
  });
}

export async function removeFavorite(toneId) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await deleteDoc(doc(firestore, 'users', me, 'favoriteRingtones', safeId(toneId)));
}

export function favoriteToTone(fav) {
  return {
    id: fav.toneId || fav.id,
    name: fav.name,
    subtitle: fav.subtitle,
    durationSec: fav.durationSec,
    tags: fav.tags ?? [],
    streamUrl: fav.streamUrl,
    source: fav.source ?? 'freesound',
    mimeType: fav.mimeType ?? 'audio/mpeg',
    fileExtension: fav.fileExtension ?? 'mp3',
    artUrl: fav.artUrl ?? null,
  };
}
