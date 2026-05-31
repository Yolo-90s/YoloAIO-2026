import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { getMicAnalyzer, useMicAnalyzer, BANDS } from './micAnalyzer.js';

// Bars are interleaved bass/mid/high (index % 3). 36 ≈ 12 bars per band
// — dense enough to feel like a real spectrum, sparse enough for the
// band assignment to read clearly. Change this and the dispatch math
// in SpectrumBars adapts.
const BAR_COUNT = 36;

// Per-band color palettes for the disco. Each entry is RGB tuple — kept
// outside the component so the index rotation per beat persists across
// React renders (we still cache the rotated indices in refs, not state).
const BASS_COLORS = [
  [255, 23, 68],     // #FF1744 — vivid red
  [255, 107, 53],    // #FF6B35 — orange
  [156, 39, 176],    // #9C27B0 — deep purple
  [183, 28, 28],     // #B71C1C — crimson
];
const MID_COLORS = [
  [0, 188, 212],     // #00BCD4 — cyan
  [33, 150, 243],    // #2196F3 — blue
  [3, 169, 244],     // #03A9F4 — light blue
  [128, 222, 234],   // #80DEEA — pale cyan
];
const HIGH_COLORS = [
  [255, 235, 59],    // #FFEB3B — yellow
  [118, 255, 3],     // #76FF03 — lime
  [236, 64, 122],    // #EC407A — pink
  [76, 175, 80],     // #4CAF50 — green
];

// Bar colors — bass = warm, mid = cool, high = bright.
const BAR_COLORS = [
  { top: '#FF1744', bot: '#FF6B35' },  // bass
  { top: '#00BCD4', bot: '#2196F3' },  // mid
  { top: '#FFEB3B', bot: '#EC407A' },  // high
];

export function BeatAnalyserScreen() {
  const analyzer = getMicAnalyzer();
  const state = useMicAnalyzer();
  const [permission, setPermission] = useState('unknown'); // 'granted' | 'denied' | 'unknown'
  const [tab, setTab] = useState(0);
  const [sensitivity, setSensitivity] = useState(() => analyzer.getSensitivity());

  // Push slider values into the analyzer so the canvases read pre-multiplied
  // bands and stay decoupled from React state.
  useEffect(() => {
    analyzer.setSensitivity(sensitivity);
  }, [analyzer, sensitivity]);

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

  // Full-screen disco — bypass FeatureScaffold so the canvas covers the
  // entire viewport including the app's sticky TopBar.
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
          zIndex: 1200,
        }}
      >
        <DiscoCanvas analyzer={analyzer} />
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
            <SpectrumBody
              analyzer={analyzer}
              state={state}
              sensitivity={sensitivity}
              setSensitivity={setSensitivity}
            />
          )}
        </>
      )}
    </FeatureScaffold>
  );
}

// ── Spectrum tab ────────────────────────────────────────────────────

function SpectrumBody({ analyzer, state, sensitivity, setSensitivity }) {
  return (
    <Stack spacing={3}>
      <NoiseMeter db={state.rmsDb} pulse={state.pulse} />
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Spectrum · Bass / Mid / High
        </Typography>
        <SpectrumBars analyzer={analyzer} />
        <BandLegend />
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Beat tiles
        </Typography>
        <BeatTileGrid analyzer={analyzer} />
      </Box>
      <SensitivityPanel sensitivity={sensitivity} setSensitivity={setSensitivity} />
    </Stack>
  );
}

function NoiseMeter({ db, pulse }) {
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
  const circumference = 2 * Math.PI * radius * 0.75;
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

// ── Spectrum bars ──────────────────────────────────────────────────
//
// 36 bars, cyclically assigned: index%3 == 0 → bass, 1 → mid, 2 → high.
// Each bar pulls from its OWN sub-bin within its band, so bass bars
// (1, 4, 7, …) all reflect bass energy but show variation across the
// kick→bass FFT range. Means: when bass hits, every third bar from the
// left (1, 4, 7, 10, …) spikes — the visual band separation the user
// asked for.
//
// Bars read snapshot directly inside RAF. The effect deps are `[analyzer]`
// (stable) so the RAF loop is set up ONCE on mount, never torn down per
// frame — fixing the bug where the previous version restarted the RAF
// every audio update.
function SpectrumBars({ analyzer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Per-bar state, allocated once.
    const peaks = new Float32Array(BAR_COUNT);
    const assignment = new Uint8Array(BAR_COUNT);
    const binIndex = new Int32Array(BAR_COUNT);

    // Cyclic assignment + sub-bin spread within each band.
    let bassCount = 0, midCount = 0, highCount = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      assignment[i] = i % 3;
      if (assignment[i] === 0) bassCount++;
      else if (assignment[i] === 1) midCount++;
      else highCount++;
    }
    let bIdx = 0, mIdx = 0, hIdx = 0;
    const bassStart = BANDS.kick.start;
    const bassEnd   = BANDS.bass.end;
    const midStart  = BANDS.mids.start;
    const midEnd    = BANDS.mids.end;
    const highStart = BANDS.highs.start;
    const highEnd   = BANDS.highs.end;
    for (let i = 0; i < BAR_COUNT; i++) {
      const a = assignment[i];
      if (a === 0) {
        const t = bIdx / Math.max(1, bassCount - 1);
        binIndex[i] = Math.floor(bassStart + t * (bassEnd - bassStart - 1));
        bIdx++;
      } else if (a === 1) {
        const t = mIdx / Math.max(1, midCount - 1);
        binIndex[i] = Math.floor(midStart + t * (midEnd - midStart - 1));
        mIdx++;
      } else {
        const t = hIdx / Math.max(1, highCount - 1);
        binIndex[i] = Math.floor(highStart + t * (highEnd - highStart - 1));
        hIdx++;
      }
    }

    let raf = 0;
    const draw = () => {
      const snap = analyzer.getSnapshot();
      const data = snap.bandMagnitudes;
      const sens = analyzer.sensitivity; // live ref read — sliders update this

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
      const barW = (cssW - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const cornerR = Math.min(3, barW / 2);

      for (let i = 0; i < BAR_COUNT; i++) {
        const a = assignment[i];
        let raw;
        if (data) {
          const idx = Math.min(data.length - 1, binIndex[i]);
          raw = Math.min(1, data[idx]);
        } else {
          raw = 0.04 + Math.sin(performance.now() / 200 + i * 0.3) * 0.03;
        }

        const sensMul = a === 0 ? sens.bass : a === 1 ? sens.mid : sens.high;
        // Bass FFT bins are narrower / lower magnitude per bin, so they
        // need the most gain. Highs sit on more bins so they read hotter
        // naturally — pull the gain down a little.
        const gain = a === 0 ? 14 : a === 1 ? 11 : 9;
        const boosted = Math.min(1, Math.sqrt(raw * gain * sensMul));

        const prev = peaks[i];
        peaks[i] = boosted > prev
          ? prev + (boosted - prev) * 0.6
          : prev + (boosted - prev) * 0.08;
        const value = Math.max(0.03, peaks[i]);

        const barH = cssH * value;
        const x = i * (barW + gap);
        const y = cssH - barH;

        const c = BAR_COLORS[a];
        const grad = ctx.createLinearGradient(0, y, 0, cssH);
        grad.addColorStop(0, c.top);
        grad.addColorStop(1, c.bot);
        ctx.fillStyle = grad;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, y, barW, barH, cornerR);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barW, barH);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzer]);

  return (
    <Box
      sx={{
        mt: 1,
        height: 140,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <Box component="canvas" ref={canvasRef} sx={{ width: '100%', height: '100%', display: 'block' }} />
    </Box>
  );
}

function BandLegend() {
  const items = [
    { label: 'Bass · 20–350 Hz',  color: '#FF6B35' },
    { label: 'Mid · 350 Hz–2 kHz', color: '#2196F3' },
    { label: 'High · 2 kHz+',     color: '#EC407A' },
  ];
  return (
    <Stack direction="row" spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.5 }}>
      {items.map((it) => (
        <Stack key={it.label} direction="row" alignItems="center" spacing={0.5}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: it.color }} />
          <Typography variant="caption" color="text.secondary">{it.label}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

// ── Beat tiles ──────────────────────────────────────────────────────
//
// Three rows (BASS/MID/HIGH). The number of LIT tiles in each row reflects
// the current sensitivity-adjusted band energy. Beat events (state.beatTime
// rising edge) trigger a scale + glow on the row whose band currently
// dominates — so quiet background noise doesn't strobe the grid.
function BeatTileGrid({ analyzer }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const tiles = Array.from(container.querySelectorAll('[data-tile]'));
    const tilesPerRow = 8;

    let lastBeatTime = 0;
    let beatDominantRow = -1;
    let raf = 0;

    const draw = () => {
      const snap = analyzer.getSnapshot();
      const { bands, beatTime, beatFlash } = snap;
      const rowEnergies = [bands.bass, bands.mid, bands.high];

      // On rising edge of beatTime, latch which row is the "owner" of
      // this beat (highest energy at the moment) so the glow happens on
      // a single coherent row instead of flickering between them.
      if (beatTime > lastBeatTime) {
        let max = -1;
        let argmax = 0;
        for (let r = 0; r < 3; r++) if (rowEnergies[r] > max) { max = rowEnergies[r]; argmax = r; }
        beatDominantRow = argmax;
        lastBeatTime = beatTime;
      }

      for (const tile of tiles) {
        const row = +tile.dataset.row;
        const idx = +tile.dataset.idx;
        const e = rowEnergies[row];
        // Perceptual boost — same trick as bars, slightly gentler so the
        // tile lit-count doesn't max out from ambient room sound.
        const boosted = Math.min(1, Math.sqrt(e * 6));
        const lit = Math.round(boosted * tilesPerRow);
        const isLit = idx < lit;

        const isBeatRow = row === beatDominantRow && beatFlash > 0.05;
        const alpha = isLit ? 0.92 : 0.13 + (isBeatRow ? beatFlash * 0.35 : 0);
        const scale = isLit && isBeatRow ? 1 + beatFlash * 0.18 : 1;
        const glow = isLit && isBeatRow
          ? `0 0 ${10 + beatFlash * 14}px rgba(255,255,255,${beatFlash * 0.7})`
          : 'none';

        // Direct style writes — avoids React reconciliation per frame.
        tile.style.opacity = String(alpha);
        tile.style.transform = `scale(${scale})`;
        tile.style.boxShadow = glow;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzer]);

  const rows = [
    { label: 'BASS', color: '#FF6B35' },
    { label: 'MID',  color: '#2196F3' },
    { label: 'HIGH', color: '#EC407A' },
  ];
  const tilesPerRow = 8;

  return (
    <Stack ref={containerRef} spacing={0.75} sx={{ mt: 1 }}>
      {rows.map((row, ri) => (
        <Stack key={row.label} direction="row" alignItems="center" spacing={0.75}>
          <Typography sx={{ width: 44, fontSize: 10, fontWeight: 700, color: 'text.secondary' }}>
            {row.label}
          </Typography>
          {Array.from({ length: tilesPerRow }).map((_, idx) => (
            <Box
              key={idx}
              data-tile=""
              data-row={ri}
              data-idx={idx}
              sx={{
                flex: 1,
                height: 28,
                borderRadius: '6px',
                backgroundColor: row.color,
                opacity: 0.13,
                transformOrigin: 'center',
                willChange: 'transform, opacity, box-shadow',
              }}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

// ── Sensitivity sliders ────────────────────────────────────────────

function SensitivityPanel({ sensitivity, setSensitivity }) {
  const reset = () => setSensitivity({ bass: 1, mid: 1, high: 1 });
  const rows = [
    { key: 'bass', label: 'Bass sensitivity', color: '#FF6B35' },
    { key: 'mid',  label: 'Mid sensitivity',  color: '#2196F3' },
    { key: 'high', label: 'High sensitivity', color: '#EC407A' },
  ];
  return (
    <Box sx={{ mt: 1, p: 2, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '14px' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Sensitivity
        </Typography>
        <Tooltip title="Reset to 1.0×">
          <IconButton size="small" onClick={reset}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack spacing={1.5}>
        {rows.map((r) => (
          <Stack key={r.key} direction="row" alignItems="center" spacing={2}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: r.color, flexShrink: 0 }} />
            <Typography sx={{ width: 130, fontSize: 12, color: 'text.secondary' }}>
              {r.label}
            </Typography>
            <Slider
              size="small"
              min={0.2}
              max={3}
              step={0.05}
              value={sensitivity[r.key]}
              onChange={(_, v) => setSensitivity((s) => ({ ...s, [r.key]: v }))}
              sx={{ color: r.color, flex: 1 }}
            />
            <Typography sx={{ width: 38, fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {sensitivity[r.key].toFixed(2)}×
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

// ── Disco — full-screen single dominant color ──────────────────────
//
// One color fills the screen at a time. The target color is a weighted
// blend of three palettes (bass / mid / high) — whichever band is
// loudest steers the mix. A confirmed beat (analyzer.state.beatTime
// rising) rotates each palette's pointer, so consecutive bass-heavy
// moments cycle through the bass palette colors rather than locking.
//
// LERP between current displayed RGB and target keeps transitions
// smooth — no per-frame flashing. Beat events add a brief brightness
// pulse (additive RGB) so beats still feel kicky.
function DiscoCanvas({ analyzer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let bassIdx = 0, midIdx = 0, highIdx = 0;
    let lastBeatTime = 0;
    let lastIdleRotate = performance.now();
    let curR = 18, curG = 18, curB = 22;
    let raf = 0;

    const draw = () => {
      const snap = analyzer.getSnapshot();
      const { bands, beatTime, beatFlash } = snap;

      const now = performance.now();
      if (beatTime > lastBeatTime) {
        bassIdx = (bassIdx + 1) % BASS_COLORS.length;
        midIdx  = (midIdx  + 1) % MID_COLORS.length;
        highIdx = (highIdx + 1) % HIGH_COLORS.length;
        lastBeatTime = beatTime;
        lastIdleRotate = now;
      } else if (now - lastIdleRotate > 1600) {
        // Idle drift — keep changing colors slowly if the room is silent.
        bassIdx = (bassIdx + 1) % BASS_COLORS.length;
        midIdx  = (midIdx  + 1) % MID_COLORS.length;
        highIdx = (highIdx + 1) % HIGH_COLORS.length;
        lastIdleRotate = now;
      }

      const bC = BASS_COLORS[bassIdx];
      const mC = MID_COLORS[midIdx];
      const hC = HIGH_COLORS[highIdx];

      // Weighted mix — the +0.05 floor lets quiet rooms still pick a
      // color rather than collapsing to black.
      const wB = bands.bass + 0.05;
      const wM = bands.mid  + 0.05;
      const wH = bands.high + 0.05;
      const total = wB + wM + wH;
      let tgtR = (bC[0] * wB + mC[0] * wM + hC[0] * wH) / total;
      let tgtG = (bC[1] * wB + mC[1] * wM + hC[1] * wH) / total;
      let tgtB = (bC[2] * wB + mC[2] * wM + hC[2] * wH) / total;

      // Brightness follows total energy — keeps quiet rooms dim and loud
      // rooms saturated.
      const energy = Math.min(1, (bands.bass + bands.mid + bands.high) * 0.7);
      const ambient = 0.35 + energy * 0.65;
      tgtR *= ambient;
      tgtG *= ambient;
      tgtB *= ambient;

      // Beat brightness pulse — additive, decays via beatFlash.
      const flash = beatFlash * 70;
      tgtR = Math.min(255, tgtR + flash);
      tgtG = Math.min(255, tgtG + flash);
      tgtB = Math.min(255, tgtB + flash);

      // LERP. Use a faster catchup on beat frames so transitions still
      // feel kicky even though we're smoothing.
      const lerp = 0.08 + beatFlash * 0.18;
      curR += (tgtR - curR) * lerp;
      curG += (tgtG - curG) * lerp;
      curB += (tgtB - curB) * lerp;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = `rgb(${Math.round(curR)},${Math.round(curG)},${Math.round(curB)})`;
      ctx.fillRect(0, 0, w, h);

      // Subtle vignette — adds depth without breaking the "one color"
      // feel. Without it the flat fill reads as a CSS background.
      const vg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyzer]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
