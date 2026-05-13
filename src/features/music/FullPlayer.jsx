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
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { CircularBeatVisualizer } from './CircularBeatVisualizer.jsx';
import { formatTrackDuration } from './jiosaavnClient.js';

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
  isFavorite,
  onToggleFavorite,
}) {
  const track = player.track;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100vw', sm: 440, md: 480 },
            background:
              'linear-gradient(180deg, rgba(28,16,48,0.96) 0%, rgba(10,6,20,0.98) 100%)',
            backdropFilter: 'blur(24px)',
            color: 'text.primary',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          },
        },
      }}
    >
      <Stack sx={{ height: '100%', p: { xs: 2.5, sm: 3 } }} spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1.2, fontWeight: 600 }}>
            NOW PLAYING
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'text.primary', mr: -0.5 }} aria-label="Close">
            <CloseIcon />
          </IconButton>
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
            <Stack alignItems="center" sx={{ flex: 1, justifyContent: 'center' }}>
              <ArtworkRing track={track} isPlaying={player.isPlaying} />
              <Stack spacing={0.5} alignItems="center" sx={{ textAlign: 'center', mt: 4, px: 2, width: '100%' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
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

            <Stack direction="row" alignItems="center" justifyContent="center" spacing={3}>
              {onToggleFavorite && (
                <IconButton
                  onClick={onToggleFavorite}
                  sx={{ color: isFavorite ? 'primary.main' : 'text.secondary' }}
                  aria-label="Favorite"
                >
                  {isFavorite ? <BookmarkIcon /> : <BookmarkBorderIcon />}
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
              {/* Symmetry placeholder so the play button sits centered */}
              {onToggleFavorite && <Box sx={{ width: 40 }} />}
            </Stack>
          </>
        )}
      </Stack>
    </Drawer>
  );
}

function ArtworkRing({ track, isPlaying }) {
  // The circular visualizer wraps a rotating album disc. The art rotates
  // slowly while playing — a small detail that sells the "vinyl" feel
  // without being distracting.
  return (
    <Box sx={{ position: 'relative', width: { xs: 280, sm: 320 }, height: { xs: 280, sm: 320 } }}>
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <CircularBeatVisualizer
          size={320}
          innerRadius={110}
          active={isPlaying}
        />
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
            width: 200,
            height: 200,
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
