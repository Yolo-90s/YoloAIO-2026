import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CloseIcon from '@mui/icons-material/Close';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { getMicAnalyzer, useMicAnalyzer, BANDS } from './micAnalyzer.js';

const PALETTE = [
  '#FF0066', '#00FFFF', '#FFFF00', '#FF00FF',
  '#00FF66', '#FF6600', '#0066FF', '#FF3366',
  '#66FFCC', '#FFAA00', '#AA00FF', '#00CCFF',
  '#FF00AA', '#CCFF00', '#FF99CC', '#6600FF',
];

export function BeatAnalyserScreen() {
  const analyzer = getMicAnalyzer();
  const state = useMicAnalyzer();
  const [permission, setPermission] = useState('unknown'); // 'granted' | 'denied' | 'unknown'
  const [tab, setTab] = useState(0);

  // Auto-start the analyzer when the screen mounts. If the user denied
  // permission, show the prompt panel and let them retry.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await analyzer.start();
      if (!alive) return;
      setPermission(ok ? 'granted' : 'denied');
    })();
    return () => {
      alive = false;
      analyzer.stop();
    };
  }, [analyzer]);

  const requestMic = async () => {
    const ok = await analyzer.start();
    setPermission(ok ? 'granted' : 'denied');
  };

  // ── Full-screen disco branch — no FeatureScaffold chrome ────────
  if (permission === 'granted' && tab === 1) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000',
          zIndex: 1200, // above the app's TopBar (sticky AppBar is ~1100)
        }}
      >
        <DiscoCanvas state={state} />
        <IconButton
          onClick={() => setTab(0)}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
          }}
          aria-label="Exit disco"
        >
          <CloseIcon />
        </IconButton>
      </Box>
    );
  }

  return (
    <FeatureScaffold title="Beat Analyser" maxWidth={720}>
      {permission === 'denied' ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 6, textAlign: 'center' }}>
          <MicOffIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Microphone access needed
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
            Beat Analyser listens to ambient sound through your microphone to
            draw the noise level and react to beats. Audio is processed in
            memory only — never recorded or sent anywhere.
          </Typography>
          <Button
            variant="contained"
            startIcon={<MicIcon />}
            onClick={requestMic}
            sx={{ borderRadius: '14px' }}
          >
            Allow microphone
          </Button>
        </Stack>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Spectrum" />
            <Tab label="Disco" />
          </Tabs>
          {permission === 'unknown' ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <SpectrumBody state={state} />
          )}
        </>
      )}
    </FeatureScaffold>
  );
}

// ── Spectrum tab ────────────────────────────────────────────────────

function SpectrumBody({ state }) {
  return (
    <Stack spacing={3}>
      <NoiseMeter db={state.rmsDb} pulse={state.pulse} />
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Spectrum
        </Typography>
        <SpectrumBars bands={state.bandMagnitudes} pulse={state.pulse} />
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Beat tiles
        </Typography>
        <BeatTileGrid energies={state.bandEnergies} pulse={state.pulse} />
      </Box>
    </Stack>
  );
}

function NoiseMeter({ db, pulse }) {
  // Map -50 dBFS → 0%, 0 dBFS → 100%. Same scale as the Android side.
  const dbFloor = -50;
  const normalized = Math.max(0, Math.min(1, (db - dbFloor) / -dbFloor));
  const percent = Math.round(normalized * 100);
  const color =
    normalized < 0.4 ? '#00E5A8' :
    normalized < 0.75 ? '#FFC36B' :
    '#FF6E40';
  const loudnessLabel =
    db <= -45 ? 'Silent' :
    db <= -30 ? 'Quiet' :
    db <= -20 ? 'Conversation' :
    db <= -12 ? 'Loud' :
    db <= -6 ? 'Very loud' : 'Peak';

  const radius = 90;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius * 0.75; // 270° arc
  return (
    <Stack alignItems="center" sx={{ position: 'relative', py: 2 }}>
      <Box sx={{ position: 'relative', width: 240, height: 200 }}>
        <svg viewBox="0 0 240 200" width="100%" height="100%">
          <circle
            cx="120"
            cy="115"
            r={radius}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
            transform="rotate(135 120 115)"
            strokeLinecap="round"
          />
          <circle
            cx="120"
            cy="115"
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference * normalized} ${2 * Math.PI * radius}`}
            transform="rotate(135 120 115)"
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 80ms linear' }}
          />
          {pulse > 0.02 && (
            <circle
              cx="120"
              cy="115"
              r={radius + stroke}
              stroke={color}
              strokeWidth={stroke * 0.55}
              fill="none"
              strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
              transform="rotate(135 120 115)"
              strokeLinecap="round"
              opacity={0.35 * pulse}
            />
          )}
        </svg>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pt: 1,
          }}
        >
          <Stack direction="row" alignItems="flex-end">
            <Typography sx={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
              {percent}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 600, color: 'text.secondary', pb: 0.5, pl: 0.25 }}>
              %
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {db <= -45 ? 'Silent' : `${Math.round(db)} dBFS`}
          </Typography>
          <Typography variant="body2" sx={{ color, fontWeight: 600, mt: 0.5 }}>
            {loudnessLabel}
          </Typography>
        </Box>
      </Box>
    </Stack>
  );
}

function SpectrumBars({ bands, pulse }) {
  const canvasRef = useRef(null);
  const peaksRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const barCount = 48;

    if (!peaksRef.current || peaksRef.current.length !== barCount) {
      peaksRef.current = new Float32Array(barCount);
    }

    // Pre-compute log-spaced bin indices.
    const minBin = Math.max(1, BANDS.sub.start);
    const maxBin = BANDS.highs.end;
    const logMin = Math.log2(minBin);
    const logMax = Math.log2(maxBin);
    const binIndex = new Int32Array(barCount);
    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1);
      binIndex[i] = Math.floor(Math.pow(2, logMin + t * (logMax - logMin)));
    }

    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const gap = cssW * 0.005;
      const barW = (cssW - gap * (barCount - 1)) / barCount;
      const cornerR = barW / 2;
      const peaks = peaksRef.current;
      const data = bands;

      for (let i = 0; i < barCount; i++) {
        let raw;
        if (data) {
          const idx = Math.min(data.length - 1, binIndex[i]);
          raw = Math.min(1, data[idx]);
        } else {
          raw = 0.06 + Math.sin(performance.now() / 200 + i * 0.3) * 0.05;
        }
        // Perceptual sqrt + 12× gain — same trick as Android side.
        const boosted = Math.min(1, Math.sqrt(raw * 12));
        // Per-bar peak-hold: fast attack, slow release.
        const prev = peaks[i];
        peaks[i] = boosted > prev ? prev + (boosted - prev) * 0.55 : prev + (boosted - prev) * 0.08;
        const value = Math.max(0.04, Math.min(1, peaks[i] + pulse * 0.22));
        const barH = cssH * value;
        const x = i * (barW + gap);
        const y = cssH - barH;

        const grad = ctx.createLinearGradient(0, y, 0, cssH);
        grad.addColorStop(0, '#FF66D4');
        grad.addColorStop(1, '#7C9CFF');
        ctx.fillStyle = grad;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, barW, barH, Math.min(3, barW / 2));
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, barH);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bands, pulse]);

  return (
    <Box
      sx={{
        mt: 1,
        height: 120,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
    </Box>
  );
}

function BeatTileGrid({ energies, pulse }) {
  const rows = [
    ['SUB',  energies.sub],
    ['KICK', energies.kick],
    ['BASS', energies.bass],
    ['MIDS', energies.mids],
  ];
  const tilesPerRow = 6;
  return (
    <Stack spacing={0.75} sx={{ mt: 1 }}>
      {rows.map(([label, value]) => {
        const boosted = Math.min(1, Math.sqrt(value * 10));
        const lit = Math.floor(Math.min(1, boosted + pulse * 0.35) * tilesPerRow);
        return (
          <Stack key={label} direction="row" alignItems="center" spacing={0.75}>
            <Typography
              sx={{
                width: 44,
                fontSize: 10,
                fontWeight: 700,
                color: 'text.secondary',
              }}
            >
              {label}
            </Typography>
            {Array.from({ length: tilesPerRow }).map((_, idx) => {
              const isLit = idx < lit;
              const isFlash = idx === tilesPerRow - 1 && pulse > 0.05;
              const alpha = isLit ? 0.85 : isFlash ? 0.5 + pulse * 0.5 : 0.18;
              const color = idx < tilesPerRow / 2 ? '#FF66D4' : '#7C9CFF';
              return (
                <Box
                  key={idx}
                  sx={{
                    flex: 1,
                    height: 28,
                    borderRadius: '6px',
                    backgroundColor: color,
                    opacity: alpha,
                    transition: 'opacity 60ms linear',
                  }}
                />
              );
            })}
          </Stack>
        );
      })}
    </Stack>
  );
}

// ── Disco tab — full-screen color show ──────────────────────────────

function DiscoCanvas({ state }) {
  const canvasRef = useRef(null);
  const idxRef = useRef({ bass: 0, mids: 5, highs: 10, lastBeat: 0, prev: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pulse = state.pulse;
      const energies = state.bandEnergies;
      const idx = idxRef.current;

      // Rising-edge beat detection: rotate all three indices on each
      // detected onset. Threshold 0.05, cooldown 50 ms — same tuning
      // as the Android disco.
      const now = performance.now();
      if (idx.prev < 0.05 && pulse >= 0.05 && now - idx.lastBeat > 50) {
        idx.bass = (idx.bass + 1) % PALETTE.length;
        idx.mids = (idx.mids + 2) % PALETTE.length;
        idx.highs = (idx.highs + 3) % PALETTE.length;
        idx.lastBeat = now;
      }
      idx.prev = pulse;

      const colorBass = PALETTE[idx.bass];
      const colorMids = PALETTE[idx.mids];
      const colorHighs = PALETTE[idx.highs];

      const bassA = Math.min(1, Math.sqrt(energies.bass * 8));
      const midsA = Math.min(1, Math.sqrt(energies.mids * 6));
      const highsA = Math.min(1, Math.sqrt(energies.highs * 6));
      const ambient = Math.min(1, 0.18 + pulse * 0.55);

      // Layer 1: Bass wash bottom 70%
      const bassGrad = ctx.createLinearGradient(0, h * 0.3, 0, h);
      bassGrad.addColorStop(0, hexAlpha(colorBass, bassA * 0.4 + ambient * 0.3));
      bassGrad.addColorStop(1, hexAlpha(colorBass, Math.min(1, bassA + ambient) * 0.95));
      ctx.fillStyle = bassGrad;
      ctx.fillRect(0, h * 0.3, w, h * 0.7);

      // Layer 2: Mids sweep through middle
      const midsGrad = ctx.createLinearGradient(0, 0, w, 0);
      midsGrad.addColorStop(0, 'rgba(0,0,0,0)');
      midsGrad.addColorStop(0.5, hexAlpha(colorMids, Math.min(0.95, midsA + ambient * 0.4)));
      midsGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = midsGrad;
      ctx.fillRect(0, h * 0.3, w, h * 0.4);

      // Layer 3: Highs wash top 50%
      const highsGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      highsGrad.addColorStop(0, hexAlpha(colorHighs, Math.min(0.95, highsA + ambient * 0.5)));
      highsGrad.addColorStop(1, hexAlpha(colorHighs, highsA * 0.2));
      ctx.fillStyle = highsGrad;
      ctx.fillRect(0, 0, w, h * 0.5);

      // Layer 4: Radial center burst on every beat
      if (pulse > 0.05) {
        const burstR = Math.max(w, h) * (0.25 + pulse * 0.85);
        const burst = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, burstR);
        burst.addColorStop(0, `rgba(255,255,255,${pulse * 0.55})`);
        burst.addColorStop(0.5, hexAlpha(colorBass, pulse * 0.45));
        burst.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = burst;
        ctx.fillRect(0, 0, w, h);
      }

      // Layer 5: side strobes
      if (pulse > 0.15) {
        const sideAlpha = Math.min(0.8, (pulse - 0.15) * 1.5);
        const sideW = w * 0.25;
        const leftGrad = ctx.createLinearGradient(0, 0, sideW, 0);
        leftGrad.addColorStop(0, hexAlpha(colorMids, sideAlpha));
        leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, sideW, h);

        const rightGrad = ctx.createLinearGradient(w - sideW, 0, w, 0);
        rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
        rightGrad.addColorStop(1, hexAlpha(colorHighs, sideAlpha));
        ctx.fillStyle = rightGrad;
        ctx.fillRect(w - sideW, 0, sideW, h);
      }

      // Layer 6: sparkle dots
      if (energies.highs > 0.01) {
        const boostedHighs = Math.min(1, Math.sqrt(energies.highs * 5));
        const dotCount = Math.min(100, Math.floor(boostedHighs * 100));
        const timeSeed = Math.floor(performance.now() / 60);
        for (let i = 0; i < dotCount; i++) {
          const seed = i * 173 + timeSeed;
          const xN = ((seed * 37) % 100 + 100) % 100 / 100;
          const yN = ((seed * 91) % 100 + 100) % 100 / 100;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.85)' : hexAlpha(colorHighs, 0.9);
          ctx.beginPath();
          ctx.arc(xN * w, yN * h, 2 + boostedHighs * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Layer 7: peak strobe
      if (pulse > 0.25) {
        ctx.fillStyle = `rgba(255,255,255,${(pulse - 0.25) * 0.5})`;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };

    // Idle drift — rotate palette every 1.2 s when nothing's detected
    // for 1.8 s+. Runs alongside the draw loop.
    const driftId = setInterval(() => {
      if (performance.now() - idxRef.current.lastBeat > 1800) {
        idxRef.current.bass = (idxRef.current.bass + 1) % PALETTE.length;
        idxRef.current.mids = (idxRef.current.mids + 1) % PALETTE.length;
        idxRef.current.highs = (idxRef.current.highs + 1) % PALETTE.length;
      }
    }, 1200);

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(driftId);
    };
  }, [state]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

// Tiny helper — turn a hex string like '#FF0066' into 'rgba(255,0,102,A)'.
function hexAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
