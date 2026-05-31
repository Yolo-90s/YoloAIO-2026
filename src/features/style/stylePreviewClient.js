// Client wrapper around the Gemini image-edit proxy.
//
// Responsibilities:
//   1. Downscale the user's photo before sending (Vercel hobby caps the
//      request body at 4.5 MB; full-resolution selfies blow past that
//      once base64-encoded).
//   2. Build a prompt that strongly signals "keep the face, only change
//      the hair" — Gemini 2.5 Flash Image respects identity instructions
//      well but only if you tell it explicitly.
//   3. POST to `${styleApiBaseUrl}/api/style-preview` and return the
//      generated image as a data: URL ready for an <img src>.
//
// In-memory cache keyed by (hairstyleId + photoFingerprint) so opening
// the same preview twice in one session doesn't burn free-tier quota.

const cache = new Map();

export function clearPreviewCache() {
  cache.clear();
}

// Gemini's image-edit model responds to natural-language editing
// instructions. We bias hard on identity preservation since "change
// hair, keep face" is the entire contract.
export function buildPrompt(style, options = {}) {
  const { length, texture, color, volume } = options;

  const extras = [];
  if (length)  extras.push(`length: ${length}`);
  if (texture) extras.push(`texture: ${texture}`);
  if (volume)  extras.push(`volume: ${volume}`);
  if (color && color !== 'natural') extras.push(`hair color: ${color}`);
  const extraLine = extras.length ? `Hair adjustments — ${extras.join(', ')}.` : '';

  return [
    `Edit this photo so the person has a ${style.name} hairstyle.`,
    `Style description: ${style.description}`,
    extraLine,
    'Critical: keep the person\'s face, skin tone, skin texture, eye color, eye shape, nose, lips, jawline, ears, facial hair and overall identity exactly the same.',
    'Only change the hair. Keep the same lighting, same background, same camera angle, same clothing.',
    'Output: a single photorealistic photo of the same person with the new hairstyle.',
  ].filter(Boolean).join(' ');
}

// SD-style positive prompt — comma-separated tags, photographic
// modifiers, focused descriptions. SD doesn't follow instructions like
// "keep the face identical" — that's controlled by img2img strength on
// the proxy side. Negative prompt is supplied separately.
//
// Front-loaded with quality boosters since SD 1.5 needs explicit "this
// should look professional" cues to avoid the soft, oversmooth default.
export function buildSdPrompt(style, options = {}) {
  const { length, texture, color, volume } = options;
  const tags = [
    'masterpiece, best quality, ultra detailed',
    'professional portrait photograph of a person',
    `with a ${style.name} hairstyle`,
    style.description,
  ];
  if (length)  tags.push(`${length} length hair`);
  if (texture) tags.push(`${texture} hair texture`);
  if (volume)  tags.push(`${volume} hair volume`);
  if (color && color !== 'natural') tags.push(`${color} hair color`);
  tags.push(
    'photorealistic',
    'studio lighting',
    'sharp focus',
    'detailed skin texture, natural skin pores',
    'high detail face',
    '8k uhd, dslr, soft lighting, film grain, Fujifilm XT3',
  );
  return tags.join(', ');
}

// Resize a File / Blob / Image to a max dimension and re-encode as JPEG
// at the given quality. Returns { base64, mimeType, width, height }.
export async function prepPhotoForUpload(source, { maxDim = 768, quality = 0.85 } = {}) {
  const img = await loadAsImage(source);
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * ratio);
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    base64: dataUrl.split(',')[1],
    mimeType: 'image/jpeg',
    width: w,
    height: h,
  };
}

// Posts a single preview request. `backend` selects which proxy
// endpoint to hit: 'gemini' (default, identity-preserving image edit)
// or 'cloudflare' (SDXL img2img on Workers AI, free tier friendly).
// Returns { ok, dataUrl, error }.
export async function generatePreview({
  baseUrl, style, photo, options = {},
  backend = 'gemini', cloudflareAccountId = '',
}) {
  if (!baseUrl) return { ok: false, error: 'Style preview not configured yet (no styleApiBaseUrl)' };
  if (!photo || !photo.base64) return { ok: false, error: 'No photo' };

  const cacheKey = `${backend}|${style.id}|${JSON.stringify(options)}|${photo.fingerprint || ''}`;
  if (cache.has(cacheKey)) return { ok: true, dataUrl: cache.get(cacheKey), fromCache: true };

  const root = baseUrl.replace(/\/$/, '');
  let url, body;
  if (backend === 'cloudflare') {
    if (!cloudflareAccountId) {
      return { ok: false, error: 'Cloudflare backend selected but cloudflareAccountId not configured' };
    }
    url = `${root}/api/style-preview-cf`;
    body = {
      photoBase64: photo.base64,
      mimeType: photo.mimeType,
      prompt: buildSdPrompt(style, options),
      accountId: cloudflareAccountId,
    };
  } else {
    url = `${root}/api/style-preview`;
    body = {
      photoBase64: photo.base64,
      mimeType: photo.mimeType,
      prompt: buildPrompt(style, options),
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const respBody = await res.json().catch(() => ({}));
    if (!res.ok || !respBody?.ok) {
      return { ok: false, error: respBody?.error || `HTTP ${res.status}` };
    }
    const dataUrl = `data:${respBody.mimeType || 'image/png'};base64,${respBody.imageBase64}`;
    cache.set(cacheKey, dataUrl);
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

// Fire N previews in parallel, calling onUpdate(styleId, state) as each
// resolves so the UI can populate cards independently rather than
// waiting for the slowest. Returns the final map.
export async function generatePreviewsParallel({
  baseUrl, styles, photo, options, onUpdate,
  backend = 'gemini', cloudflareAccountId = '',
}) {
  const results = {};
  await Promise.all(
    styles.map(async (style) => {
      onUpdate?.(style.id, { phase: 'loading' });
      const r = await generatePreview({
        baseUrl, style, photo, options,
        backend, cloudflareAccountId,
      });
      results[style.id] = r;
      onUpdate?.(style.id, r.ok ? { phase: 'done', dataUrl: r.dataUrl } : { phase: 'error', error: r.error });
    })
  );
  return results;
}

// ── helpers ────────────────────────────────────────────────────────

async function loadAsImage(source) {
  if (source instanceof HTMLImageElement) return source;
  if (typeof source === 'string') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = source;
    });
  }
  // File / Blob
  const url = URL.createObjectURL(source);
  try {
    return await loadAsImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
