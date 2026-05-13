// Shared helpers for the proxy serverless functions. Lives outside `api/`
// so Vercel doesn't try to deploy it as its own endpoint.
import CryptoJS from 'crypto-js';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; YoloAIO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const DECRYPT_KEY = CryptoJS.enc.Utf8.parse('38346591');

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

export function htmlDecode(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

// Pure-JS DES-ECB so we don't rely on Node's `crypto` (OpenSSL 3 disables
// DES by default and Vercel doesn't expose a way to flip the legacy
// provider on).
export function decryptStreamUrl(b64) {
  try {
    if (!b64) return null;
    const ciphertext = CryptoJS.enc.Base64.parse(b64);
    const decrypted = CryptoJS.DES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext }),
      DECRYPT_KEY,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const raw = decrypted.toString(CryptoJS.enc.Utf8);
    if (!raw) return null;
    return raw
      .replace(/^http:/, 'https:')
      .replace('https://h.saavncdn.com', 'https://aac.saavncdn.com');
  } catch {
    return null;
  }
}

// One central place to call JioSaavn's api.php endpoint. All endpoints
// hit the same base URL with different `__call` values.
export async function callJioSaavn(extraParams) {
  const params = new URLSearchParams({
    api_version: '4',
    _format: 'json',
    _marker: '0',
    ctx: 'web6dot0',
    ...extraParams,
  });
  const url = `https://www.jiosaavn.com/api.php?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': USER_AGENT,
      Referer: 'https://www.jiosaavn.com/',
      Cookie: 'L=english; gdpr_acceptance=true; DL=english',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`JioSaavn HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  let text = await res.text();
  text = text.trim();
  if (text.startsWith('(') && text.endsWith(')')) {
    text = text.substring(1, text.length - 1).trim();
  }
  return JSON.parse(text);
}

// Replace JioSaavn's smallest CDN size with a larger one — same URL just
// at a higher resolution. Their image URLs always end in `50x50.jpg`.
export function upscaleImage(raw, target = '500x500') {
  if (!raw || raw === 'null') return null;
  return raw
    .replace('50x50.jpg', `${target}.jpg`)
    .replace('150x150.jpg', `${target}.jpg`);
}

// Parses a single track object (from search results, album songs, or
// playlist songs — JioSaavn returns the same shape from each).
export function parseTrack(o) {
  if (!o) return null;
  const type = o.type;
  if (type && type !== 'song') return null;
  const id = o.id;
  const moreInfo = o.more_info;
  if (!id || !moreInfo) return null;
  const streamUrl = decryptStreamUrl(moreInfo.encrypted_media_url);
  if (!streamUrl) return null;

  const rawImage = o.image && o.image !== 'null' ? o.image : null;
  return {
    id: String(id),
    title: htmlDecode(o.title || o.name || 'Untitled'),
    artist: htmlDecode(moreInfo.primary_artists || o.subtitle || 'Unknown'),
    durationSec: parseInt(moreInfo.duration, 10) || 0,
    artworkUrlSmall: upscaleImage(rawImage, '150x150'),
    artworkUrlLarge: upscaleImage(rawImage, '500x500'),
    language: o.language || '',
    year: o.year || '',
    streamUrl,
  };
}

export function parseAlbum(o) {
  if (!o) return null;
  const id = o.id;
  if (!id) return null;
  const rawImage = o.image && o.image !== 'null' ? o.image : null;
  const more = o.more_info ?? {};
  return {
    id: String(id),
    title: htmlDecode(o.title || o.name || 'Untitled album'),
    artist: htmlDecode(more.music || more.primary_artists || o.subtitle || 'Various artists'),
    artworkUrlSmall: upscaleImage(rawImage, '150x150'),
    artworkUrlLarge: upscaleImage(rawImage, '500x500'),
    year: o.year || more.year || '',
    songCount: parseInt(more.song_count, 10) || 0,
    language: o.language || '',
  };
}

export function parsePlaylist(o) {
  if (!o) return null;
  const id = o.id;
  if (!id) return null;
  const rawImage = o.image && o.image !== 'null' ? o.image : null;
  const more = o.more_info ?? {};
  return {
    id: String(id),
    title: htmlDecode(o.title || o.name || 'Untitled playlist'),
    curator: htmlDecode(more.firstname || more.subtitle || o.subtitle || 'JioSaavn'),
    artworkUrlSmall: upscaleImage(rawImage, '150x150'),
    artworkUrlLarge: upscaleImage(rawImage, '500x500'),
    songCount: parseInt(more.song_count, 10) || 0,
    language: o.language || '',
  };
}
