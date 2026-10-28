import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { tvEmbedUrl } from './movieEmbedPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';
import { parsePlayerEvent } from './watchProgressRepository.js';
import { PlayerCastButton } from './PlayerCastButton.jsx';

// See MoviePlayerScreen — same stall-timeout rationale.
const STALL_TIMEOUT_MS = 15000;

export function TvPlayerScreen() {
  const { tvId, season, episode } = useParams();
  const { initialSeconds } = useWatchProgress({ tmdbId: tvId, mediaType: 'tv' });

  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'stalled'
  const [retryNonce, setRetryNonce] = useState(0);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);

  useEffect(() => {
    setLoadState('loading');
    setHasPlaybackStarted(false);
  }, [tvId, season, episode]);

  useEffect(() => {
    function handler(e) {
      const ev = parsePlayerEvent(e.data);
      if (ev && (ev.name === 'play' || ev.name === 'timeupdate')) {
        setHasPlaybackStarted(true);
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const timer = setTimeout(() => {
      setHasPlaybackStarted((started) => {
        if (!started) setLoadState('stalled');
        return started;
      });
    }, STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loadState, retryNonce]);

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

  function handleRetry() {
    setHasPlaybackStarted(false);
    setLoadState('loading');
    setRetryNonce((n) => n + 1);
  }

  return (
    <FeatureScaffold title={`S${season} · E${episode}`}>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          borderRadius: { xs: 0, sm: '16px' },
          overflow: 'hidden',
          backgroundColor: '#000',
          mx: { xs: -2, sm: 0 },
        }}
      >
        <Box
          key={retryNonce}
          component="iframe"
          src={src}
          onLoad={() => setLoadState('ready')}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          // See MoviePlayerScreen — blocks popup/popunder ads and top-level
          // navigation hijacks via the iframe sandbox mechanism.
          sandbox="allow-scripts allow-same-origin allow-forms allow-fullscreen"
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
        {(loadState === 'loading' || (loadState === 'ready' && !hasPlaybackStarted)) && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            <CircularProgress sx={{ color: '#fff' }} />
          </Box>
        )}
        {loadState === 'stalled' && (
          <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ position: 'absolute', inset: 0, backgroundColor: '#000', px: 3, textAlign: 'center' }}
          >
            <Typography variant="subtitle1" sx={{ color: '#fff' }}>
              This title isn't available right now
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              It may just be a temporary gap in this source — try again, or come back later.
            </Typography>
            <Button variant="contained" onClick={handleRetry}>
              Retry
            </Button>
          </Stack>
        )}
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <PlayerCastButton />
        </Box>
      </Box>
    </FeatureScaffold>
  );
}
