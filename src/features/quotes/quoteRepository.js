import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';
import {
  VISIBILITY_PRIVATE,
  VISIBILITY_PUBLIC,
  defaultStyle,
} from './quoteModel.js';

// Mirrors QuoteRepository.kt — two storage paths:
//   • users/{uid}/customQuotes   private (owner only)
//   • publicQuotes               public (any signed-in user reads)

function uid() {
  return auth?.currentUser?.uid ?? null;
}

function privateCol(userId) {
  return collection(firestore, 'users', userId, 'customQuotes');
}

function publicCol() {
  return collection(firestore, 'publicQuotes');
}

function docToQuote(d, fallbackVisibility) {
  const data = d.data();
  const merged = {
    ...defaultStyle(),
    ...data,
  };
  return {
    id: d.id,
    text: data.text ?? '',
    author: data.author ?? '',
    isCustom: true,
    createdAt: data.createdAt ?? 0,
    visibility: data.visibility ?? fallbackVisibility,
    ownerUid: data.ownerUid ?? '',
    ownerName: data.ownerName ?? '',
    style: {
      textColor: data.textColor ?? merged.textColor,
      fontSize: data.fontSize ?? merged.fontSize,
      bold: data.bold ?? merged.bold,
      italic: data.italic ?? merged.italic,
      alignment: data.alignment ?? merged.alignment,
      backgroundType: data.backgroundType ?? merged.backgroundType,
      backgroundColors: data.backgroundColors ?? merged.backgroundColors,
      backgroundImageUrl: data.backgroundImageUrl ?? null,
    },
  };
}

// Streams the current user's quotes (private + their own public). Returns
// an unsubscribe that tears both inner listeners down.
export function observeMyQuotes(onChange) {
  const me = uid();
  if (!me) {
    onChange([]);
    return () => {};
  }

  let priv = [];
  let pub = [];
  const emit = () =>
    onChange([...priv, ...pub].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));

  const offPriv = onSnapshot(
    query(privateCol(me), orderBy('createdAt', 'desc')),
    (snap) => {
      priv = snap.docs.map((d) => ({
        ...docToQuote(d, VISIBILITY_PRIVATE),
        visibility: VISIBILITY_PRIVATE,
        ownerUid: me,
      }));
      emit();
    },
    () => {
      priv = [];
      emit();
    }
  );

  const offPub = onSnapshot(
    query(publicCol(), where('ownerUid', '==', me), orderBy('createdAt', 'desc')),
    (snap) => {
      pub = snap.docs.map((d) => docToQuote(d, VISIBILITY_PUBLIC));
      emit();
    },
    () => {
      pub = [];
      emit();
    }
  );

  return () => {
    offPriv();
    offPub();
  };
}

// Public quotes from other users — used by the Quotes screen's "Community"
// tab. Excludes the current user's own quotes so they don't show twice.
export function observeCommunityQuotes(onChange) {
  const me = uid();
  return onSnapshot(
    query(publicCol(), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => {
      const quotes = snap.docs
        .map((d) => docToQuote(d, VISIBILITY_PUBLIC))
        .filter((q) => q.ownerUid !== me);
      onChange(quotes);
    },
    () => onChange([])
  );
}

export async function saveQuote({ text, author, style, visibility = VISIBILITY_PRIVATE }) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');
  const cleanText = text.trim();
  if (!cleanText) throw new Error("Quote can't be empty");
  if (visibility !== VISIBILITY_PRIVATE && visibility !== VISIBILITY_PUBLIC) {
    throw new Error(`Invalid visibility: ${visibility}`);
  }
  const ownerName =
    user.displayName?.trim() || user.email?.split('@')[0] || 'Anonymous';

  const payload = {
    text: cleanText,
    author: author?.trim() ?? '',
    textColor: style.textColor,
    fontSize: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    alignment: style.alignment,
    backgroundType: style.backgroundType,
    backgroundColors: style.backgroundColors,
    backgroundImageUrl: style.backgroundImageUrl ?? null,
    createdAt: Date.now(),
    visibility,
  };

  if (visibility === VISIBILITY_PUBLIC) {
    payload.ownerUid = user.uid;
    payload.ownerName = ownerName;
    await addDoc(publicCol(), payload);
  } else {
    await addDoc(privateCol(user.uid), payload);
  }
}

export async function deleteQuote(quote) {
  const me = uid();
  if (!me) throw new Error('Not signed in');
  if (quote.visibility === VISIBILITY_PUBLIC) {
    if (quote.ownerUid !== me) throw new Error('You can only delete your own quotes');
    await deleteDoc(doc(firestore, 'publicQuotes', quote.id));
  } else {
    await deleteDoc(doc(firestore, 'users', me, 'customQuotes', quote.id));
  }
}
