// /api/search/songs?query=X&limit=N — songs from JioSaavn search.
import { applyCors, callJioSaavn, parseTrack } from '../../lib/jiosaavn.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const query = String(req.query.query || 'top').slice(0, 200);
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);
    const debug = String(req.query.debug || '') === '1';

    const data = await callJioSaavn({
      __call: 'search.getResults',
      q: query,
      n: String(limit),
      p: '1',
    });

    const raw = Array.isArray(data?.results) ? data.results : [];
    const stats = { raw: raw.length, kept: 0, dropped: 0 };
    const results = [];
    for (const o of raw) {
      const t = parseTrack(o);
      if (t) { results.push(t); stats.kept++; } else { stats.dropped++; }
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    if (debug) { res.status(200).json({ results, stats, sampleRaw: raw[0] ?? null }); return; }
    res.status(200).json({ results, stats });
  } catch (e) {
    console.error('songs error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
