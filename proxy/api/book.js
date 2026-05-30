// /api/book?url=<gutenberg URL> — proxies Project Gutenberg book bodies.
//
// Browsers can't fetch gutenberg.org directly (no CORS) and PG's anti-
// scraping policy blocks the default browser User-Agent, so this proxy:
//   1. Force-upgrades plain http → https (PG redirects routinely include
//      a cleartext hop, which the browser would otherwise block on
//      Android API 28+)
//   2. Follows up to 5 redirects manually — fetch's native redirect
//      handling doesn't apply our https-upgrade between hops
//   3. Sends a Chrome desktop UA so PG's bot guard accepts the request
//   4. Restricts the allowlist to gutenberg.org / gutendex.com so this
//      can't be abused as an open proxy
//
// Same conceptual layout as `functions/index.js → bookProxy`. Use
// whichever host suits you; Vercel works on the free hobby plan.

const BOOK_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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
        Accept: 'text/html,text/plain,*/*',
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

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
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
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', contentType);
    res.status(200).send(body);
  } catch (e) {
    console.error('book proxy error', e);
    res.status(502).json({ error: e?.message || 'Upstream error' });
  }
}
