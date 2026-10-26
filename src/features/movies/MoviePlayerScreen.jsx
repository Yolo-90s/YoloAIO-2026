import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { movieEmbedUrl, fallbackMovieEmbedUrl } from './movieEmbedPlayer.js';
import { useWatchProgress } from './useWatchProgress.js';
import { parsePlayerEvent } from './watchProgressRepository.js';
import { PlayerCastButton } from './PlayerCastButton.jsx';

// How long we wait, once the iframe has loaded, for a real play/timeupdate
// postMessage before treating the source as stalled (page up, video never
// actually starts — vidlink.pro's per-title gap, not a load failure).
const STALL_TIMEOUT_MS = 15000;

export function MoviePlayerScreen() {
  const { movieId } = useParams();
  const { initialSeconds } = useWatchProgress({ tmdbId: movieId, mediaType: 'movie' });

  const [usingFallback, setUsingFallback] = useState(false);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'stalled'
  const [retryNonce, setRetryNonce] = useState(0);
  const hasPlaybackStartedRef = useRef(false);

  useEffect(() => {
    setUsingFallback(false);
    setLoadState('loading');
    hasPlaybackStartedRef.current = false;
  }, [movieId]);

  // The embed player posts PLAYER_EVENT messages regardless of which
  // provider is loaded — this just watches for the first real play signal,
  // independent of useWatchProgress's own (throttled) persistence listener.
  useEffect(() => {
    function handler(e) {
      const ev = parsePlayerEvent(e.data);
      if (ev && (ev.name === 'play' || ev.name === 'timeupdate')) {
        hasPlaybackStartedRef.current = true;
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const timer = setTimeout(() => {
      if (!hasPlaybackStartedRef.current) setLoadState('stalled');
    }, STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loadState, usingFallback, retryNonce]);

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

  const src = usingFallback
    ? fallbackMovieEmbedUrl({ tmdbId: movieId })
    : movieEmbedUrl({ tmdbId: movieId, progressSeconds: initialSeconds || null });

  function handleTryAnotherSource() {
    hasPlaybackStartedRef.current = false;
    setLoadState('loading');
    if (usingFallback) {
      setRetryNonce((n) => n + 1);
    } else {
      setUsingFallback(true);
    }
  }

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
          key={`${src}-${retryNonce}`}
          component="iframe"
          src={src}
          onLoad={() => setLoadState('ready')}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
        {loadState === 'loading' && (
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
              This title isn't playing on this source
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {usingFallback ? 'Still not available right now — try again later.' : "Let's try another source."}
            </Typography>
            <Button variant="contained" onClick={handleTryAnotherSource}>
              {usingFallback ? 'Retry' : 'Try another source'}
            </Button>
          </Stack>
        )}
        {/* Floating Cast button — overlays the iframe. Hidden on
            browsers without Cast support (Firefox / Safari). */}
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <PlayerCastButton />
        </Box>
      </Box>
    </FeatureScaffold>
  );
}
