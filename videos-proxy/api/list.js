// GET /api/list — list videos in the configured shared Drive folder.
// Returns a slim shape the web app can consume directly.
import { applyCors, listFolderVideos } from '../lib/drive.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const files = await listFolderVideos();
    const videos = files.map((f) => {
      const meta = f.videoMediaMetadata ?? {};
      const sizeBytes = typeof f.size === 'string' ? parseInt(f.size, 10) : f.size ?? 0;
      const durationMs = meta.durationMillis
        ? parseInt(meta.durationMillis, 10)
        : 0;
      // Drive thumbnailLink is signed and short-lived — fine to send as-is
      // because the client will rev it on each list call.
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes,
        durationMs,
        width: meta.width || 0,
        height: meta.height || 0,
        thumbnailUrl: f.hasThumbnail ? f.thumbnailLink : null,
        modifiedAt: f.modifiedTime || null,
      };
    });

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.status(200).json({ videos });
  } catch (e) {
    console.error('list error', e);
    res.status(502).json({ error: e?.message || 'Drive list failed' });
  }
}
