# YoloAIO Web (yoloaio-2026)

React port of the YoloAIO Android app. Same Firebase backend, same data model
(`users/`, `chats/`, `customQuotes/`, `publicQuotes/`, `config/app`), so a user
signed in on Android sees their chats, quotes, watch progress and favourites
here, and vice versa.

## Stack

- **Vite** + **React 19**
- **MUI v7** (Material 3) for components
- **react-router-dom v7** for routing
- **firebase v12** Web SDK (Auth, Firestore, Storage)
- **Firebase Functions** (Node 20) for the JioSaavn + Gutenberg proxies
- **Vercel serverless** for the JioSaavn (alt) and Google Drive videos proxies

## Setup

1. **Install deps**

   ```sh
   npm install
   ```

2. **Configure Firebase**

   - Open the Android Firebase project in the
     [Firebase Console](https://console.firebase.google.com/).
   - Add a **Web app** (gear icon → Project settings → Your apps → `</>`).
   - Copy the config values into a new `.env.local` at the project root
     (use `.env.example` as a template):

     ```
     VITE_FIREBASE_API_KEY=...
     VITE_FIREBASE_AUTH_DOMAIN=...
     VITE_FIREBASE_PROJECT_ID=...
     VITE_FIREBASE_STORAGE_BUCKET=...
     VITE_FIREBASE_MESSAGING_SENDER_ID=...
     VITE_FIREBASE_APP_ID=...
     ```

   - In **Authentication → Sign-in method**, enable **Email/Password** and
     **Google**. For Google, add `http://localhost:3000` to the authorised
     domains.

3. **Run**

   ```sh
   npm run dev
   ```

   Open <http://localhost:3000>.

## Remote config (`config/app` in Firestore)

Most feature gates and third-party keys live in a single Firestore document
read live by [src/data/AppConfig.jsx](src/data/AppConfig.jsx). Edit the doc
and the running web app picks it up without a rebuild.

| Field | Used by | Notes |
|---|---|---|
| `tmdbApiKey` / `tmdbAccessToken` | Movies, TV | v3 key or v4 bearer — auto-detected by the `eyJ` JWT prefix in [tmdbClient.js](src/features/movies/tmdbClient.js) |
| `unsplashAccessKey`, `wallpapersUrl` | Wallpaper | URL's `/s/photos/<term>` segment becomes the default search query |
| `weatherApiKey`, `weatherWebUrl` | Weather | OpenWeather key |
| `freesoundApiKey` | Ringtones | freesound.org API key |
| `musicApiBaseUrl` | Music | JioSaavn proxy URL (Firebase Function or Vercel) |
| `videosApiBaseUrl` | Videos | Google Drive proxy URL (Vercel) |
| `booksApiBaseUrl` | Books | Firebase Function endpoint that fetches Gutenberg text |
| `jitsiServerUrl` | Chat calls | Optional, falls back to `meet.jit.si` |
| `googleWebClientId` | Auth | Google sign-in client ID |
| `showMoviesMenu`, `showMusicMenu`, `showWallpapersMenu`, `showWeatherMenu`, `showVideosMenu`, `showBooksMenu`, `showBeatAnalyserMenu`, `showNewsMenu`, `showSettingsMenu` | Home grid | Per-tile feature flags |

## Features

| Feature | Backing source | Notes |
|---|---|---|
| Auth (Email + Google) | Firebase Auth | ✅ |
| Home (greeting + bento grid) | local | ✅ |
| Settings + Privacy | localStorage + Firestore | ✅ |
| Theme system (7 palettes, animated 3-blob backdrop) | local | ✅ |
| Movies + TV details + player | TMDB v3/v4 → vidking embed | Watch progress synced to Firestore via [useWatchProgress.js](src/features/movies/useWatchProgress.js) |
| Music | JioSaavn (via proxy) | DES-ECB decrypted stream URL, custom player with EQ/effects, Chromecast, favourites |
| Wallpaper | Unsplash | Infinite scroll, favourites, detail view |
| Ringtones | Freesound | Favourites, in-app preview |
| Audio Trimmer | Web Audio API | Saves trimmed tones to localStorage |
| Beat Analyser | Web Audio + mic | Live BPM/spectrum visualiser |
| Books | Gutendex + Gutenberg (via proxy) | Search, reader, favourites |
| Videos | Google Drive (via proxy) | Lists a shared folder, in-browser editor |
| Chat | Firestore | DMs, user profiles, Jitsi voice/video |
| Community | Firestore | Public channels |
| Quotes | Firestore | Editor, public + private quotes, presets |
| Weather | OpenWeather | ✅ |
| Wi-Fi Lab | — | ❌ Android-only stub (needs `WifiManager.startScan()`) |

Each route has a `FeatureScaffold` wrapper so the top bar, back button and
chrome stay consistent across screens.

## Architecture mirror

The web codebase tracks the Kotlin one closely on purpose:

| Android | Web |
|---|---|
| `data/UserSession.kt` | [src/data/UserSession.jsx](src/data/UserSession.jsx) |
| `data/AppConfigRepository.kt` | [src/data/AppConfig.jsx](src/data/AppConfig.jsx) |
| `data/FirebaseModule.kt` | [src/data/firebase.js](src/data/firebase.js) |
| `ui/theme/ThemePalette.kt` | [src/theme/palettes.js](src/theme/palettes.js) |
| `ui/theme/Theme.kt` | [src/theme/ThemeProvider.jsx](src/theme/ThemeProvider.jsx) |
| `ui/components/AppBackground.kt` | [src/ui/AppBackground.jsx](src/ui/AppBackground.jsx) (canvas) |
| `ui/components/Glass.kt` | [src/ui/GlassCard.jsx](src/ui/GlassCard.jsx) |
| `ui/components/FeatureScaffold.kt` | [src/ui/FeatureScaffold.jsx](src/ui/FeatureScaffold.jsx) |
| `navigation/Routes.kt` | [src/routes.js](src/routes.js) |
| `navigation/AppNavGraph.kt` | [src/App.jsx](src/App.jsx) |
| `data/TmdbClient.kt` | [src/features/movies/tmdbClient.js](src/features/movies/tmdbClient.js) |
| `data/JioSaavnClient.kt` | [src/features/music/jiosaavnClient.js](src/features/music/jiosaavnClient.js) + [functions/index.js](functions/index.js) |
| `data/VidkingPlayer.kt` | [src/features/movies/vidkingPlayer.js](src/features/movies/vidkingPlayer.js) |
| `features/**/*` | [src/features/](src/features/) |

### Movies/TV client ([tmdbClient.js](src/features/movies/tmdbClient.js))

A thin wrapper around api.themoviedb.org/3 that:

- Auto-detects v3 (`api_key=` query param) vs v4 (Bearer token) auth by
  checking for the `eyJ` JWT prefix.
- Exposes `popular` / `topRated` / `trending` / `search` for `movie` and `tv`,
  plus `details` and `seasonEpisodes`.
- Builds `posterUrl` / `backdropUrl` / `stillUrl` against `image.tmdb.org`.
- Ships a small in-memory cache (`tmdbCache`) so list → detail navigation
  doesn't re-fetch the basics.

The playback half lives in [vidkingPlayer.js](src/features/movies/vidkingPlayer.js)
(constructs vidking embed URLs) and [useWatchProgress.js](src/features/movies/useWatchProgress.js)
(listens to the iframe's `postMessage` events and throttle-saves position
back to Firestore).

## Deployment

Three independent surfaces:

1. **Firebase Hosting** — the SPA (site `yolo-frontend`). `npm run build`
   emits `dist/`; `firebase deploy --only hosting` ships it.
2. **Firebase Functions** — [functions/index.js](functions/index.js) hosts
   the JioSaavn music proxy and the Gutenberg book proxy on Node 20,
   `us-central1`.
3. **Vercel** — two serverless projects:
   - [proxy/](proxy/) — alternate JioSaavn proxy (same response shape as
     the Function; useful if you don't want to enable Firebase billing).
     See [proxy/README.md](proxy/README.md).
   - [videos-proxy/](videos-proxy/) — lists + streams a shared Google
     Drive folder, with `Range` support for `<video>` seeking.
     See [videos-proxy/README.md](videos-proxy/README.md).

After deploying any proxy, paste its URL into the matching field in the
Firestore `config/app` doc — the web client picks it up live.

## Notes on platform-specific Android features

A few features rely on Android-only APIs that the browser does not expose:

- **Wi-Fi Lab** — needs `WifiManager.startScan()`. No web equivalent;
  stays a stub.
- **Ringtones install** — `RingtoneManager.setActualDefaultRingtoneUri()`
  is not exposable to the web; search/preview/favourite all work, but
  "install as ringtone" becomes a download.
- **Wallpaper set** — `WallpaperManager` is Android-only; the web side
  does a high-res download instead.
- **Music background service** — the Android foreground service +
  media-style notification doesn't translate; on web, playback pauses
  when the tab unloads. Chromecast still works.
