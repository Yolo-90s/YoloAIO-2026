import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Stack } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { tvEmbedUrl } from './vidkingPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';

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
