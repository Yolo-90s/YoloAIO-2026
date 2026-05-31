import { useEffect, useRef } from 'react';

// Premium ~5-second app launch animation — AI operating-system boot
// sequence aesthetic.
//
// Visual stack (top to bottom):
//   - data stream row     small, dim, fast-scrambling cyberpunk glyphs
//   - brand row           bold YOLO AIO that scrambles → locks in
//   - data stream row     mirrored dim row underneath
//   - scan line           thin horizontal beam that sweeps once during
//                         the scramble phase, like a decryption pass
//
// Phase timeline (millis since composition):
//   0     – 2000   full scramble: every glyph randomises every frame,
//                  scan line sweeps top → bottom across the brand
//   2000  – 3500   staggered lock-in: brand chars settle left-to-right,
//                  data stream rows fade out
//   3500  – 4800   hold final text with a slow glow pulse
//   4800  – 5100   300 ms fade-out so the underlying app appears smoothly
//
// Implementation notes:
//   - One RAF loop drives every layer. We write to refs directly to
//     avoid 60 React reconciliations per second.
//   - DATA_STREAM_LEN > brand text length so the dim rows feel like
//     ambient data rather than parallel scrambles of the brand.
//   - The glow pulse is a sinusoidal animation of `textShadow` blur
//     after lock-in — slow enough to feel intentional, not strobing.

const FINAL_TEXT = 'YOLO AIO';
const SCRAMBLE_CHARS = '#@%*<>[]{}/\\~01ABCDEFGHJKLMNPQRSTUVWXYZ';
const DATA_STREAM_LEN = 24;

const SCRAMBLE_END_MS = 2000;
const LOCK_DONE_MS    = 3500;
const HOLD_END_MS     = 4800;
const FADE_MS         = 300;

export function LaunchAnimation({ onComplete }) {
  const rootRef = useRef(null);
  const brandRef = useRef(null);
  const topStreamRef = useRef(null);
  const botStreamRef = useRef(null);
  const scanLineRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;

    if (brandRef.current) {
      brandRef.current.textContent = randomScramble(FINAL_TEXT.length);
    }
    if (topStreamRef.current) topStreamRef.current.textContent = randomScramble(DATA_STREAM_LEN);
    if (botStreamRef.current) botStreamRef.current.textContent = randomScramble(DATA_STREAM_LEN);

    const tick = () => {
      const elapsed = performance.now() - start;

      if (elapsed >= HOLD_END_MS) {
        if (rootRef.current) {
          rootRef.current.style.opacity = '0';
          setTimeout(() => onComplete?.(), FADE_MS);
        } else {
          onComplete?.();
        }
        return;
      }

      // ── Brand row: per-char scramble → lock ────────────────────
      const brandChars = new Array(FINAL_TEXT.length);
      for (let i = 0; i < FINAL_TEXT.length; i++) {
        const finalChar = FINAL_TEXT[i];
        if (finalChar === ' ') { brandChars[i] = ' '; continue; }
        const t = i / FINAL_TEXT.length;
        const lockTime = SCRAMBLE_END_MS + t * (LOCK_DONE_MS - SCRAMBLE_END_MS);
        if (elapsed >= lockTime) {
          brandChars[i] = finalChar;
        } else {
          brandChars[i] = SCRAMBLE_CHARS.charAt(
            Math.floor(Math.random() * SCRAMBLE_CHARS.length)
          );
        }
      }

      if (brandRef.current) {
        brandRef.current.textContent = brandChars.join('');
        // Glitch shake — only during scramble, ~15% of frames.
        const shake =
          elapsed < LOCK_DONE_MS && Math.random() < 0.15
            ? (Math.random() - 0.5) * 4
            : 0;
        brandRef.current.style.transform = `translateX(${shake}px)`;

        // Slow glow pulse during hold.
        if (elapsed >= LOCK_DONE_MS) {
          const t = (elapsed - LOCK_DONE_MS) / (HOLD_END_MS - LOCK_DONE_MS);
          // Two pulses over the hold period — gentle.
          const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
          const innerBlur = 6 + pulse * 8;
          const midBlur = 18 + pulse * 14;
          const outerBlur = 36 + pulse * 20;
          brandRef.current.style.textShadow =
            `0 0 ${innerBlur}px rgba(255,255,255,0.95), ` +
            `0 0 ${midBlur}px rgba(255,255,255,0.55), ` +
            `0 0 ${outerBlur}px rgba(255,255,255,0.3)`;
        }
      }

      // ── Data stream rows: continuous scramble, fade out as brand locks
      const streamProgress =
        elapsed < SCRAMBLE_END_MS
          ? 1
          : Math.max(0, 1 - (elapsed - SCRAMBLE_END_MS) / (LOCK_DONE_MS - SCRAMBLE_END_MS));
      if (topStreamRef.current) {
        topStreamRef.current.textContent = randomScramble(DATA_STREAM_LEN);
        topStreamRef.current.style.opacity = (streamProgress * 0.55).toFixed(3);
      }
      if (botStreamRef.current) {
        botStreamRef.current.textContent = randomScramble(DATA_STREAM_LEN);
        botStreamRef.current.style.opacity = (streamProgress * 0.55).toFixed(3);
      }

      // ── Scan line: single sweep top → bottom during scramble ───
      if (scanLineRef.current) {
        if (elapsed < SCRAMBLE_END_MS) {
          // Sweep down across the brand row's vertical neighbourhood
          // (-60vh to +60vh relative to centre, in vh so it scales).
          const t = elapsed / SCRAMBLE_END_MS;
          // ease-in-out cubic so the beam decelerates at the bottom.
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const offsetVh = -25 + eased * 50;
          scanLineRef.current.style.transform = `translateY(${offsetVh}vh)`;
          scanLineRef.current.style.opacity = '0.75';
        } else {
          // Beam disappears once decryption "completes".
          scanLineRef.current.style.opacity = '0';
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Top dim data stream */}
      <span
        ref={topStreamRef}
        style={{
          fontFamily: '"Courier New", "Cascadia Code", ui-monospace, monospace',
          fontSize: 'clamp(0.7rem, 1.6vw, 1rem)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.25em',
          marginBottom: '2.5vh',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          willChange: 'contents, opacity',
        }}
      >
        {randomScramble(DATA_STREAM_LEN)}
      </span>

      {/* Brand text */}
      <span
        ref={brandRef}
        style={{
          fontFamily: '"Courier New", "Cascadia Code", ui-monospace, monospace',
          fontSize: 'clamp(2rem, 9vw, 5rem)',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '0.18em',
          textShadow:
            '0 0 6px rgba(255,255,255,0.95), 0 0 18px rgba(255,255,255,0.55), 0 0 36px rgba(255,255,255,0.3)',
          userSelect: 'none',
          willChange: 'transform, contents, text-shadow',
        }}
      >
        {randomScramble(FINAL_TEXT.length)}
      </span>

      {/* Bottom dim data stream */}
      <span
        ref={botStreamRef}
        style={{
          fontFamily: '"Courier New", "Cascadia Code", ui-monospace, monospace',
          fontSize: 'clamp(0.7rem, 1.6vw, 1rem)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.25em',
          marginTop: '2.5vh',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          willChange: 'contents, opacity',
        }}
      >
        {randomScramble(DATA_STREAM_LEN)}
      </span>

      {/* Decryption scan line */}
      <div
        ref={scanLineRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 100%)',
          boxShadow: '0 0 16px rgba(255,255,255,0.65)',
          pointerEvents: 'none',
          opacity: 0,
          willChange: 'transform, opacity',
          transition: 'opacity 300ms ease-out',
        }}
      />
    </div>
  );
}

function randomScramble(len) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += SCRAMBLE_CHARS.charAt(Math.floor(Math.random() * SCRAMBLE_CHARS.length));
  }
  return out;
}
