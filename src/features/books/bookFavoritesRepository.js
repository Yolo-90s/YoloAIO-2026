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

// Mirrors the Android BookFavoritesRepository — collection
// `users/{uid}/favoriteBooks`, doc id == Gutendex numeric book id.

function uid() {
  return auth?.currentUser?.uid ?? null;
}

function bookDoc(bookId) {
  const me = uid();
  if (!me || !bookId) return null;
  return doc(firestore, 'users', me, 'favoriteBooks', String(bookId));
}

export function observeFavoriteBooks(onChange) {
  const me = uid();
  if (!firebaseReady || !me) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'users', me, 'favoriteBooks'),
    orderBy('addedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([])
  );
}

export async function isFavoriteBook(bookId) {
  const ref = bookDoc(bookId);
  if (!ref) return false;
  try {
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

export async function addFavoriteBook(book) {
  const ref = bookDoc(book.id);
  if (!ref) throw new Error('Not signed in');
  await setDoc(ref, {
    bookId: String(book.id),
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    textUrl: book.textUrl,
    htmlUrl: book.htmlUrl,
    epubUrl: book.epubUrl,
    downloadCount: book.downloadCount || 0,
    addedAt: Date.now(),
  });
}

export async function removeFavoriteBook(bookId) {
  const ref = bookDoc(bookId);
  if (!ref) throw new Error('Not signed in');
  await deleteDoc(ref);
}

/** Reverse the favourite snapshot back into the Book shape used by the
 *  reader and grid components. */
export function favoriteToBook(fav) {
  return {
    id: fav.bookId || fav.id,
    title: fav.title,
    authors: fav.authors,
    displayAuthor: fav.authors || 'Unknown author',
    subjects: [],
    languages: [],
    downloadCount: fav.downloadCount || 0,
    coverUrl: fav.coverUrl || '',
    textUrl: fav.textUrl || '',
    htmlUrl: fav.htmlUrl || '',
    epubUrl: fav.epubUrl || '',
  };
}
