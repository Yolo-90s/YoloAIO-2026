import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import ForumIcon from '@mui/icons-material/Forum';
import CloudIcon from '@mui/icons-material/Cloud';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import WifiIcon from '@mui/icons-material/Wifi';
import GroupsIcon from '@mui/icons-material/Groups';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import SettingsVoiceIcon from '@mui/icons-material/SettingsVoice';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { useCurrentUser } from '../../data/UserSession.jsx';
import { routes } from '../../routes.js';
import { BentoTile } from '../../ui/Bento.jsx';

const ALL_TILES = [
  { key: 'movies', title: 'Movies', tagline: 'Stream anywhere, instantly', icon: MovieIcon, route: routes.movies, accent: ['#7C9CFF', '#1A237E'] },
  { key: 'music', title: 'Music', tagline: 'Your library', icon: LibraryMusicIcon, route: routes.music, accent: ['#FF9F73', '#E65100'] },
  { key: 'chat', title: 'Chat', tagline: 'Conversations', icon: ForumIcon, route: routes.chat, accent: ['#5A8DEE', '#3F61C7'] },
  { key: 'weather', title: 'Weather', tagline: 'Right where you are', icon: CloudIcon, route: routes.weather, accent: ['#4FC3F7', '#1565C0'] },
  { key: 'wallpaper', title: 'Wallpaper', tagline: 'Beautify', icon: WallpaperIcon, route: routes.wallpaper, accent: ['#00BFA5', '#1B5E20'] },
  { key: 'quotes', title: 'Quotes', tagline: 'Daily wisdom', icon: FormatQuoteIcon, route: routes.quotes, accent: ['#FFC36B', '#AD1457'] },
  { key: 'ringtones', title: 'Ringtones', tagline: 'Tones for every mood', icon: MusicNoteIcon, route: routes.ringtones, accent: ['#E0AAFF', '#6A1B9A'] },
  { key: 'audio', title: 'Audio Trimmer', tagline: 'Cut & save', icon: ContentCutIcon, route: routes.audioTrimmer, accent: ['#FF7AB6', '#B85AC1'] },
  { key: 'wifi_lab', title: 'Wi-Fi Lab', tagline: 'Concept demo · educational', icon: WifiIcon, route: routes.wifiLab, accent: ['#00E5A8', '#004D40'] },
  { key: 'community', title: 'Community', tagline: 'Open channel · all members', icon: GroupsIcon, route: routes.community, accent: ['#FFC36B', '#B85AC1'] },
  { key: 'videos', title: 'Videos', tagline: 'Edit & share from Drive', icon: VideoLibraryIcon, route: routes.videos, accent: ['#7AD0FF', '#0D47A1'] },
  { key: 'books', title: 'Books', tagline: 'Free classics · read anywhere', icon: MenuBookIcon, route: routes.books, accent: ['#FFB088', '#5D4037'] },
  { key: 'beat_analyser', title: 'Beat Analyser', tagline: 'Noise meter · disco lights', icon: EqualizerIcon, route: routes.beatAnalyser, accent: ['#42E6B4', '#311B92'] },
  { key: 'walkie_talkie', title: 'Walkie Talkie', tagline: 'Live voice · push to talk', icon: SettingsVoiceIcon, route: routes.walkieTalkie, accent: ['#66BB6A', '#1B5E20'] },
  { key: 'style_yourself', title: 'Style Yourself', tagline: 'Find your perfect hairstyle', icon: FaceRetouchingNaturalIcon, route: routes.styleYourself, accent: ['#FF7AB6', '#5B259F'] },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const { user } = useCurrentUser();

  const tiles = useMemo(
    () =>
      ALL_TILES.filter((t) => {
        if (t.key === 'music') return config.showMusicMenu;
        if (t.key === 'movies') return config.showMoviesMenu;
        if (t.key === 'wallpaper') return config.showWallpapersMenu;
        if (t.key === 'weather') return config.showWeatherMenu;
        if (t.key === 'videos') return config.showVideosMenu;
        if (t.key === 'books') return config.showBooksMenu;
        if (t.key === 'beat_analyser') return config.showBeatAnalyserMenu;
        if (t.key === 'walkie_talkie') return config.showWalkieTalkieMenu;
        if (t.key === 'style_yourself') return config.showStyleYourselfMenu;
        return true;
      }),
    [config]
  );

  const firstName = (user?.displayName?.trim() || 'Friend').split(' ')[0];
  const greeting = greetingFor(new Date().getHours());

  return (
    <Box sx={{ width: '100%', px: { xs: 2.5, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={0.25} sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.4px' }}>
          {greeting},
        </Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '2.75rem' }, lineHeight: 1.1 }}>
          {firstName}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          // Adaptive density — as many ~220px tiles fit per row at any
          // width. The hero (first child) spans 2 columns.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
          gap: { xs: 1.75, md: 2.25 },
        }}
      >
        {tiles[0] && (
          <BentoTile
            title={tiles[0].title}
            tagline={tiles[0].tagline}
            icon={tiles[0].icon}
            accent={tiles[0].accent}
            onClick={() => navigate(tiles[0].route)}
            hero
            index={0}
          />
        )}
        {tiles.slice(1).map((tile, i) => (
          <BentoTile
            key={tile.key}
            title={tile.title}
            tagline={tile.tagline}
            icon={tile.icon}
            accent={tile.accent}
            onClick={() => navigate(tile.route)}
            index={i + 1}
          />
        ))}
      </Box>
    </Box>
  );
}

function greetingFor(hour) {
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 16) return 'Good afternoon';
  if (hour >= 17 && hour <= 20) return 'Good evening';
  return 'Good night';
}
