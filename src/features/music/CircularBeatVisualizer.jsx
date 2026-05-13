import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useFrequencyData } from './musicPlayer.js';

// Radial FFT bars arranged around a circle. Each frequency bin becomes one
// bar that grows outward from `innerRadius`. When the browser refuses to
// expose live FFT data (cross-origin restriction on the audio source) we
// fall back to a sine-wave animation so the visualisation never looks
// frozen, even though it's no longer beat-accurate.
export function CircularBeatVisualizer({
  size = 320,
  innerRadius = 110,
  bars = 56,
  color = '#FF66D4',
  glowColor = '#B829E5',
  active = true,
}) {
  const canvasRef = useRef(null);
  const freq = useFrequencyData();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    const start = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function draw(t) {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const data = freq.get();
      const maxBarLength = size / 2 - innerRadius - 6;

      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, ((2 * Math.PI * innerRadius) / bars) * 0.55);

      for (let i = 0; i < bars; i++) {
        let value;
        if (data && active) {
          // The lower frequency bins carry most of the energy; bias the
          // sampling so the bars don't all sit at zero on the top half.
          const idx = Math.floor((i / bars) * (data.length * 0.85));
          value = data[idx] / 255;
        } else if (active) {
          value = (Math.sin((t - start) / 240 + i * 0.35) + 1) / 2 * 0.55 + 0.18;
        } else {
          value = 0.06;
        }
        const barLength = Math.max(4, value * maxBarLength);
        // Start at -90deg (12 o'clock) so the highest energy stays visually
        // anchored at the top of the disc.
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * (innerRadius + barLength);
        const y2 = cy + Math.sin(angle) * (innerRadius + barLength);

        // Soft glow underlay → strong primary on top. Cheap on this many bars.
        ctx.strokeStyle = glowColor;
        ctx.globalAlpha = 0.18 + value * 0.25;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(2, ((2 * Math.PI * innerRadius) / bars) * 0.55);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, innerRadius, bars, color, glowColor, active, freq]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ width: size, height: size, display: 'block', pointerEvents: 'none' }}
    />
  );
}
