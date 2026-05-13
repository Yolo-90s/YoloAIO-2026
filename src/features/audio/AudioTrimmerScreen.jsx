import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';

// Mirror of AudioTrimmer.kt — pick an audio file, draw a waveform, drag
// two handles to select a range, preview, and download as WAV.
//
// We drop the JioSaavn search source from the Android version because
// remote streams need a server-side download to avoid CORS issues — the
// local-file path covers the main "trim a clip for a ringtone" use case.

export function AudioTrimmerScreen() {
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const stopTimerRef = useRef(0);
  const [fileName, setFileName] = useState('');
  const [buffer, setBuffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState([0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close?.();
      clearTimeout(stopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!buffer) return;
    drawWaveform(canvasRef.current, buffer, range);
  }, [buffer, range]);

  const ensureCtx = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AC();
    return audioCtxRef.current;
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setFileName(file.name);
    stopPlayback();
    try {
      const arr = await file.arrayBuffer();
      const ctx = ensureCtx();
      const decoded = await ctx.decodeAudioData(arr);
      setBuffer(decoded);
      setRange([0, decoded.duration]);
    } catch (e) {
      setError(`Couldn't decode "${file.name}". The browser can only decode formats it natively plays (mp3, wav, ogg, m4a).`);
      setBuffer(null);
    } finally {
      setLoading(false);
    }
  };

  const startPlayback = () => {
    if (!buffer) return;
    stopPlayback();
    const ctx = ensureCtx();
    ctx.resume?.();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const [start, end] = range;
    const duration = Math.max(0.05, end - start);
    src.start(0, start, duration);
    src.onended = () => setIsPlaying(false);
    sourceRef.current = src;
    setIsPlaying(true);
    // Backup stop in case onended doesn't fire (some Safari versions).
    stopTimerRef.current = setTimeout(stopPlayback, (duration + 0.1) * 1000);
  };

  const stopPlayback = () => {
    clearTimeout(stopTimerRef.current);
    const src = sourceRef.current;
    if (src) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (!buffer) return;
    const [start, end] = range;
    const trimmed = sliceBuffer(buffer, start, end);
    const wav = encodeWav(trimmed);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = (fileName || 'trim').replace(/\.[^.]+$/, '');
    a.download = `${base}-${Math.round(start * 1000)}-${Math.round(end * 1000)}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <FeatureScaffold title="Audio Trimmer">
      <GlassCard contentPadding={3}>
        <Stack spacing={2}>
          <Box>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                sx={{ borderRadius: '14px' }}
              >
                Choose audio
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileName || 'Pick an mp3/wav/m4a clip to trim.'}
              </Typography>
            </Stack>
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          ) : buffer ? (
            <>
              <Box
                sx={{
                  width: '100%',
                  height: 140,
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                }}
              >
                <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
              </Box>

              <Box sx={{ px: 1 }}>
                <Slider
                  value={range}
                  min={0}
                  max={buffer.duration}
                  step={0.01}
                  onChange={(_, v) => {
                    if (Array.isArray(v)) setRange(v);
                  }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => formatTime(v)}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(range[0])}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Selection: {formatTime(Math.max(0, range[1] - range[0]))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(range[1])}
                  </Typography>
                </Stack>
              </Box>

              <Stack direction="row" spacing={1.5}>
                <IconButton
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  sx={{
                    width: 52,
                    height: 52,
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { backgroundColor: 'primary.dark' },
                  }}
                >
                  {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
                </IconButton>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleSave}
                  sx={{ borderRadius: '14px' }}
                >
                  Save WAV
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Browsers can't write a ringtone to your phone — save the WAV and copy it across, or convert to MP3 with any free tool first.
              </Typography>
            </>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Pick an audio file above to begin. The waveform and the range handles will appear here.
              </Typography>
            </Box>
          )}
        </Stack>
      </GlassCard>
    </FeatureScaffold>
  );
}

// ── Waveform drawing ─────────────────────────────────────────────────────

function drawWaveform(canvas, buffer, range) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Render the selected range with a brighter fill, the rest dimmed.
  const total = buffer.duration;
  const startX = (range[0] / total) * w;
  const endX = (range[1] / total) * w;

  drawChannel(ctx, buffer, 0, w, h, 'rgba(255,255,255,0.18)');
  ctx.save();
  ctx.beginPath();
  ctx.rect(startX, 0, Math.max(2, endX - startX), h);
  ctx.clip();
  drawChannel(ctx, buffer, 0, w, h, '#FF66D4');
  ctx.restore();

  // Range edges
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(startX - 1, 0, 2, h);
  ctx.fillRect(endX - 1, 0, 2, h);
}

function drawChannel(ctx, buffer, x0, w, h, color) {
  const channel = buffer.getChannelData(0);
  const samples = channel.length;
  const step = Math.max(1, Math.floor(samples / w));
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  const mid = h / 2;
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    let min = 1;
    let max = -1;
    const start = i * step;
    const end = Math.min(samples, start + step);
    for (let j = start; j < end; j++) {
      const v = channel[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const yMin = mid - min * mid * 0.95;
    const yMax = mid - max * mid * 0.95;
    ctx.moveTo(x0 + i + 0.5, yMin);
    ctx.lineTo(x0 + i + 0.5, yMax);
  }
  ctx.stroke();
}

// ── WAV encoder ──────────────────────────────────────────────────────────
// Encodes an AudioBuffer slice as a 16-bit PCM WAV — no external library
// needed. Good enough for the trim-then-share use case.

function sliceBuffer(buffer, startSec, endSec) {
  const sampleRate = buffer.sampleRate;
  const start = Math.floor(startSec * sampleRate);
  const end = Math.floor(endSec * sampleRate);
  const len = Math.max(0, end - start);
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
  const out = ctx.createBuffer(buffer.numberOfChannels, len, sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end));
  }
  ctx.close?.();
  return out;
}

function encodeWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const headerSize = 44;
  const out = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(out);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bit depth
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return out;
}

function writeString(view, offset, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00.00';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
