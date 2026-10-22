import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Stack } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { tvEmbedUrl } from './movieEmbedPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';
import { PlayerCastButton } from './PlayerCastButton.jsx';

export function TvPlayerScreen() {
  const { tvId, season, episode } = useParams();
  const { initialSeconds } = useWatchProgress({ tmdbId: tvId, mediaType: 'tv' });

  if (initialSeconds === null) {
    return (
      <FeatureScaffold title={`S${season} · E${episode}`}>
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      </FeatureScaffold>
    );
  }

  const src = tvEmbedUrl({
    tmdbId: tvId,
    season: Number(season),
    episode: Number(episode),
    progressSeconds: initialSeconds || null,
  });

  return (
    <FeatureScaffold title={`S${season} · E${episode}`}>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          borderRadius: { xs: 0, sm: '16px' },
          overflow: 'hidden',
          backgroundColor: '#000',
          // FeatureScaffold's content box has side padding (px: 2 = 16px on
          // mobile) — cancel it out here so the player goes edge-to-edge on
          // phones instead of sitting in a shrunken, visibly inset box.
          mx: { xs: -2, sm: 0 },
        }}
      >
        <Box
          component="iframe"
          src={src}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <PlayerCastButton />
        </Box>
      </Box>
    </FeatureScaffold>
  );
}
