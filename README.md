# YoloAIO Web (yoloaio-2026)

React port of the YoloAIO Android app. Same Firebase backend, same data model
(`users/`, `chats/`, `customQuotes/`, `publicQuotes/`, `config/app`), so a user
signed in on Android sees their chats and quotes here, and vice versa.

## Stack

- **Vite** + **React 19**
- **MUI v7** (Material 3) for components
- **react-router-dom v7** for routing
- **firebase v12** Web SDK (Auth, Firestore, Storage)

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

## What's implemented so far

This is the **foundation slice** — every route exists, but feature screens
are still being ported one by one.

| Slice | Status |
|---|---|
| Theme system (7 palettes, animated 3-blob backdrop) | ✅ |
| Routing + auth guard | ✅ |
| Auth (Sign In / Sign Up / Google) | ✅ |
| Home (greeting + hero + bento grid of 10 tiles) | ✅ |
| Settings (profile, theme picker, sign out, edit profile, change password) | ✅ |
| Privacy (toggles + radios) | ✅ |
| Movies / TV / Music / Chat / Community / Quotes / Wallpaper / Ringtones / Weather / Audio Trimmer | 🚧 stub |
| Wi-Fi Lab | ❌ Android-only |

Each stub uses the same `FeatureScaffold` as the real feature, so the back
button and chrome already work — only the feature body needs to land.

## Architecture mirror

The web codebase tracks the Kotlin one closely on purpose:

| Android | Web |
|---|---|
| `data/UserSession.kt` | `src/data/UserSession.jsx` |
| `data/AppConfigRepository.kt` | `src/data/AppConfig.jsx` |
| `data/FirebaseModule.kt` | `src/data/firebase.js` |
| `ui/theme/ThemePalette.kt` | `src/theme/palettes.js` |
| `ui/theme/Theme.kt` | `src/theme/ThemeProvider.jsx` |
| `ui/theme/ThemePreferenceStore.kt` | `src/theme/paletteStore.js` (localStorage) |
| `ui/components/AppBackground.kt` | `src/ui/AppBackground.jsx` (canvas) |
| `ui/components/Glass.kt` | `src/ui/GlassCard.jsx` |
| `ui/components/FeatureScaffold.kt` | `src/ui/FeatureScaffold.jsx` |
| `navigation/Routes.kt` | `src/routes.js` |
| `navigation/AppNavGraph.kt` | `src/App.jsx` |
| `features/auth/*` | `src/features/auth/*` |
| `features/home/HomeScreen.kt` | `src/features/home/HomeScreen.jsx` |
| `features/settings/SettingsScreen.kt` | `src/features/settings/SettingsScreen.jsx` |
| `features/settings/PrivacyScreen.kt` | `src/features/settings/PrivacyScreen.jsx` |
| `features/settings/PrivacyPreferenceStore.kt` | `src/features/settings/privacyPrefs.js` |

## Notes on platform-specific Android features

A few features rely on Android-only APIs that the browser does not expose:

- **Wi-Fi Lab** — needs `WifiManager.startScan()`. No web equivalent.
- **Ringtones install** — `RingtoneManager.setActualDefaultRingtoneUri()` is
  not exposable to the web; the search/preview part is portable but the
  install will become a download.
- **Wallpaper set** — `WallpaperManager` is Android-only; the web side will
  do a high-res download instead.
- **Music background service** — the Android foreground service + media
  notification doesn't translate; on web, playback pauses when the tab
  unloads. Cast (Chromecast) is also Android-side only.

These are noted feature-by-feature as we port them.
