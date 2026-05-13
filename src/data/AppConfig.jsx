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
