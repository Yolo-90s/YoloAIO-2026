import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore, firebaseReady } from './firebase.js';

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
};

const AppConfigContext = createContext(defaultConfig);

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    if (!firebaseReady) return;
    const ref = doc(firestore, 'config', 'app');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setConfig({ ...defaultConfig, ...snap.data() });
        }
      },
      () => {
        // Firestore rules may block this for signed-out users; that's fine,
        // defaults are already in state.
      }
    );
    return unsub;
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
