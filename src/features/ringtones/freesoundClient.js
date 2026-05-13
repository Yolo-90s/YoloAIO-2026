// Mirrors FreesoundClient.kt — short clips (≤30s), sorted by rating, with an
// optional category tag filter.

const BASE = 'https://freesound.org/apiv2';

export const CATEGORIES = [
  { key: 'all', label: 'All', tag: null },
  { key: 'ringtone', label: 'Ringtones', tag: 'ringtone' },
  { key: 'notification', label: 'Notifications', tag: 'notification' },
  { key: 'alarm', label: 'Alarms', tag: 'alarm' },
  { key: 'bell', label: 'Bells', tag: 'bell' },
  { key: 'beep', label: 'Beeps', tag: 'beep' },
  { key: 'chime', label: 'Chimes', tag: 'chime' },
  { key: 'sfx', label: 'SFX', tag: 'sound-effect' },
];

export async function searchTones({ query, categoryKey, apiKey, pageSize = 30 }) {
  if (!apiKey) throw new Error('Missing Freesound API key');
  const cat = CATEGORIES.find((c) => c.key === categoryKey) ?? CATEGORIES[0];
  const filterParts = ['duration:[0 TO 30]'];
  if (cat.tag) filterParts.push(`tag:${cat.tag}`);

  const effectiveQuery = (query?.trim() || cat.label).toLowerCase();
  const params = new URLSearchParams({
    query: effectiveQuery,
    filter: filterParts.join(' '),
    fields: 'id,name,username,duration,tags,previews',
    page_size: String(pageSize),
    sort: 'rating_desc',
    token: apiKey,
  });

  const res = await fetch(`${BASE}/search/text/?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.results ?? [])
    .map((o) => {
      const preview =
        o.previews?.['preview-hq-mp3'] || o.previews?.['preview-lq-mp3'] || '';
      if (!preview) return null;
      return {
        id: `freesound-${o.id}`,
        name: o.name || 'Untitled',
        subtitle: o.username ?? '',
        durationSec: o.duration ?? 0,
        streamUrl: preview,
        tags: Array.isArray(o.tags) ? o.tags.filter(Boolean) : [],
        source: 'freesound',
        mimeType: 'audio/mpeg',
        fileExtension: 'mp3',
        artUrl: null,
      };
    })
    .filter(Boolean);
}

export function formatDuration(sec) {
  const s = Math.floor(sec || 0);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
