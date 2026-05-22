import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import {
  BANDS,
  useBeatPulse,
  useFrequencyData,
} from './musicPlayer.js';

// Radial visualizer.
//
// - Bins are sampled with a logarithmic mapping (human hearing is log,
//   linear bars over-represent the high end and squash the bass).
// - Per-bar peak-hold: fast attack, slow release. Looks fluid where
//   raw FFT looks jittery.
// - Whole ring breathes outward on each detected kick-drum onset via
//   the shared spectral-flux pulse from musicPlayer.
// - Canvas auto-fits its parent via ResizeObserver, so the visualizer
//   stays centered no matter the container size.
export function CircularBeatVisualizer({
  size = '100%',
  bars = 64,
  color = '#FF66D4',
  glowColor = '#B829E5',
  active = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const peaksRef = useRef(null);
  const freq = useFrequencyData();
  const pulse = useBeatPulse();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    const start = performance.now();
    let cssSize = 0;

    if (!peaksRef.current || peaksRef.current.length !== bars) {
      peaksRef.current = new Float32Array(bars);
    }

    function applySize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = Math.min(container.clientWidth, container.clientHeight) || 0;
      if (next === cssSize) return;
      cssSize = next;
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(container);

    // Precompute log-spaced bin indices once. We span the full musical
    // range — sub-bass through low treble — so the ring shows bass on
    // one side and brightness on the other, with rhythm bins dominating.
    const minBin = Math.max(1, BANDS.sub.start);
    const maxBin = BANDS.highs.end;
    const logMin = Math.log2(minBin);
    const logMax = Math.log2(maxBin);
    const binIndex = new Int32Array(bars);
    for (let i = 0; i < bars; i++) {
      const t = i / (bars - 1);
      binIndex[i] = Math.floor(Math.pow(2, logMin + t * (logMax - logMin)));
    }

    function draw(t) {
      if (cssSize === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, cssSize, cssSize);
      const cx = cssSize / 2;
      const cy = cssSize / 2;
      const innerRadius = cssSize * 0.34;
      const data = freq.get();
      const beat = pulse.get();
      // Kick pushes the whole ring outward (max ~6% of size).
      const pulseRadius = beat * cssSize * 0.06;
      const maxBarLength = cssSize / 2 - innerRadius - 4;
      const peaks = peaksRef.current;

      ctx.lineCap = 'round';
      const barLineWidth = Math.max(2, ((2 * Math.PI * innerRadius) / bars) * 0.55);

      for (let i = 0; i < bars; i++) {
        let raw;
        if (data && active) {
          const idx = Math.min(data.length - 1, binIndex[i]);
          raw = data[idx] / 255;
        } else if (active) {
          raw = (Math.sin((t - start) / 240 + i * 0.35) + 1) / 2 * 0.45 + 0.12;
        } else {
          raw = 0.04;
        }

        // Peak hold: fast attack (0.55), slow release (0.08). Bars rise
        // immediately on transients and fall back smoothly between hits.
        const prev = peaks[i];
        if (raw > prev) {
          peaks[i] = prev + (raw - prev) * 0.55;
        } else {
          peaks[i] = prev + (raw - prev) * 0.08;
        }
        const value = peaks[i];

        const barLength = Math.max(3, value * maxBarLength) + pulseRadius;
        // -PI/2 puts the lowest-frequency bar at 12 o'clock.
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const r0 = innerRadius + pulseRadius;
        const x1 = cx + Math.cos(angle) * r0;
        const y1 = cy + Math.sin(angle) * r0;
        const x2 = cx + Math.cos(angle) * (r0 + barLength);
        const y2 = cy + Math.sin(angle) * (r0 + barLength);

        // Soft glow underlay → strong primary on top.
        ctx.strokeStyle = glowColor;
        ctx.globalAlpha = 0.16 + value * 0.28 + beat * 0.2;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = barLineWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bars, color, glowColor, active, freq, pulse]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <Box component="canvas" ref={canvasRef} sx={{ display: 'block' }} />
    </Box>
  );
}
