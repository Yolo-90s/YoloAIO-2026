// /api/style-preview  —  POST { photoBase64, mimeType, prompt }
//
// Generates a hairstyle preview using Gemini 2.5 Flash Image (Nano
// Banana). The model accepts an image + text prompt and returns an
// edited image with strong character/identity consistency, which is
// exactly the "keep the face, change only the hair" contract we need.
//
// Why a proxy and not a direct browser call:
//   1. Keeps the GEMINI_API_KEY out of the client bundle.
//   2. Lets us throttle / log / swap models without redeploying the app.
//   3. Same hosting pattern as the music + book proxies — single Vercel
//      project, /api/* endpoints.
//
// Free tier note: Google AI Studio gives a generous free quota on
// gemini-2.5-flash-image. The exact rate-limit policy may change; if
// you start hitting quota errors, the response status will be 429 and
// the client will surface a "try again later" message.

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST required' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: 'Server missing GEMINI_API_KEY' });
    return;
  }

  // Vercel parses JSON bodies automatically when Content-Type is
  // application/json. Older Node versions / mis-set headers can leave
  // req.body as a string, so handle both.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { photoBase64, mimeType, prompt } = body;
  if (!photoBase64 || !mimeType || !prompt) {
    res.status(400).json({ ok: false, error: 'photoBase64, mimeType and prompt are required' });
    return;
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    res.status(400).json({ ok: false, error: `Unsupported mimeType ${mimeType}` });
    return;
  }
  if (photoBase64.length > 6_500_000) {
    // Loose guard: ~4.8 MB raw image once decoded. Vercel hobby has a
    // 4.5 MB request body limit anyway, so we'd reject upstream too.
    res.status(413).json({ ok: false, error: 'Photo too large — downscale before sending' });
    return;
  }

  try {
    const upstream = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: photoBase64 } },
            ],
          },
        ],
        generationConfig: {
          // Tell Gemini we expect an image back. Without this the model
          // can default to a text-only response.
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      res.status(upstream.status).json({
        ok: false,
        error: `Gemini error ${upstream.status}: ${truncate(errText, 400)}`,
      });
      return;
    }

    const data = await upstream.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let imageBase64 = null;
    let imageMime = 'image/png';
    let textBlurb = '';
    for (const p of parts) {
      if (p.inlineData?.data) {
        imageBase64 = p.inlineData.data;
        imageMime = p.inlineData.mimeType || 'image/png';
      } else if (p.text) {
        textBlurb += p.text;
      }
    }

    if (!imageBase64) {
      res.status(502).json({
        ok: false,
        error: 'Gemini returned no image',
        textBlurb: truncate(textBlurb, 400),
      });
      return;
    }

    res.status(200).json({
      ok: true,
      imageBase64,
      mimeType: imageMime,
      textBlurb: textBlurb || null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}

function truncate(s, n) {
  if (typeof s !== 'string') return '';
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
