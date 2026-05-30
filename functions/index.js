// JioSaavn proxy. Browsers can't reach jiosaavn.com directly (no CORS) and
// the public mirrors keep dying, so we run our own thin proxy here:
//   GET /search/songs?query=X&limit=N → [SaavnTrack]
//
// The function mirrors JioSaavnClient.kt — same DES-ECB decryption of the
// `encrypted_media_url`, same fallback to the AAC CDN for HTTPS streaming.

const CryptoJS = require('crypto-js');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; YoloAIO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
// DES key — public, embedded in JioSaavn's own web JS bundle.
const DECRYPT_KEY = CryptoJS.enc.Utf8.parse('38346591');

// Node's `crypto` module disabled DES by default in OpenSSL 3 (Node 17+),
// so we use crypto-js's pure-JS DES instead — works on any host without
// the legacy provider being enabled.
function decryptStreamUrl(b64) {
  try {
    const ciphertext = CryptoJS.enc.Base64.parse(b64);
    const decrypted = CryptoJS.DES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext }),
      DECRYPT_KEY,
      { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
    );
    const raw = decrypted.toString(CryptoJS.enc.Utf8);
    if (!raw) return null;
    return raw
      .replace(/^http:/, 'https:')
      .replace('https://h.saavncdn.com', 'https://aac.saavncdn.com');
  } catch {
    return null;
  }
}

function htmlDecodeBasic(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

async function searchJioSaavn(query, limit) {
  const params = new URLSearchParams({
    __call: 'search.getResults',
    q: query,
    n: String(limit),
    p: '1',
    api_version: '4',
    _format: 'json',
    _marker: '0',
    ctx: 'web6dot0',
  });
  const url = `https://www.jiosaavn.com/api.php?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': USER_AGENT,
      Referer: 'https://www.jiosaavn.com/',
      Cookie: 'L=english; gdpr_acceptance=true; DL=english',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`JioSaavn HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  let text = await res.text();
  // The endpoint occasionally wraps the JSON in a JSONP callback.
  text = text.trim();
  if (text.startsWith('(') && text.endsWith(')')) {
    text = text.substring(1, text.length - 1).trim();
  }
  return JSON.parse(text);
}

function parseTracks(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .map((o) => {
      const type = o.type;
      if (type && type !== 'song') return null;
      const id = o.id;
      const moreInfo = o.more_info;
      if (!id || !moreInfo) return null;
      const encrypted = moreInfo.encrypted_media_url;
      const streamUrl = encrypted ? decryptStreamUrl(encrypted) : null;
      if (!streamUrl) return null;

      const title = htmlDecodeBasic(o.title || o.name || 'Untitled');
      const rawImage = o.image && o.image !== 'null' ? o.image : null;
      const artworkUrlLarge = rawImage?.replace('50x50.jpg', '500x500.jpg') ?? null;
      const artworkUrlSmall = rawImage?.replace('50x50.jpg', '150x150.jpg') ?? null;
      const language = o.language || '';
      const year = o.year || '';
      const durationSec = parseInt(moreInfo.duration, 10) || 0;
      const rawArtist =
        moreInfo.primary_artists ||
        o.subtitle ||
        'Unknown';
      const artist = htmlDecodeBasic(rawArtist);

      return {
        id: String(id),
        title,
        artist,
        durationSec,
        artworkUrlSmall,
        artworkUrlLarge,
        language,
        year,
        streamUrl,
      };
    })
    .filter(Boolean);
}

exports.musicProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    // Path may include the function name when routed via the default
    // Cloud Run URL — strip it so /musicProxy/search/songs and
    // /search/songs both work.
    const path = req.path.replace(/^\/musicProxy/, '');

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (path === '/search/songs' || path === '/search/songs/') {
      const query = String(req.query.query || 'top').slice(0, 200);
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 50);
      const data = await searchJioSaavn(query, limit);
      const tracks = parseTracks(data);
      res.set('Cache-Control', 'public, max-age=300'); // 5 min CDN cache
      res.json({ results: tracks });
      return;
    }

    if (path === '/health' || path === '/') {
      res.json({ ok: true, service: 'jiosaavn-proxy' });
      return;
    }

    res.status(404).json({ error: 'Unknown path', path });
  } catch (e) {
    console.error('musicProxy error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
});

// ── Books proxy ─────────────────────────────────────────────────────
// Project Gutenberg blocks the default browser User-Agent (anti-scraping
// policy) AND doesn't send CORS headers, so the React app can't fetch
// book HTML / text directly. This proxy:
//   1. Force-upgrades plain http → https (PG redirects routinely include
//      a cleartext hop)
//   2. Follows up to 5 redirects manually — Node's built-in fetch follows
//      redirects but we want to apply the same upgrade on every hop
//   3. Sends a Chrome UA so PG's bot guard doesn't reject us
//   4. Returns the body to the caller with CORS allowed
//
// Hard-restricted to gutenberg.org / gutendex.com to avoid being abused
// as an open proxy.
const BOOK_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function httpsify(url) {
  return url.replace(/^http:\/\//i, 'https://');
}

function isAllowedHost(urlStr) {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    return (
      h === 'www.gutenberg.org' ||
      h === 'gutenberg.org' ||
      h.endsWith('.gutenberg.org') ||
      h === 'gutendex.com'
    );
  } catch {
    return false;
  }
}

async function fetchBookBody(initialUrl) {
  let current = httpsify(initialUrl);
  for (let hops = 0; hops < 5; hops++) {
    if (!isAllowedHost(current)) throw new Error('Disallowed host');
    const res = await fetch(current, {
      headers: {
        'User-Agent': BOOK_UA,
        'Accept': 'text/html,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
    });
    if (res.status >= 200 && res.status < 300) {
      const contentType = res.headers.get('content-type') || 'text/html';
      const body = await res.text();
      return { body, contentType };
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`Redirect ${res.status} without Location`);
      current = httpsify(new URL(loc, current).toString());
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('Too many redirects');
}

exports.bookProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const url = String(req.query.url || '');
    if (!url) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    if (!isAllowedHost(url)) {
      res.status(400).json({ error: 'Disallowed host' });
      return;
    }
    const { body, contentType } = await fetchBookBody(url);
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
    res.set('Content-Type', contentType);
    res.send(body);
  } catch (e) {
    console.error('bookProxy error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
});
