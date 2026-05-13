import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useYoloPalette } from '../theme/ThemeProvider.jsx';

// Two-layer ambient backdrop, mirrors AppBackground.kt:
//   1. Vertical gradient (palette.baseTop → baseMid → baseBottom)
//   2. Three large radial accents drifting slowly along circular paths
//      (~60s loop). Drawn into a <canvas> sized to the viewport.
//
// requestAnimationFrame instead of CSS keyframes — gives us the same
// per-blob phase + radius math as the Compose version, cheap enough
// even at 4K because the canvas only redraws 3 radial gradients per frame.
export function AppBackground({ children }) {
  const { glass } = useYoloPalette();
  const canvasRef = useRef(null);

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
      const phase = ((t - start) / 60000) * (2 * Math.PI);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const blob = (cx, cy, r, color, alpha) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, hexWithAlpha(color, alpha));
        g.addColorStop(1, hexWithAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      };

      // Accent A — top-right, orbits small circle near the upper-right.
      blob(
        w * (0.78 + 0.05 * Math.cos(phase)),
        h * (0.12 + 0.03 * Math.sin(phase)),
        w * 0.95,
        glass.blobB,
        0.28
      );
      // Accent B — bottom-left, opposite phase, slightly smaller.
      blob(
        w * (0.1 + 0.06 * Math.cos(phase + Math.PI)),
        h * (0.9 + 0.04 * Math.sin(phase + Math.PI)),
        w * 0.8,
        glass.blobA,
        0.22
      );
      // Accent C — mid-screen, contrasting hue, slower phase.
      blob(
        w * (0.45 + 0.1 * Math.cos(phase * 0.7 + 1.5)),
        h * (0.55 + 0.07 * Math.sin(phase * 0.7 + 1.5)),
        w * 0.55,
        glass.blobC,
        0.16
      );

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [glass]);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        background: `linear-gradient(180deg, ${glass.baseTop} 0%, ${glass.baseMid} 50%, ${glass.baseBottom} 100%)`,
        // No `overflow-x: hidden` here — it forces `overflow-y: auto` on the
        // same element (CSS quirk), which makes this Box the scroll container
        // and breaks `position: sticky` on the TopBar. Horizontal-overflow
        // safety lives on <body> via `overflow-x: clip` in index.html.
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100dvh' }}>{children}</Box>
    </Box>
  );
}

// Converts "#RRGGBB" + alpha (0..1) → "rgba(r, g, b, a)". Canvas's
// radialGradient won't accept hex+alpha, so we expand manually.
function hexWithAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
