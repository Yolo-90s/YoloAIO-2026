// /api/playlist?id=X — playlist metadata + its songs.
import { applyCors, callJioSaavn, parseTrack, parsePlaylist, htmlDecode, upscaleImage } from '../lib/jiosaavn.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const id = String(req.query.id || '').trim();
    if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

    const data = await callJioSaavn({
      __call: 'playlist.getDetails',
      listid: id,
    });

    const rawSongs = data?.songs ?? data?.list ?? [];
    const tracks = Array.isArray(rawSongs) ? rawSongs.map(parseTrack).filter(Boolean) : [];

    const playlist = parsePlaylist(data) ?? {
      id,
      title: htmlDecode(data?.title || 'Playlist'),
      curator: htmlDecode(data?.subtitle || data?.firstname || 'JioSaavn'),
      artworkUrlSmall: upscaleImage(data?.image, '150x150'),
      artworkUrlLarge: upscaleImage(data?.image, '500x500'),
      songCount: tracks.length,
      language: data?.language || '',
    };

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).json({ playlist, tracks });
  } catch (e) {
    console.error('playlist error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
