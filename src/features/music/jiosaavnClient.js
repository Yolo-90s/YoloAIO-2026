// Browser → JioSaavn is blocked by CORS, so we hit our own thin proxy
// (Vercel: `proxy/`, Firebase Functions: `functions/`). The proxy URL is
// read from the Firestore `config/app` doc as `musicApiBaseUrl`. Below
// we add the album/playlist endpoints alongside the original songs one.

function htmlDecode(str) {
  if (!str) return '';
  if (typeof document === 'undefined') return str;
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

function reorderByLanguage(tracks, langCode) {
  if (!langCode) return tracks;
  const lc = langCode.toLowerCase();
  const matched = tracks.filter((t) => (t.language || '').toLowerCase() === lc);
  const others = tracks.filter((t) => (t.language || '').toLowerCase() !== lc);
  return [...matched, ...others];
}

async function getJson(baseUrl, path) {
  if (!baseUrl) throw new MusicProxyMissing();
  const trimmed = baseUrl.replace(/\/$/, '');
  const url = `${trimmed}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${trimmed} · ${body.slice(0, 200)}`);
  }
  return res.json();
}

export class MusicProxyMissing extends Error {
  constructor() {
    super(
      'Music proxy not configured. Deploy `proxy/` to Vercel (`cd proxy && vercel --prod`) and paste the deployment URL into the Firestore `config/app` doc as `musicApiBaseUrl`.'
    );
    this.name = 'MusicProxyMissing';
  }
}

// ── Songs ──────────────────────────────────────────────────────────────────

export async function searchSongs({ baseUrl, query, languageCode, limit = 30, page = 1 }) {
  const effective = (
    query?.trim() ||
    MUSIC_DEFAULT_QUERY_BY_LANG[languageCode] ||
    'top'
  ).slice(0, 200);
  const json = await getJson(
    baseUrl,
    `/search/songs?query=${encodeURIComponent(effective)}&limit=${limit}&page=${page}`
  );
  const raw = json?.results ?? json?.data?.results ?? [];
  const tracks = Array.isArray(raw) ? raw.map(normalizeTrack).filter(Boolean) : [];
  return reorderByLanguage(tracks, languageCode);
}

// ── Albums ─────────────────────────────────────────────────────────────────

export async function searchAlbums({ baseUrl, query, limit = 24, page = 1 }) {
  const effective = (query?.trim() || 'top albums').slice(0, 200);
  const json = await getJson(
    baseUrl,
    `/search/albums?query=${encodeURIComponent(effective)}&limit=${limit}&page=${page}`
  );
  const raw = json?.results ?? [];
  return Array.isArray(raw) ? raw.map(normalizeAlbum).filter(Boolean) : [];
}

export async function fetchAlbum({ baseUrl, id }) {
  const json = await getJson(baseUrl, `/album?id=${encodeURIComponent(id)}`);
  return {
    album: normalizeAlbum(json?.album) ?? null,
    tracks: Array.isArray(json?.tracks) ? json.tracks.map(normalizeTrack).filter(Boolean) : [],
  };
}

// ── Playlists ──────────────────────────────────────────────────────────────

export async function searchPlaylists({ baseUrl, query, limit = 24, page = 1 }) {
  const effective = (query?.trim() || 'trending playlists').slice(0, 200);
  const json = await getJson(
    baseUrl,
    `/search/playlists?query=${encodeURIComponent(effective)}&limit=${limit}&page=${page}`
  );
  const raw = json?.results ?? [];
  return Array.isArray(raw) ? raw.map(normalizePlaylist).filter(Boolean) : [];
}

export async function fetchPlaylist({ baseUrl, id }) {
  const json = await getJson(baseUrl, `/playlist?id=${encodeURIComponent(id)}`);
  return {
    playlist: normalizePlaylist(json?.playlist) ?? null,
    tracks: Array.isArray(json?.tracks) ? json.tracks.map(normalizeTrack).filter(Boolean) : [],
  };
}

// ── Normalizers ────────────────────────────────────────────────────────────
// The proxy returns SaavnTrack-shaped objects directly, but we still run
// every field through these so an alternative proxy (e.g. saavn.dev) with
// slightly different shape works without code changes.

function normalizeTrack(o) {
  if (!o) return null;
  if (typeof o.streamUrl === 'string') {
    return {
      id: String(o.id),
      title: htmlDecode(o.title ?? ''),
      artist: htmlDecode(o.artist ?? ''),
      durationSec: Number(o.durationSec ?? 0),
      artworkUrlSmall: o.artworkUrlSmall ?? null,
      artworkUrlLarge: o.artworkUrlLarge ?? null,
      language: o.language ?? '',
      year: String(o.year ?? ''),
      streamUrl: o.streamUrl,
    };
  }
  return null;
}

function normalizeAlbum(o) {
  if (!o?.id) return null;
  return {
    id: String(o.id),
    title: htmlDecode(o.title ?? ''),
    artist: htmlDecode(o.artist ?? ''),
    artworkUrlSmall: o.artworkUrlSmall ?? null,
    artworkUrlLarge: o.artworkUrlLarge ?? null,
    year: o.year ?? '',
    songCount: Number(o.songCount ?? 0),
    language: o.language ?? '',
  };
}

function normalizePlaylist(o) {
  if (!o?.id) return null;
  return {
    id: String(o.id),
    title: htmlDecode(o.title ?? ''),
    curator: htmlDecode(o.curator ?? ''),
    artworkUrlSmall: o.artworkUrlSmall ?? null,
    artworkUrlLarge: o.artworkUrlLarge ?? null,
    songCount: Number(o.songCount ?? 0),
    language: o.language ?? '',
  };
}

const MUSIC_DEFAULT_QUERY_BY_LANG = {
  telugu: 'top telugu songs',
  hindi: 'top hindi songs',
  tamil: 'top tamil songs',
  kannada: 'top kannada songs',
  malayalam: 'top malayalam songs',
  english: 'top english songs',
  punjabi: 'top punjabi songs',
  marathi: 'top marathi songs',
  bengali: 'top bengali songs',
  bhojpuri: 'top bhojpuri songs',
  gujarati: 'top gujarati songs',
  urdu: 'top urdu songs',
};

export function formatTrackDuration(seconds) {
  const s = Math.floor(seconds || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}
