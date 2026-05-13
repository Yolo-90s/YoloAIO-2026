// /api/search/albums?query=X&limit=N — albums from JioSaavn search.
import { applyCors, callJioSaavn, parseAlbum } from '../../lib/jiosaavn.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const query = String(req.query.query || 'top albums').slice(0, 200);
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 40);

    const data = await callJioSaavn({
      __call: 'search.getAlbumResults',
      q: query,
      n: String(limit),
      p: '1',
    });

    const raw = Array.isArray(data?.results) ? data.results : [];
    const results = raw.map(parseAlbum).filter(Boolean);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.status(200).json({ results });
  } catch (e) {
    console.error('albums error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
