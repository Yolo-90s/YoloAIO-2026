import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Stack } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { movieEmbedUrl } from './vidkingPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';

export function MoviePlayerScreen() {
  const { movieId } = useParams();
  const { initialSeconds } = useWatchProgress({ tmdbId: movieId, mediaType: 'movie' });

  // Wait for the saved position before mounting the iframe so vidking
  // picks up the `progress=` query param and resumes from there.
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
          aspectRatio: '16 / 9',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        <Box
          component="iframe"
          src={src}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </Box>
    </FeatureScaffold>
  );
}
