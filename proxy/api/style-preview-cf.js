// /api/style-preview-cf  —  POST { photoBase64, mimeType, prompt, negativePrompt?, accountId, strength? }
//
// Cloudflare Workers AI alternative to the Gemini endpoint. Uses SDXL
// img2img with a low denoise strength so the original face stays mostly
// intact while the hairstyle (and surrounding pixels) get repainted to
// match the prompt.
//
// Why have this alongside Gemini:
//   - Gemini 2.5 Flash Image's free tier has tight per-day input-token
//     quotas. A handful of preview generations exhausts it.
//   - Cloudflare Workers AI gives 10,000 neurons/day for free; SDXL is
//     ~150-250 neurons per generation = roughly 40-60 images/day on the
//     free tier with NO billing setup required.
//   - Identity preservation is weaker than Gemini — SD doesn't have the
//     same "this is a specific person, keep them identical" guarantee.
//     The strength=0.55 default leaves enough of the original image
//     intact that the face is usually recognizable.
//
// Free-tier setup:
//   1. Cloudflare account (free) → Profile → API Tokens → Create token
//      with the "Workers AI" template. Copy the token.
//   2. Vercel env var: CLOUDFLARE_API_TOKEN = <that token>.
//   3. Firestore: set `cloudflareAccountId` to your Cloudflare account
//      ID (found in any URL in the dashboard, e.g.
//      dash.cloudflare.com/<account_id>/...). NOT secret — it's in the
//      URL — so we ship it via Firestore alongside other public config.

// `stable-diffusion-xl-base-1.0` is text-to-image only and doesn't
// accept an `image` input. `stable-diffusion-v1-5-img2img` does — it's
// SD 1.5 quality (lower than SDXL) but supports the image+strength
// workflow we need for "keep face, change hair".
const MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

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

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    res.status(500).json({ ok: false, error: 'Server missing CLOUDFLARE_API_TOKEN' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { photoBase64, prompt, negativePrompt, accountId, strength } = body;
  if (!photoBase64 || !prompt || !accountId) {
    res.status(400).json({ ok: false, error: 'photoBase64, prompt and accountId are required' });
    return;
  }
  if (photoBase64.length > 6_500_000) {
    res.status(413).json({ ok: false, error: 'Photo too large — downscale before sending' });
    return;
  }

  // Workers AI's SD model accepts the input image as an array of byte
  // values. Decode the base64 then turn it into a regular JSON-safe
  // number array.
  let imageBytes;
  try {
    imageBytes = Array.from(Buffer.from(photoBase64, 'base64'));
  } catch (e) {
    res.status(400).json({ ok: false, error: 'Invalid base64 photo' });
    return;
  }

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;

  try {
    const upstream = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt ||
          'deformed face, distorted features, asymmetric eyes, extra fingers, ' +
          'multiple faces, different person, mutated, disfigured, plastic skin, ' +
          'low quality, lowres, blurry, jpeg artifacts, watermark, text, signature, ' +
          'cartoon, anime, sketch, drawing, painting, 3d render, oversaturated',
        image: imageBytes,
        // 0.5 keeps more of the original image so identity drifts less.
        // Hair still changes because the hair region's prompt activations
        // are strong enough to overpower a low-strength img2img.
        strength: typeof strength === 'number' ? Math.max(0.2, Math.min(0.9, strength)) : 0.5,
        // SD 1.5's free tier caps at 20 steps on Cloudflare Workers AI —
        // higher values are silently clamped, so we stop here. If/when
        // CF raises the cap, bumping to 30 would noticeably sharpen.
        num_steps: 20,
        // Higher guidance pushes the model harder toward the prompt
        // (sharper hair, more confident features) at the cost of slight
        // over-saturation.
        guidance: 9,
      }),
    });

    const ct = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      // Cloudflare returns JSON errors with a body like
      // { success: false, errors: [{ code, message }] }
      const txt = await upstream.text().catch(() => '');
      let msg = `Cloudflare error ${upstream.status}`;
      try {
        const j = JSON.parse(txt);
        if (j?.errors?.[0]?.message) msg += `: ${j.errors[0].message}`;
        else if (j?.error) msg += `: ${j.error}`;
      } catch {
        if (txt) msg += `: ${txt.slice(0, 300)}`;
      }
      res.status(upstream.status).json({ ok: false, error: msg });
      return;
    }

    if (ct.startsWith('image/')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(200).json({
        ok: true,
        imageBase64: buf.toString('base64'),
        mimeType: ct.split(';')[0],
      });
      return;
    }

    // Some Workers AI deployments wrap the image in JSON; handle that path too.
    const j = await upstream.json().catch(() => null);
    if (j?.result?.image) {
      res.status(200).json({
        ok: true,
        imageBase64: j.result.image,
        mimeType: 'image/png',
      });
      return;
    }
    res.status(502).json({ ok: false, error: 'Cloudflare returned no image' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Unknown error' });
  }
}
