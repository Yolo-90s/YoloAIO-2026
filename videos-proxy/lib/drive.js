// Shared Drive client. Outside `api/` so Vercel doesn't try to deploy it
// as its own endpoint. Mirrors the structure of ../proxy/lib/jiosaavn.js.
import { google } from 'googleapis';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

// One auth client per warm Lambda invocation — Vercel re-uses the module
// scope across requests within the same container, so we cache it.
let cachedAuth = null;
function getAuth() {
  if (cachedAuth) return cachedAuth;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set. See videos-proxy/README.md.');
  }
  // Vercel UI users sometimes paste the JSON with literal "\n" inside
  // private_key — handle both raw and escaped forms.
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  if (typeof creds.private_key === 'string') {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  }
  cachedAuth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return cachedAuth;
}

export function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

export function getFolderId() {
  const id = process.env.DRIVE_FOLDER_ID;
  if (!id) throw new Error('DRIVE_FOLDER_ID env var is not set. See videos-proxy/README.md.');
  return id;
}

// Drive's `files.list` returns paginated results. For the typical curated
// folder (< 1000 videos) one page is enough, but we paginate anyway so
// adding more later doesn't silently truncate.
export async function listFolderVideos() {
  const drive = getDriveClient();
  const folderId = getFolderId();
  const out = [];
  let pageToken;
  do {
    const resp = await drive.files.list({
      // Only videos directly in the folder, exclude trashed entries.
      q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, thumbnailLink, hasThumbnail, videoMediaMetadata(durationMillis,width,height), modifiedTime)',
      pageSize: 200,
      pageToken,
      orderBy: 'name',
      // Service-account-owned Shared Drives need these flags; harmless on My Drive.
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (resp.data.files) out.push(...resp.data.files);
    pageToken = resp.data.nextPageToken;
  } while (pageToken);
  return out;
}

// Get a token (string) we can pass to the Drive media endpoint as a
// Bearer header. Tokens last ~1 hour and the GoogleAuth client caches +
// refreshes them automatically.
export async function getAccessToken() {
  const auth = getAuth();
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not obtain Drive access token.');
  return token;
}
