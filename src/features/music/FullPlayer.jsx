import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOneIcon from '@mui/icons-material/RepeatOne';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CloseSmallIcon from '@mui/icons-material/Close';
import { CircularBeatVisualizer } from './CircularBeatVisualizer.jsx';
import { formatTrackDuration } from './jiosaavnClient.js';
import { REPEAT_ALL, REPEAT_ONE, REPEAT_OFF } from './musicPlayer.js';
import { CastButton } from './CastButton.jsx';
import { subscribeCast } from './castManager.js';
import { useEffect, useState } from 'react';

// Right-side "Now Playing" panel that slides in over the page. The
// circular beat visualizer wraps the album art; everything else (title,
// scrubber, play/pause) sits underneath. On phones the Drawer goes full
// width — the desktop look stays at 420px.
export function FullPlayer({
  open,
  onClose,
  player,
  onToggle,
  onSeek,
  onNext,
  onPrevious,
  onCycleRepeat,
  onToggleShuffle,
  onRemoveFromPlayNext,
  isFavorite,
  onToggleFavorite,
}) {
  const track = player.track;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // Sit below the sticky TopBar (64px) instead of overlaying it, so the
      // app's navigation stays accessible while Now Playing is open.
      // zIndex < AppBar's default (1100) so the TopBar visually wins.
      sx={{ zIndex: 1050 }}
      slotProps={{
        backdrop: {
          sx: {
            top: 64,
            zIndex: 1050,
          },
        },
        paper: {
          sx: {
            top: 64,
            height: 'calc(100dvh - 64px)',
            width: { xs: '100vw', sm: 440, md: 480 },
            background:
              'linear-gradient(180deg, rgba(28,16,48,0.96) 0%, rgba(10,6,20,0.98) 100%)',
            backdropFilter: 'blur(24px)',
            color: 'text.primary',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.45)',
          },
        },
      }}
    >
      <Stack
        sx={{
          height: '100%',
          p: { xs: 2, sm: 2.5 },
          // Fall back to vertical scroll only when content genuinely
          // can't fit (e.g. short laptop with Up Next + every control
          // showing). Artwork shrinks first via the responsive sizing
          // below.
          overflowY: 'auto',
          minHeight: 0,
        }}
        spacing={1.5}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1.2, fontWeight: 600 }}>
              NOW PLAYING
            </Typography>
            <CastingBadge />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <CastButton size="small" />
            <IconButton onClick={onClose} sx={{ color: 'text.primary' }} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>

        {!track ? (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, textAlign: 'center' }} spacing={1.5}>
            <MusicNoteIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Nothing playing yet.
            </Typography>
          </Stack>
        ) : (
          <>
            <Stack alignItems="center" sx={{ justifyContent: 'center', flexShrink: 0 }}>
              <ArtworkRing track={track} isPlaying={player.isPlaying} />
              <Stack spacing={0.25} alignItems="center" sx={{ textAlign: 'center', mt: 2, px: 2, width: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {track.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {track.artist}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ px: 0.5 }}>
              <Slider
                value={Math.min(player.positionSec || 0, player.durationSec || 0)}
                max={player.durationSec || 1}
                onChange={(_, v) => onSeek(v)}
                size="small"
                sx={{
                  color: 'primary.main',
                  '& .MuiSlider-thumb': { width: 12, height: 12 },
                }}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {formatTrackDuration(player.positionSec)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTrackDuration(player.durationSec)}
                </Typography>
              </Stack>
            </Box>

            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5}>
              {onToggleShuffle && (
                <IconButton
                  onClick={onToggleShuffle}
                  sx={{ color: player.shuffleEnabled ? 'primary.main' : 'text.secondary' }}
                  aria-label="Shuffle"
                >
                  <ShuffleIcon />
                </IconButton>
              )}
              {onPrevious && (
                <IconButton
                  onClick={onPrevious}
                  sx={{ color: 'text.primary' }}
                  aria-label="Previous"
                  disabled={(player.queue?.length ?? 0) <= 1}
                >
                  <SkipPreviousIcon sx={{ fontSize: 36 }} />
                </IconButton>
              )}
              <IconButton
                onClick={onToggle}
                sx={{
                  width: 72,
                  height: 72,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  boxShadow: '0 12px 32px rgba(255,102,212,0.35)',
                }}
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isLoading ? (
                  <CircularProgress size={28} color="inherit" />
                ) : player.isPlaying ? (
                  <PauseIcon sx={{ fontSize: 36 }} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 36 }} />
                )}
              </IconButton>
              {onNext && (
                <IconButton
                  onClick={onNext}
                  sx={{ color: 'text.primary' }}
                  aria-label="Next"
                  disabled={
                    (player.queue?.length ?? 0) <= 1 &&
                    (player.playNext?.length ?? 0) === 0
                  }
                >
                  <SkipNextIcon sx={{ fontSize: 36 }} />
                </IconButton>
              )}
              {onCycleRepeat && (
                <IconButton
                  onClick={onCycleRepeat}
                  sx={{ color: player.repeatMode !== REPEAT_OFF ? 'primary.main' : 'text.secondary' }}
                  aria-label="Repeat mode"
                >
                  {player.repeatMode === REPEAT_ONE ? <RepeatOneIcon /> : <RepeatIcon />}
                </IconButton>
              )}
            </Stack>

            {onToggleFavorite && (
              <Stack direction="row" justifyContent="center">
                <IconButton
                  onClick={onToggleFavorite}
                  sx={{ color: isFavorite ? 'primary.main' : 'text.secondary' }}
                  aria-label="Favorite"
                >
                  {isFavorite ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                </IconButton>
              </Stack>
            )}

            {(player.playNext?.length ?? 0) > 0 && (
              <UpNextList
                tracks={player.playNext}
                onRemove={onRemoveFromPlayNext}
              />
            )}
          </>
        )}
      </Stack>
    </Drawer>
  );
}

function CastingBadge() {
  const [cast, setCast] = useState({ isConnected: false, deviceName: null });
  useEffect(() => subscribeCast(setCast), []);
  if (!cast.isConnected) return null;
  return (
    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
      Casting to {cast.deviceName || 'device'}
    </Typography>
  );
}

function UpNextList({ tracks, onRemove }) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1.2, fontWeight: 600 }}>
        UP NEXT · {tracks.length}
      </Typography>
      <Stack
        sx={{
          maxHeight: 200,
          overflowY: 'auto',
          borderRadius: '12px',
          backgroundColor: 'rgba(255,255,255,0.04)',
          p: 1,
        }}
        spacing={0.5}
      >
        {tracks.map((track) => (
          <Stack
            key={track.id}
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{ px: 1, py: 0.75, borderRadius: '8px' }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.08)',
                flexShrink: 0,
              }}
            >
              {track.artworkUrlSmall ? (
                <Box
                  component="img"
                  src={track.artworkUrlSmall}
                  alt=""
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : null}
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {track.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {track.artist}
              </Typography>
            </Stack>
            {onRemove && (
              <IconButton
                size="small"
                onClick={() => onRemove(track.id)}
                sx={{ color: 'text.secondary' }}
                aria-label="Remove"
              >
                <CloseSmallIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function ArtworkRing({ track, isPlaying }) {
  // The circular visualizer wraps a rotating album disc. The art rotates
  // slowly while playing — a small detail that sells the "vinyl" feel
  // without being distracting.
  //
  // Size scales with the viewport height (`min(38vh, 280px)`) so on short
  // laptops the controls below stay above the fold without scrolling.
  // The visualizer now auto-fits its parent, so both layers share the
  // exact same square and stay centered.
  const ringSize = 'min(38vh, 280px)';
  return (
    <Box sx={{ position: 'relative', width: ringSize, height: ringSize }}>
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <CircularBeatVisualizer active={isPlaying} />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '62%',
            height: '62%',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(184,90,193,0.45)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            animation: isPlaying ? 'spinArt 18s linear infinite' : 'none',
            '@keyframes spinArt': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
          }}
        >
          {track.artworkUrlLarge || track.artworkUrlSmall ? (
            <Box
              component="img"
              src={track.artworkUrlLarge || track.artworkUrlSmall}
              alt={track.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ width: '100%', height: '100%', color: 'text.secondary' }}
            >
              <MusicNoteIcon sx={{ fontSize: 56 }} />
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
