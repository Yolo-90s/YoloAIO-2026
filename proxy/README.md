# YoloAIO Music Proxy (Vercel)

A 100-line serverless function that proxies JioSaavn for the YoloAIO web
app. Browsers can't reach `jiosaavn.com` directly (no CORS) and the
public mirrors are unreliable, so we run our own here.

This is identical in behaviour to `../functions/index.js` (the Firebase
Function version) — same DES-ECB decryption of `encrypted_media_url`,
same response shape. Use whichever host suits you. Vercel works on the
free hobby plan with no credit card.

## Deploy

```sh
# one-time, from anywhere
npm install -g vercel

# from this `proxy/` directory
cd proxy
vercel
```

The first `vercel` run will:

1. Ask you to log in (browser opens — sign in with GitHub / Google / email).
2. Prompt: **"Set up and deploy?"** → press Enter to accept.
3. Prompt: **"Which scope?"** → pick your personal account.
4. Prompt: **"Link to existing project?"** → press `N`.
5. Prompt: **"What's your project's name?"** → e.g. `yoloaio-music-proxy`.
6. Prompt: **"In which directory is your code located?"** → press Enter (current dir).
7. Build & deploy. After ~30 seconds you'll see the URL, e.g.
   `https://yoloaio-music-proxy.vercel.app`.

For subsequent deploys, just run `vercel --prod`.

## Wire it into the web app

Take the deployment URL from step 7 and paste it into the Firestore
`config/app` document as a new field:

| Field             | Type   | Value                                      |
| ----------------- | ------ | ------------------------------------------ |
| `musicApiBaseUrl` | string | `https://yoloaio-music-proxy.vercel.app/api` |

(Notice the `/api` suffix — Vercel routes `api/search/songs.js` under
`/api/search/songs`, and the web client appends `/search/songs` to whatever
base it's given.)

The Music tab will pick this up live — no need to redeploy the React app.

## Sanity check

After deploy, hit the endpoint directly in your browser:

```
https://yoloaio-music-proxy.vercel.app/api/search/songs?query=telugu&limit=5
```

You should get back JSON like:

```json
{ "results": [ { "id": "...", "title": "...", "streamUrl": "https://aac.saavncdn.com/...", ... } ] }
```

If you see `{ "error": ... }` instead, JioSaavn upstream rejected the
request (rare; try again in a minute, or use a different query term).

## Free-tier limits

Vercel Hobby plan, per month:

- **100k function invocations** — far more than this app will ever use.
- **100 GB-hr compute** — irrelevant; each call returns in ~300ms.
- **No credit card required.**

The function sets a 5-minute edge cache, so the same query across many
clients only hits JioSaavn once.
