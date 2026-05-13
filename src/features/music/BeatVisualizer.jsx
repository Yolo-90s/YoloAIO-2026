import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useFrequencyData } from './musicPlayer.js';

// Animated bars from the player's AnalyserNode. When the browser refuses
// to expose FFT data (cross-origin restriction on the audio source) we
// fall back to a sine-wave animation so the UI never sits visually dead.
export function BeatVisualizer({ height = 80, bars = 24, color = '#FF66D4', active = true }) {
  const canvasRef = useRef(null);
  const freq = useFrequencyData();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    const start = performance.now();

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

    function draw(t) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const data = freq.get();
      const gap = 3;
      const barWidth = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        let value;
        if (data && active) {
          const idx = Math.floor((i / bars) * data.length);
          value = data[idx] / 255; // 0..1
        } else if (active) {
          value = (Math.sin((t - start) / 200 + i * 0.3) + 1) / 2 * 0.55 + 0.15;
        } else {
          value = 0.05;
        }
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
  }, [active, bars, color, freq]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      sx={{ width: '100%', height, display: 'block' }}
    />
  );
}
