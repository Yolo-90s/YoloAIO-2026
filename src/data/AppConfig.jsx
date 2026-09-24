import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, firestore, firebaseReady } from './firebase.js';
import { normalizeRole } from './UserRole.jsx';

// Mirrors AppConfig.kt / AppConfigRepository.kt — a single Firestore doc
// holding remote feature flags + API keys. When Firebase isn't configured
// (or the doc doesn't exist) we fall back to a generous default so the
// Home tiles still show.

const defaultConfig = {
  admin: false,
  moviesUrl: '',
  showMoviesMenu: true,
  showMusicMenu: true,
  showNewsMenu: true,
  showSettingsMenu: true,
  showWallpapersMenu: true,
  showWeatherMenu: true,
  unsplashAccessKey: '',
  wallpapersUrl: '',
  weatherApiKey: '',
  weatherWebUrl: '',
  tmdbApiKey: '',
  tmdbAccessToken: '',
  freesoundApiKey: '',
  googleWebClientId: '',
  // Web-only: URL of a JioSaavn proxy (Cloud Function or any other server).
  // Browsers can't reach jiosaavn.com directly (no CORS), so the Music
  // feature is gated on this being set. See `functions/index.js` for the
  // Firebase Function that fills this role.
  musicApiBaseUrl: '',
  // Web-only: URL of the Google Drive videos proxy (lists a shared
  // folder + streams bytes with Range support). Browsers can't list
  // Drive folders without OAuth, so the Videos feature is gated on this.
  // See `videos-proxy/README.md` for setup.
  videosApiBaseUrl: '',
  showVideosMenu: true,
  // Optional custom Jitsi server. Falls back to meet.jit.si when empty.
  jitsiServerUrl: '',
  showBooksMenu: true,
  showBeatAnalyserMenu: true,
  showWalkieTalkieMenu: true,
  // TURN relay for the raw-WebRTC WalkieTalkie feature (Android side too —
  // same `config/app` doc). Google's public STUN is always used as a
  // baseline; these three add a TURN server on top, required for two
  // devices on different networks to reliably connect. Get a free TURN
  // endpoint from Metered.ca (or self-host coturn) and set these three in
  // Firestore `config/app` — no rebuild needed.
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
  showStyleYourselfMenu: true,
  // Base URL of the Style Yourself proxy that fronts Gemini + Cloudflare
  // image-edit endpoints. POSTs hit `${styleApiBaseUrl}/api/style-preview`
  // (Gemini) or `/api/style-preview-cf` (Cloudflare). Same Vercel project
  // as the music + book proxies — set this to e.g.
  // https://yoloaio-music-proxy.vercel.app and add GEMINI_API_KEY and/or
  // CLOUDFLARE_API_TOKEN to the project's env vars.
  styleApiBaseUrl: '',
  // 'gemini' (best quality, paid quota past free tier) or 'cloudflare'
  // (SDXL on Workers AI, 10K neurons/day free, weaker identity preservation).
  stylePreviewBackend: 'gemini',
  // Cloudflare account ID — NOT secret; visible in any dashboard URL at
  // dash.cloudflare.com/<account_id>/.... Required when stylePreviewBackend
  // is 'cloudflare'. The matching API token lives in the Vercel proxy env
  // as CLOUDFLARE_API_TOKEN (which IS secret).
  cloudflareAccountId: '',
  // Cloud Function endpoint for the Gutenberg book proxy. Browsers
  // can't fetch gutenberg.org directly (no CORS, anti-bot UA gate),
  // so the Books reader hits this proxy and forwards the URL.
  // See functions/index.js → bookProxy.
  booksApiBaseUrl: '',
  // Minimum role (by ROLES value: "guest"/"user"/"admin") required to see
  // each Home menu tile, keyed by the tile's `key` (see ALL_TILES in
  // HomeScreen.jsx). Admin-editable from Settings → Menu Access. A key
  // absent from this map falls back to DEFAULT_MIN_ROLE, then "user".
  // ADMIN/DEVELOPER always see every tile regardless — see minRoleFor's
  // callers in HomeScreen.jsx.
  menuMinRole: {},
};

// Menus that don't follow the blanket "USER sees everything else"
// default: the basics stay open to GUEST. (Nothing on web needs an
// admin-only default the way Android's experimental 3D Menu does.)
const DEFAULT_MIN_ROLE = {
  movies: 'guest',
  music: 'guest',
  chat: 'guest',
};

/** The minimum role required to see the Home tile with this key. */
export function minRoleFor(config, key) {
  const configured = config.menuMinRole?.[key];
  if (configured) return normalizeRole(configured);
  return DEFAULT_MIN_ROLE[key] ?? 'user';
}

/**
 * Sets the minimum role required to see one Home menu tile. Uses a dotted
 * field-path update (`menuMinRole.<key>`) rather than
 * `setDoc(..., { merge: true })` — Firestore's merge replaces a nested map
 * field wholesale, which would wipe out every other tile's setting;
 * `updateDoc` with a dotted key touches only that one nested field.
 * Requires the caller to be an admin — enforced by firestore.rules
 * (`allow write: if isAdmin()` on `config/{doc}`), not just by this
 * function being hidden from non-admins in the UI.
 */
export async function setMenuMinRole(key, role) {
  await updateDoc(doc(firestore, 'config', 'app'), { [`menuMinRole.${key}`]: role });
}

const AppConfigContext = createContext(defaultConfig);

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(defaultConfig);

  // `config/app` requires isSignedIn() per firestore.rules, but Firebase
  // Auth's persisted-session restoration is itself async — subscribing to
  // the doc unconditionally on mount can race it: attach before auth
  // resolves, get a permission-denied, and — since onSnapshot doesn't
  // retry itself after an error — stay stuck on `defaultConfig` (blank
  // API keys) for the rest of the page load. That's exactly what showed
  // up as "TMDB key missing" etc. despite the key being set, and only
  // "most of the time" since it depends on how slow that particular load
  // was. Fix: only (re)attach the doc listener once onAuthStateChanged
  // confirms a signed-in user; detach and reset to defaults on sign-out.
  useEffect(() => {
    if (!firebaseReady) return undefined;

    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc?.();
      unsubDoc = null;

      if (!user) {
        setConfig(defaultConfig);
        return;
      }

      const ref = doc(firestore, 'config', 'app');
      unsubDoc = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setConfig({ ...defaultConfig, ...snap.data() });
          }
        },
        (err) => {
          // A genuine post-attachment error (rare network blip) — keep
          // whatever config we already have rather than blanking it out.
          console.warn('config/app listen failed:', err);
        }
      );
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}

// Mirrors the parseUnsplashQuery() helper in AppConfig.kt.
export function unsplashQuery(wallpapersUrl) {
  if (!wallpapersUrl) return 'nature';
  for (const marker of ['/s/photos/', '/photos/']) {
    const idx = wallpapersUrl.indexOf(marker);
    if (idx >= 0) {
      const tail = wallpapersUrl.substring(idx + marker.length);
      const seg = tail.split('/')[0].split('?')[0].replace(/^\/+|\/+$/g, '');
      if (seg) return seg;
    }
  }
  return 'nature';
}

export function tmdbAuth(config) {
  return config.tmdbAccessToken?.trim() || config.tmdbApiKey?.trim() || '';
}
