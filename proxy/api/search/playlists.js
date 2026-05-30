// /api/search/playlists?query=X&limit=N — playlists from JioSaavn search.
import { applyCors, callJioSaavn, parsePlaylist } from '../../lib/jiosaavn.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const query = String(req.query.query || 'trending playlists').slice(0, 200);
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 40);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const data = await callJioSaavn({
      __call: 'search.getPlaylistResults',
      q: query,
      n: String(limit),
      p: String(page),
    });

    const raw = Array.isArray(data?.results) ? data.results : [];
    const results = raw.map(parsePlaylist).filter(Boolean);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200).json({ results });
  } catch (e) {
    console.error('playlists error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
