import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  IconButton,
  LinearProgress,
  MenuItem,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import IosShareIcon from '@mui/icons-material/IosShare';
import DownloadIcon from '@mui/icons-material/Download';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import {
  formatVideoDuration,
  listVideos,
  streamUrlFor,
} from './driveVideosClient.js';
import {
  exportAudio,
  exportClip,
  getSupportedAudioMime,
  getSupportedVideoMime,
  shareOrDownload,
} from './videoExporter.js';
import { routes } from '../../routes.js';

const SPEEDS = [0.5, 1, 1.5, 2];
const OVERLAY_POSITIONS = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];
const OVERLAY_COLORS = ['#FFFFFF', '#FFEB3B', '#FF66D4', '#4CDDF7', '#66E07A', '#FF5252'];

export function VideoEditorScreen() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const config = useAppConfig();
  const videoRef = useRef(null);

  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);

  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState([0, 0]);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);

  const [overlayText, setOverlayText] = useState('');
  const [overlayPos, setOverlayPos] = useState('bottom');
  const [overlayColor, setOverlayColor] = useState('#FFFFFF');

  const [exporting, setExporting] = useState(null); // null | 'video' | 'audio'
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState(null);
  const [exportInfo, setExportInfo] = useState(null);

  const streamUrl = useMemo(() => {
    if (!config.videosApiBaseUrl || !videoId) return null;
    try { return streamUrlFor(config.videosApiBaseUrl, videoId); } catch { return null; }
  }, [config.videosApiBaseUrl, videoId]);

  // The list endpoint is the cheapest way to get this file's metadata
  // (name + thumbnail). For a curated folder of N videos this is one
  // call; if the catalog grows we'd add a /api/meta/{id} endpoint.
  useEffect(() => {
    if (!config.videosApiBaseUrl || !videoId) {
      setMetaLoading(false);
      return;
    }
    const ac = new AbortController();
    setMetaLoading(true);
    setMetaError(null);
    listVideos(config.videosApiBaseUrl, { signal: ac.signal })
      .then((vs) => {
        const found = vs.find((v) => v.id === videoId);
        if (!found) setMetaError('That video is no longer in the shared folder.');
        else setMeta(found);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setMetaError(e?.message || 'Failed to load video info.');
      })
      .finally(() => {
        if (!ac.signal.aborted) setMetaLoading(false);
      });
    return () => ac.abort();
  }, [config.videosApiBaseUrl, videoId]);

  // Once the <video> element exists, listen for the events we care about.
  // currentTime updates drive the scrub bar.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      const d = isFinite(v.duration) ? v.duration : (meta?.durationMs ?? 0) / 1000;
      setDuration(d);
      setRange([0, d]);
    };
    const onTime = () => {
      setPosition(v.currentTime);
      // Auto-stop at the trim end during preview playback.
      if (v.currentTime >= range[1] && !v.paused) {
        v.pause();
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
    // `range[1]` deliberately read inside onTime — re-binding on every
    // range change keeps the auto-stop accurate.
  }, [meta, range]);

  // Mirror UI toggles to the preview element. Doesn't affect export
  // (export uses its own hidden source).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.playbackRate = speed;
  }, [muted, speed]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // If position fell outside the trim range, snap back to start.
      if (v.currentTime < range[0] || v.currentTime >= range[1]) {
        v.currentTime = range[0];
      }
      v.play().catch(() => { /* user gesture issues surface via play()'s rejection */ });
    } else {
      v.pause();
    }
  };

  const onScrub = (_, v) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = v;
  };
  const onRangeChange = (_, v) => {
    if (!Array.isArray(v)) return;
    setRange(v);
    const el = videoRef.current;
    if (el && (el.currentTime < v[0] || el.currentTime > v[1])) {
      el.currentTime = v[0];
    }
  };

  const overlay = overlayText.trim()
    ? { text: overlayText.trim(), color: overlayColor, position: overlayPos, background: 'shadow' }
    : null;

  const trimSpan = Math.max(0, range[1] - range[0]);
  const canExport = streamUrl && trimSpan > 0.1 && !exporting;

  const runExport = async (kind) => {
    if (!streamUrl) return;
    setExporting(kind);
    setExportProgress(0);
    setExportError(null);
    setExportInfo(null);
    try {
      const base = sanitizeFilename(meta?.name || 'clip');
      const tag = `${Math.round(range[0])}-${Math.round(range[1])}${speed !== 1 ? `-${speed}x` : ''}`;
      if (kind === 'video') {
        const blob = await exportClip({
          sourceUrl: streamUrl,
          start: range[0],
          end: range[1],
          speed,
          muted,
          overlay,
          onProgress: setExportProgress,
        });
        const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
        const res = await shareOrDownload(blob, `${base}-${tag}.${ext}`);
        setExportInfo(buildExportMessage(res, blob));
      } else {
        const blob = await exportAudio({
          sourceUrl: streamUrl,
          start: range[0],
          end: range[1],
          speed,
          onProgress: setExportProgress,
        });
        const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const res = await shareOrDownload(blob, `${base}-${tag}.${ext}`);
        setExportInfo(buildExportMessage(res, blob));
      }
    } catch (e) {
      setExportError(e?.message || 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  const supportedVideo = useMemo(() => getSupportedVideoMime(), []);
  const supportedAudio = useMemo(() => getSupportedAudioMime(), []);

  if (!config.videosApiBaseUrl) {
    return (
      <FeatureScaffold title="Video Editor">
        <Alert severity="warning" variant="outlined" sx={{ borderRadius: '12px' }}>
          Videos proxy isn't configured. Set <code>videosApiBaseUrl</code> in Firestore{' '}
          <code>config/app</code>.
        </Alert>
      </FeatureScaffold>
    );
  }
  if (metaLoading) {
    return (
      <FeatureScaffold title="Video Editor">
        <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack>
      </FeatureScaffold>
    );
  }
  if (metaError) {
    return (
      <FeatureScaffold title="Video Editor">
        <Stack spacing={2}>
          <Alert severity="error" variant="outlined" sx={{ borderRadius: '12px' }}>
            {metaError}
          </Alert>
          <Button onClick={() => navigate(routes.videos)} sx={{ alignSelf: 'flex-start' }}>
            Back to videos
          </Button>
        </Stack>
      </FeatureScaffold>
    );
  }

  return (
    <FeatureScaffold title={meta?.name || 'Video Editor'} maxWidth={960}>
      <Stack spacing={2}>
        <GlassCard contentPadding={0} radius={2.5}>
          <Box sx={{ position: 'relative', backgroundColor: '#000' }}>
            <Box
              component="video"
              ref={videoRef}
              src={streamUrl}
              crossOrigin="anonymous"
              playsInline
              controls={false}
              sx={{
                display: 'block',
                width: '100%',
                maxHeight: '70vh',
                backgroundColor: '#000',
              }}
            />
          </Box>

          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <IconButton
                onClick={togglePlay}
                sx={{
                  width: 44,
                  height: 44,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { backgroundColor: 'primary.dark' },
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, textAlign: 'center' }}>
                {formatTime(position)}
              </Typography>
              <Slider
                value={Math.min(position, duration || 0)}
                max={duration || 1}
                step={0.05}
                onChange={onScrub}
                size="small"
                sx={{ flex: 1, color: 'primary.main' }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, textAlign: 'center' }}>
                {formatTime(duration)}
              </Typography>
              <IconButton
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute' : 'Mute'}
                sx={{ color: muted ? 'error.main' : 'text.secondary' }}
              >
                {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
            </Stack>
          </Box>
        </GlassCard>

        <GlassCard contentPadding={2.5}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Trim
              </Typography>
              <Slider
                value={range}
                min={0}
                max={duration || 1}
                step={0.05}
                onChange={onRangeChange}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => formatTime(v)}
                sx={{ color: 'primary.main' }}
                disabled={!duration}
              />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  In {formatTime(range[0])}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Selection {formatTime(trimSpan)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Out {formatTime(range[1])}
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Speed
              </Typography>
              <ToggleButtonGroup
                value={speed}
                exclusive
                onChange={(_, v) => v && setSpeed(v)}
                size="small"
                sx={{ '& .MuiToggleButton-root': { px: 2 } }}
              >
                {SPEEDS.map((s) => (
                  <ToggleButton key={s} value={s}>
                    {s}×
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Applies to both preview and export.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Text overlay
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder="Add a caption…"
                  size="small"
                  fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <TextField
                    select
                    label="Position"
                    value={overlayPos}
                    onChange={(e) => setOverlayPos(e.target.value)}
                    size="small"
                    sx={{ minWidth: 160 }}
                  >
                    {OVERLAY_POSITIONS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </TextField>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {OVERLAY_COLORS.map((c) => (
                      <Box
                        key={c}
                        onClick={() => setOverlayColor(c)}
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: c,
                          cursor: 'pointer',
                          outline: overlayColor === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  The overlay is baked into the exported video (it won't show in the live preview above).
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </GlassCard>

        <GlassCard contentPadding={2.5}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Export & share
            </Typography>
            {!supportedVideo && (
              <Alert severity="warning" variant="outlined" sx={{ borderRadius: '12px' }}>
                This browser can't record WebM. Try Chrome, Edge, or Firefox.
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<MovieFilterIcon />}
                onClick={() => runExport('video')}
                disabled={!canExport || !supportedVideo}
                sx={{ borderRadius: '14px', flex: 1 }}
              >
                {exporting === 'video' ? 'Rendering…' : 'Export video'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<AudiotrackIcon />}
                onClick={() => runExport('audio')}
                disabled={!canExport || !supportedAudio}
                sx={{ borderRadius: '14px', flex: 1 }}
              >
                {exporting === 'audio' ? 'Rendering…' : 'Export audio'}
              </Button>
            </Stack>

            {exporting && (
              <Box>
                <LinearProgress variant="determinate" value={exportProgress * 100} sx={{ borderRadius: 1 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {Math.round(exportProgress * 100)}% — recording in real time. A 30s clip at 1× takes ~30 seconds.
                </Typography>
              </Box>
            )}

            {exportError && (
              <Alert severity="error" variant="outlined" sx={{ borderRadius: '12px' }}>
                {exportError}
              </Alert>
            )}
            {exportInfo && (
              <Alert
                severity="success"
                variant="outlined"
                icon={exportInfo.shared ? <IosShareIcon /> : <DownloadIcon />}
                sx={{ borderRadius: '12px' }}
              >
                {exportInfo.message}
              </Alert>
            )}
          </Stack>
        </GlassCard>

        {meta && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'flex-end' }}>
            Source: {meta.name} · {formatVideoDuration(meta.durationMs) || formatTime(duration)}
          </Typography>
        )}
      </Stack>
    </FeatureScaffold>
  );
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const totalSec = Math.floor(sec);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sanitizeFilename(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_\s]+/gi, '').trim().replace(/\s+/g, '-') || 'clip';
}

function buildExportMessage(result, blob) {
  const sizeKb = Math.round(blob.size / 1024);
  const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
  if (result.shared) return { shared: true, message: `Shared (${sizeStr}).` };
  if (result.cancelled) return { shared: false, message: 'Share cancelled — try again or download instead.' };
  return { shared: false, message: `Downloaded (${sizeStr}). Your browser doesn't support sharing files directly.` };
}
