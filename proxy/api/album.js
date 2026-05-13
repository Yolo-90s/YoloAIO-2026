// /api/album?id=X — album metadata + its songs.
import { applyCors, callJioSaavn, parseTrack, parseAlbum, htmlDecode, upscaleImage } from '../lib/jiosaavn.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const id = String(req.query.id || '').trim();
    if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

    const data = await callJioSaavn({
      __call: 'content.getAlbumDetails',
      albumid: id,
    });

    // The detail endpoint also returns the songs array (named `songs` or
    // sometimes `list`). Each entry has the same shape as a search hit.
    const rawSongs = data?.songs ?? data?.list ?? [];
    const tracks = Array.isArray(rawSongs) ? rawSongs.map(parseTrack).filter(Boolean) : [];

    // The album metadata sits at the top level of the detail response.
    const album = parseAlbum(data) ?? {
      id,
      title: htmlDecode(data?.title || 'Album'),
      artist: htmlDecode(data?.subtitle || ''),
      artworkUrlSmall: upscaleImage(data?.image, '150x150'),
      artworkUrlLarge: upscaleImage(data?.image, '500x500'),
      year: data?.year || '',
      songCount: tracks.length,
      language: data?.language || '',
    };

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).json({ album, tracks });
  } catch (e) {
    console.error('album error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
