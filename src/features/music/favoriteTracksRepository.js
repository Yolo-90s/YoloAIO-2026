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

// Mirrors FavoriteTracksRepository.kt — `users/{uid}/favoriteTracks`. Same
// shape as the Android side so favorites travel across platforms.

function uid() {
  return auth?.currentUser?.uid ?? null;
}

function safeId(id) {
  return String(id).replace(/\//g, '_');
}

export function observeFavoriteTracks(onChange) {
  const me = uid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'users', me, 'favoriteTracks'),
    orderBy('addedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

export async function addFavoriteTrack(track) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await setDoc(doc(firestore, 'users', me, 'favoriteTracks', safeId(track.id)), {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    durationSec: track.durationSec,
    artworkUrlSmall: track.artworkUrlSmall ?? null,
    artworkUrlLarge: track.artworkUrlLarge ?? null,
    language: track.language ?? '',
    year: track.year ?? '',
    streamUrl: track.streamUrl,
    addedAt: Date.now(),
  });
}

export async function removeFavoriteTrack(trackId) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await deleteDoc(doc(firestore, 'users', me, 'favoriteTracks', safeId(trackId)));
}

export function favoriteToTrack(f) {
  return {
    id: f.trackId || f.id,
    title: f.title,
    artist: f.artist,
    durationSec: f.durationSec,
    artworkUrlSmall: f.artworkUrlSmall,
    artworkUrlLarge: f.artworkUrlLarge,
    language: f.language ?? '',
    year: f.year ?? '',
    streamUrl: f.streamUrl,
  };
}
