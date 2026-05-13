import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';

// Mirrors WallpaperFavoritesRepository.kt — same `favoriteWallpapers`
// subcollection under each user so the Android app and Web app share the
// same saved set.

function uid() {
  return auth?.currentUser?.uid ?? null;
}

function favPath(userId) {
  return collection(firestore, 'users', userId, 'favoriteWallpapers');
}

export function observeFavorites(onChange) {
  const me = uid();
  if (!me) {
    onChange([]);
    return () => {};
  }
  const q = query(favPath(me), orderBy('addedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    () => onChange([])
  );
}

export async function isFavorited(photoId) {
  const me = uid();
  if (!me) return false;
  try {
    const snap = await getDoc(doc(firestore, 'users', me, 'favoriteWallpapers', photoId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function addFavorite(photo) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await setDoc(doc(firestore, 'users', me, 'favoriteWallpapers', photo.id), {
    photoId: photo.id,
    smallUrl: photo.smallUrl,
    regularUrl: photo.regularUrl,
    fullUrl: photo.fullUrl,
    authorName: photo.authorName,
    description: photo.description,
    width: photo.width,
    height: photo.height,
    addedAt: Date.now(),
  });
}

export async function removeFavorite(photoId) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  await deleteDoc(doc(firestore, 'users', me, 'favoriteWallpapers', photoId));
}

// Convert a Firestore favorite back into an UnsplashPhoto shape for the
// detail screen / grid components.
export function favoriteToPhoto(fav) {
  return {
    id: fav.photoId || fav.id,
    description: fav.description ?? '',
    authorName: fav.authorName ?? 'Unsplash',
    smallUrl: fav.smallUrl ?? '',
    regularUrl: fav.regularUrl ?? '',
    fullUrl: fav.fullUrl ?? '',
    width: fav.width ?? 0,
    height: fav.height ?? 0,
  };
}
