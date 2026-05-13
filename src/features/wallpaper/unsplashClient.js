// Mirrors UnsplashClient.kt. Returns the same UnsplashPhoto shape so the
// favorites repository can round-trip a photo without a translation layer.

const BASE = 'https://api.unsplash.com';

export const ORIENTATIONS = [
  { key: 'any', label: 'Any', api: null },
  { key: 'portrait', label: 'Portrait', api: 'portrait' },
  { key: 'landscape', label: 'Landscape', api: 'landscape' },
  { key: 'squarish', label: 'Square', api: 'squarish' },
];

export const RESOLUTIONS = [
  { key: 'any', label: 'Any res' },
  { key: '2k', label: '2K+' },
  { key: '4k', label: '4K+' },
];

export function resolutionAccepts(filter, photo) {
  if (filter === 'any') return true;
  const max = Math.max(photo.width ?? 0, photo.height ?? 0);
  if (filter === '2k') return max >= 2048;
  if (filter === '4k') return max >= 3840;
  return true;
}

export async function searchPhotos({ query, accessKey, perPage = 30, orientation = 'portrait' }) {
  if (!accessKey) throw new Error('Missing Unsplash access key');
  const q = encodeURIComponent(query?.trim() || 'nature');
  const orientationParam = orientation && orientation !== 'any' ? `&orientation=${orientation}` : '';
  const url = `${BASE}/search/photos?query=${q}&per_page=${perPage}${orientationParam}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Unsplash error: HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.results ?? []).map((o) => ({
    id: o.id,
    description: o.alt_description || o.description || '',
    authorName: o.user?.name || 'Unsplash',
    smallUrl: o.urls?.small ?? '',
    regularUrl: o.urls?.regular ?? '',
    fullUrl: o.urls?.full ?? '',
    width: o.width ?? 0,
    height: o.height ?? 0,
  }));
}

export function photoAspectRatio(photo) {
  if (!photo?.height) return 1;
  return photo.width / photo.height;
}

// In-memory cache so the Detail screen can pick up a photo previously
// shown in the grid without re-fetching. Mirrors WallpaperCache.kt.
const cache = new Map();
export const wallpaperCache = {
  set(list) {
    cache.clear();
    list.forEach((p) => cache.set(p.id, p));
  },
  merge(list) {
    list.forEach((p) => cache.set(p.id, p));
  },
  byId(id) {
    return cache.get(id) ?? null;
  },
};
