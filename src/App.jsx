import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { YoloThemeProvider } from './theme/ThemeProvider.jsx';
import { AppBackground } from './ui/AppBackground.jsx';
import { AppShell } from './ui/AppShell.jsx';
import { UserSessionProvider, useCurrentUser } from './data/UserSession.jsx';
import { AppConfigProvider } from './data/AppConfig.jsx';
import { routes } from './routes.js';
import { AuthScreen } from './features/auth/AuthScreen.jsx';
import { HomeScreen } from './features/home/HomeScreen.jsx';
import { SettingsScreen } from './features/settings/SettingsScreen.jsx';
import { PrivacyScreen } from './features/settings/PrivacyScreen.jsx';
import { ChatScreen } from './features/chat/ChatScreen.jsx';
import { ChatConversationScreen } from './features/chat/ChatConversationScreen.jsx';
import { CommunityChannelScreen } from './features/community/CommunityChannelScreen.jsx';
import { WeatherScreen } from './features/weather/WeatherScreen.jsx';
import { WallpaperScreen } from './features/wallpaper/WallpaperScreen.jsx';
import { WallpaperDetailScreen } from './features/wallpaper/WallpaperDetailScreen.jsx';
import { WallpaperFavoritesScreen } from './features/wallpaper/WallpaperFavoritesScreen.jsx';
import { RingtonesScreen } from './features/ringtones/RingtonesScreen.jsx';
import { RingtoneFavoritesScreen } from './features/ringtones/RingtoneFavoritesScreen.jsx';
import { QuotesScreen } from './features/quotes/QuotesScreen.jsx';
import { QuoteEditorScreen } from './features/quotes/QuoteEditorScreen.jsx';
import { MoviesScreen } from './features/movies/MoviesScreen.jsx';
import { MovieDetailScreen } from './features/movies/MovieDetailScreen.jsx';
import { MoviePlayerScreen } from './features/movies/MoviePlayerScreen.jsx';
import { TvDetailScreen } from './features/movies/TvDetailScreen.jsx';
import { TvPlayerScreen } from './features/movies/TvPlayerScreen.jsx';
import { MusicScreen } from './features/music/MusicScreen.jsx';
import { AudioTrimmerScreen } from './features/audio/AudioTrimmerScreen.jsx';
import { VideosScreen } from './features/videos/VideosScreen.jsx';
import { VideoEditorScreen } from './features/videos/VideoEditorScreen.jsx';
import { FeatureStub } from './features/_stub/FeatureStub.jsx';

export default function App() {
  return (
    <YoloThemeProvider>
      <UserSessionProvider>
        <AppConfigProvider>
          <AppBackground>
            <AppRoutes />
          </AppBackground>
        </AppConfigProvider>
      </UserSessionProvider>
    </YoloThemeProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={routes.auth} element={<AuthScreen />} />

      {/* All authed routes share the AppShell (TopBar + main area). The
          layout route also handles the auth guard once, instead of every
          leaf re-checking. */}
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path={routes.home} element={<HomeScreen />} />
        <Route path={routes.settings} element={<SettingsScreen />} />
        <Route path={routes.privacy} element={<PrivacyScreen />} />

        <Route path={routes.movies} element={<MoviesScreen />} />
        <Route path={routes.movieDetailPattern} element={<MovieDetailScreen />} />
        <Route path={routes.moviePlayerPattern} element={<MoviePlayerScreen />} />
        <Route path={routes.tvDetailPattern} element={<TvDetailScreen />} />
        <Route path={routes.tvPlayerPattern} element={<TvPlayerScreen />} />
        <Route path={routes.music} element={<MusicScreen />} />
        <Route path={routes.chat} element={<ChatScreen />} />
        <Route path={routes.chatConversationPattern} element={<ChatConversationScreen />} />
        <Route path={routes.weather} element={<WeatherScreen />} />
        <Route path={routes.wallpaper} element={<WallpaperScreen />} />
        <Route path={routes.wallpaperFavorites} element={<WallpaperFavoritesScreen />} />
        <Route path={routes.wallpaperDetailPattern} element={<WallpaperDetailScreen />} />
        <Route path={routes.quotes} element={<QuotesScreen />} />
        <Route path={routes.quoteEditor} element={<QuoteEditorScreen />} />
        <Route path={routes.ringtones} element={<RingtonesScreen />} />
        <Route path={routes.ringtoneFavorites} element={<RingtoneFavoritesScreen />} />
        <Route path={routes.audioTrimmer} element={<AudioTrimmerScreen />} />
        <Route path={routes.videos} element={<VideosScreen />} />
        <Route path={routes.videoEditorPattern} element={<VideoEditorScreen />} />
        <Route path={routes.wifiLab} element={<FeatureStub title="Wi-Fi Lab" androidOnly />} />
        <Route path={routes.community} element={<CommunityChannelScreen />} />

        <Route path="*" element={<Navigate to={routes.home} replace />} />
      </Route>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useCurrentUser();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to={routes.auth} replace state={{ from: location }} />;
  return children;
}

function FullPageSpinner() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
    </Box>
  );
}
