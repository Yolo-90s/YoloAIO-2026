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
import { auth, firestore, firebaseReady } from '../../data/firebase.js';

// Per-user collection at `users/{uid}/favoriteHairstyles`. Doc id is the
// hairstyle id from hairstyleData.js so we get idempotent saves and a
// trivial isFavorite() check.

function uid() {
  return auth?.currentUser?.uid ?? null;
}

function favDoc(hairstyleId) {
  const me = uid();
  if (!me || !hairstyleId) return null;
  return doc(firestore, 'users', me, 'favoriteHairstyles', String(hairstyleId));
}

export function observeFavoriteHairstyles(onChange) {
  const me = uid();
  if (!firebaseReady || !me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'users', me, 'favoriteHairstyles'),
    orderBy('addedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

export async function isFavoriteHairstyle(hairstyleId) {
  const ref = favDoc(hairstyleId);
  if (!ref) return false;
  try {
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

export async function addFavoriteHairstyle(hairstyle, context = {}) {
  const ref = favDoc(hairstyle.id);
  if (!ref) throw new Error('Not signed in');
  await setDoc(ref, {
    hairstyleId: hairstyle.id,
    name: hairstyle.name,
    gender: hairstyle.gender,
    length: hairstyle.length,
    difficulty: hairstyle.difficulty,
    maintenance: hairstyle.maintenance,
    // Snapshot of the analysis context so the favorites list can show
    // "saved when your face shape read as Oval" later.
    faceShape: context.faceShape || null,
    score: context.score || null,
    addedAt: Date.now(),
  });
}

export async function removeFavoriteHairstyle(hairstyleId) {
  const ref = favDoc(hairstyleId);
  if (!ref) throw new Error('Not signed in');
  await deleteDoc(ref);
}
