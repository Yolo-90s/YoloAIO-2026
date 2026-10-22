import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Stack } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { movieEmbedUrl } from './movieEmbedPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';
import { PlayerCastButton } from './PlayerCastButton.jsx';

export function MoviePlayerScreen() {
  const { movieId } = useParams();
  const { initialSeconds } = useWatchProgress({ tmdbId: movieId, mediaType: 'movie' });

  // Wait for the saved position before mounting the iframe so the embed
  // player picks up the `startAt` query param and resumes from there.
  if (initialSeconds === null) {
    return (
      <FeatureScaffold title="Now playing">
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      </FeatureScaffold>
    );
  }

  const src = movieEmbedUrl({
    tmdbId: movieId,
    progressSeconds: initialSeconds || null,
  });

  return (
    <FeatureScaffold title="Now playing">
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
        {/* Floating Cast button — overlays the iframe. Hidden on
            browsers without Cast support (Firefox / Safari). */}
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <PlayerCastButton />
        </Box>
      </Box>
    </FeatureScaffold>
  );
}
