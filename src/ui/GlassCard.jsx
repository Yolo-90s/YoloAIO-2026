import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Box, Paper } from '@mui/material';
import { glassTokens } from '../theme/palettes.js';

// Genuinely translucent "frosted glass" card — real `backdrop-filter: blur`
// over whatever's behind it (the animated AppBackground canvas, or any
// other content scrolled underneath), tinted with a palette-neutral
// translucent fill from `glassTokens`. Unlike the Android build, CSS
// backdrop-filter blurs actual page content directly — no separate blur
// source/state to register.
//
// Mirrors GlassCard.kt: `strong` swaps to the brighter/more opaque tint
// used for hero/profile panels. Also mirrors its pointer-tilt + layered
// depth-shadow treatment (see Tilt3D.kt's doc comment on Android) — only
// clickable cards tilt (a static info card tilting under a touch would
// imply interactivity that isn't there), at a subtler angle than
// BentoTile since these are dense content surfaces, not hero branding.

function useTilt3D(maxTiltDeg) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useTransform(pointerY, [-0.5, 0.5], [maxTiltDeg, -maxTiltDeg]);
  const rotateY = useTransform(pointerX, [-0.5, 0.5], [-maxTiltDeg, maxTiltDeg]);
  const onMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onMouseLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };
  return { rotateX, rotateY, onMouseMove, onMouseLeave };
}

// Paired top-highlight/bottom-shadow depth cue, scaled down for glass
// surfaces — faint enough not to fight the frosted blur/tint underneath,
// just enough to read as "curved surface" rather than "flat pane with a
// border."
function DepthOverlay() {
  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 30%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.10) 0%, transparent 35%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

export function GlassCard({
  children,
  strong = false,
  accentColors,
  onClick,
  sx,
  contentPadding = 2,
  radius = 2.5,
}) {
  const tint = strong ? glassTokens.fillStrong : glassTokens.fill;
  const elevation = strong ? 10 : 4;
  const accent = Array.isArray(accentColors) && accentColors.length > 0;
  const tilt = useTilt3D(strong ? 3 : 4);

  const baseSx = {
    position: 'relative',
    backgroundColor: tint,
    backgroundImage: 'none',
    backdropFilter: `blur(${glassTokens.blurPx}px)`,
    WebkitBackdropFilter: `blur(${glassTokens.blurPx}px)`,
    border: `0.5px solid ${glassTokens.border}`,
    borderRadius: radius,
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    ...sx,
  };

  const body = (
    <>
      {accent && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${accentColors.join(', ')})`,
          }}
        />
      )}
      <DepthOverlay />
      <Box sx={{ p: contentPadding, position: 'relative' }}>{children}</Box>
    </>
  );

  if (!onClick) {
    return (
      <Paper elevation={elevation} sx={baseSx}>
        {body}
      </Paper>
    );
  }

  return (
    <Paper
      component={motion.div}
      elevation={elevation}
      onClick={onClick}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 }}
      sx={baseSx}
    >
      {body}
    </Paper>
  );
}

export function GlassSurface({ children, strong = false, onClick, sx, radius = 2.5 }) {
  const tint = strong ? glassTokens.fillStrong : glassTokens.fill;
  const elevation = strong ? 8 : 3;
  const tilt = useTilt3D(strong ? 3 : 4);

  const baseSx = {
    position: 'relative',
    backgroundColor: tint,
    backgroundImage: 'none',
    backdropFilter: `blur(${glassTokens.blurPx}px)`,
    WebkitBackdropFilter: `blur(${glassTokens.blurPx}px)`,
    border: `0.5px solid ${glassTokens.border}`,
    borderRadius: radius,
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    ...sx,
  };

  if (!onClick) {
    return (
      <Paper elevation={elevation} sx={baseSx}>
        <DepthOverlay />
        {children}
      </Paper>
    );
  }

  return (
    <Paper
      component={motion.div}
      elevation={elevation}
      onClick={onClick}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 }}
      sx={baseSx}
    >
      <DepthOverlay />
      {children}
    </Paper>
  );
}
