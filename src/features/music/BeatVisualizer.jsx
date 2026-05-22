import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import {
  BANDS,
  useBeatPulse,
  useFrequencyData,
} from './musicPlayer.js';

// Mini-player bar visualizer.
//
// - Logarithmic frequency mapping so bass bars don't all clump at the
//   left edge.
// - Peak-hold per bar (fast attack, slow release) for a fluid feel.
// - Whole row lifts on the shared drum-onset pulse.
export function BeatVisualizer({ height = 80, bars = 24, color = '#FF66D4', active = true }) {
  const canvasRef = useRef(null);
  const peaksRef = useRef(null);
  const freq = useFrequencyData();
  const pulse = useBeatPulse();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    const start = performance.now();

    if (!peaksRef.current || peaksRef.current.length !== bars) {
      peaksRef.current = new Float32Array(bars);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Log-spaced bin indices, computed once.
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
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const data = freq.get();
      const beat = pulse.get();
      const peaks = peaksRef.current;
      const gap = 3;
      const barWidth = (w - gap * (bars - 1)) / bars;

      for (let i = 0; i < bars; i++) {
        let raw;
        if (data && active) {
          const idx = Math.min(data.length - 1, binIndex[i]);
          raw = data[idx] / 255;
        } else if (active) {
          raw = (Math.sin((t - start) / 200 + i * 0.3) + 1) / 2 * 0.55 + 0.15;
        } else {
          raw = 0.04;
        }

        // Peak hold: fast rise, gentle fall.
        const prev = peaks[i];
        if (raw > prev) {
          peaks[i] = prev + (raw - prev) * 0.55;
        } else {
          peaks[i] = prev + (raw - prev) * 0.08;
        }

        // Detected kick adds a uniform lift across the row.
        const value = Math.min(1, peaks[i] + beat * 0.2);
        const barH = Math.max(2, value * h);
        const x = i * (barWidth + gap);
        const y = (h - barH) / 2;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, Math.min(3, barWidth / 2));
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [active, bars, color, freq, pulse]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ width: '100%', height, display: 'block' }}
    />
  );
}
