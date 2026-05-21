// GET /api/stream/{id} — proxy the bytes of a Drive file with full Range
// support. The <video> element needs partial-content responses to seek;
// Drive's media endpoint already supports Range, so we just forward
// the header through and stream the response body back.
import { applyCors, getAccessToken } from '../../lib/drive.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const id = req.query.id;
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Missing id' });
    return;
  }

  try {
    const token = await getAccessToken();
    const driveUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`;

    // Forward Range if the client sent one — otherwise Drive returns the
    // whole file, which is fine but defeats progressive playback.
    const headers = { Authorization: `Bearer ${token}` };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(driveUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text().catch(() => '');
      res.status(upstream.status === 404 ? 404 : 502).json({
        error: `Drive HTTP ${upstream.status}`,
        detail: body.slice(0, 300),
      });
      return;
    }

    // Mirror the headers the <video> element cares about. We DO NOT mirror
    // `Content-Encoding` — Drive sometimes adds gzip and the browser will
    // reject Range responses if we lie about the encoding.
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!upstream.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(upstream.status);

    // Stream the body. Node 18+ fetch returns a web ReadableStream; pipe
    // it into the Vercel response with the modern async iterator API.
    if (!upstream.body) { res.end(); return; }
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error('stream error', e);
    if (!res.headersSent) res.status(502).json({ error: e?.message || 'Stream failed' });
  }
}
