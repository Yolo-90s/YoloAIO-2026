// Thin client for the videos-proxy Vercel deployment. Mirrors the shape
// of `jiosaavnClient.js` — feature screens import { listVideos, ... }
// instead of poking fetch() directly.

function trimTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}

function ensureConfigured(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error(
      "Videos proxy isn't configured. In Firestore `config/app`, set `videosApiBaseUrl` to your deployed proxy (see videos-proxy/README.md)."
    );
  }
}

export async function listVideos(baseUrl, { signal } = {}) {
  ensureConfigured(baseUrl);
  const url = `${trimTrailingSlash(baseUrl)}/list`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Videos proxy ${res.status} · ${body.slice(0, 200) || 'no body'}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.videos) ? data.videos : [];
  return list.map(normalizeVideo).filter(Boolean);
}

export function streamUrlFor(baseUrl, videoId) {
  ensureConfigured(baseUrl);
  return `${trimTrailingSlash(baseUrl)}/stream/${encodeURIComponent(videoId)}`;
}

// Defensive normalizer so a slightly-different proxy shape doesn't crash
// the UI. Anything missing falls back to a safe default.
function normalizeVideo(v) {
  if (!v || typeof v !== 'object') return null;
  const id = String(v.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(v.name ?? 'Untitled video'),
    mimeType: String(v.mimeType ?? 'video/mp4'),
    sizeBytes: Number.isFinite(v.sizeBytes) ? v.sizeBytes : 0,
    durationMs: Number.isFinite(v.durationMs) ? v.durationMs : 0,
    width: Number.isFinite(v.width) ? v.width : 0,
    height: Number.isFinite(v.height) ? v.height : 0,
    thumbnailUrl: v.thumbnailUrl || null,
    modifiedAt: v.modifiedAt || null,
  };
}

// Pretty helpers — used by the list view tile and editor header.
export function formatVideoDuration(ms) {
  if (!ms || !isFinite(ms) || ms <= 0) return '';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatFileSize(bytes) {
  if (!bytes || !isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
