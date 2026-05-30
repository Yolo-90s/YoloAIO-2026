// Mirrors the Android GutendexClient. Public Project Gutenberg search
// + metadata. The actual book HTML/text content lives on
// gutenberg.org and has neither CORS nor a friendly User-Agent policy,
// so we fetch that through our own Cloud Function (`bookProxy`).

const GUTENDEX = 'https://gutendex.com';

export const BOOK_TOPICS = [
  { label: 'All',        topic: null },
  { label: 'Fiction',    topic: 'fiction' },
  { label: 'Adventure',  topic: 'adventure' },
  { label: 'Romance',    topic: 'romance' },
  { label: 'Mystery',    topic: 'mystery' },
  { label: 'Children',   topic: 'children' },
  { label: 'Philosophy', topic: 'philosophy' },
  { label: 'History',    topic: 'history' },
  { label: 'Science',    topic: 'science' },
  { label: 'Poetry',     topic: 'poetry' },
];

function httpsify(url) {
  return typeof url === 'string' && url.startsWith('http://')
    ? 'https://' + url.slice(7)
    : url;
}

function pickFormat(formats, ...keys) {
  if (!formats) return '';
  for (const k of keys) {
    const v = formats[k];
    if (v && !v.endsWith('.zip')) return httpsify(v);
  }
  return '';
}

function parseBook(o) {
  const authors = (o.authors || [])
    .map((a) => a?.name)
    .filter(Boolean)
    .join(', ');
  const formats = o.formats || {};
  return {
    id: String(o.id ?? ''),
    title: o.title || 'Untitled',
    authors,
    displayAuthor: authors || 'Unknown author',
    subjects: o.subjects || [],
    languages: o.languages || [],
    downloadCount: o.download_count || 0,
    coverUrl: pickFormat(formats, 'image/jpeg', 'image/png'),
    htmlUrl: pickFormat(
      formats,
      'text/html; charset=utf-8',
      'text/html'
    ),
    textUrl: pickFormat(
      formats,
      'text/plain; charset=utf-8',
      'text/plain; charset=us-ascii',
      'text/plain'
    ),
    epubUrl: pickFormat(formats, 'application/epub+zip'),
  };
}

export async function searchBooks({ query = '', topic = null, languageCode = 'en' } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());
  if (topic) params.set('topic', topic);
  if (languageCode) params.set('languages', languageCode);
  const url = params.toString() ? `${GUTENDEX}/books?${params}` : `${GUTENDEX}/books`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gutendex HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(parseBook);
}

/**
 * Download a Gutenberg-hosted book body via our Cloud Function proxy.
 * The browser can't hit gutenberg.org directly because of CORS, and PG's
 * anti-bot gate also rejects the standard browser UA. Our proxy handles
 * both — see functions/index.js → bookProxy.
 */
export async function fetchBookBody({ url, proxyBase }) {
  if (!url) throw new Error('Empty book URL');
  if (!proxyBase) {
    throw new Error(
      "Books proxy isn't configured. Set `booksApiBaseUrl` in Firestore " +
        "`config/app` to your bookProxy Cloud Function URL."
    );
  }
  const proxied = `${proxyBase.replace(/\/+$/, '')}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Gutenberg fetch failed: HTTP ${res.status}`);
  return res.text();
}

// In-memory cache so the Reader screen can pick up a book by id
// without re-fetching from Gutendex. Same pattern as wallpaperCache.
const cache = new Map();
export const bookCache = {
  set(list) {
    cache.clear();
    list.forEach((b) => cache.set(b.id, b));
  },
  merge(list) {
    list.forEach((b) => cache.set(b.id, b));
  },
  byId(id) {
    return cache.get(id) ?? null;
  },
};
