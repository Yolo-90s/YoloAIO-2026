# YoloAIO Videos Proxy (Vercel)

Lists and streams videos from a single Google Drive folder for the
YoloAIO web app's `/videos` feature. Mirrors the `proxy/` (music) layout —
two serverless functions, no database, no Firebase.

Browsers can't list Drive folders directly because that requires OAuth
and a Google Cloud project of your own; pushing the auth server-side
lets the web app stay anonymous.

## What you need before deploying

1. **A Google Cloud project** (free). https://console.cloud.google.com → create project.
2. **Drive API enabled** in that project. APIs & Services → Library → search "Drive API" → Enable.
3. **A service account.** IAM & Admin → Service Accounts → Create. Name it `yoloaio-videos`. Skip the optional steps.
4. **A JSON key for that service account.** Open the account → Keys tab → Add Key → JSON. A file downloads — keep it safe.
5. **A Drive folder shared with the service account.** Create a folder in your own Drive (e.g. `YoloAIO Videos`), drop your video files in, then **share** the folder with the service account's email (it looks like `yoloaio-videos@<project-id>.iam.gserviceaccount.com`). Viewer permission is enough.
6. **The folder's ID.** Open the folder in Drive — the URL is `https://drive.google.com/drive/folders/<FOLDER_ID>`. Copy that ID.

## Deploy

```sh
# one-time, from anywhere
npm install -g vercel

# from this `videos-proxy/` directory
cd videos-proxy
npm install
vercel
```

Follow the prompts (project name e.g. `yoloaio-videos-proxy`).

After the first deploy, set two env vars on the Vercel project:

| Env var                       | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the entire contents of the JSON key file you downloaded. One line is fine; the proxy converts `\n` escapes inside `private_key`. |
| `DRIVE_FOLDER_ID`             | The folder ID from step 6.                                              |

Set them in Vercel → Project → Settings → Environment Variables. After
saving, redeploy with `vercel --prod` so the new env values get baked in.

## Wire it into the web app

In Firestore, edit the `config/app` document and set:

| Field              | Type   | Value                                            |
| ------------------ | ------ | ------------------------------------------------ |
| `videosApiBaseUrl` | string | `https://yoloaio-videos-proxy.vercel.app/api`    |
| `showVideosMenu`   | bool   | `true`                                            |

The web app reloads the value live — no rebuild needed.

## Sanity check

```
https://<your-project>.vercel.app/api/list
```

Should return `{ "videos": [ ... ] }`. Empty array means the folder is
shared correctly but has no videos in it; an `{ error: ... }` response
means auth or sharing isn't set up — re-check steps 4 + 5.

## Endpoints

| Path                    | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `GET /api/list`         | Returns `{ videos: [{ id, name, mimeType, sizeBytes, durationMs, width, height, thumbnailUrl, modifiedAt }] }`. |
| `GET /api/stream/{id}`  | Streams the bytes of the file. Honors `Range`; the `<video>` element seeks via this. |

## Free-tier limits

Vercel Hobby plan:

- 100k function invocations / month
- 100 GB-hr compute / month
- **100 GB egress / month** ← this is the one that matters here. A 20 MB
  clip watched 5,000 times eats 100 GB. If you expect more traffic,
  serve `videosApiBaseUrl` from your own Cloudflare/Cloud Run.

Drive's API itself is rate-limited to ~1000 queries per 100s per user —
the proxy hits Drive once per `list` and once per `stream` request, so
you'd need genuine traffic to bump into this.
