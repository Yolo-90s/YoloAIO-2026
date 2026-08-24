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
// used for hero/profile panels.
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

  return (
    <Paper
      elevation={elevation}
      onClick={onClick}
      sx={{
        position: 'relative',
        backgroundColor: tint,
        backgroundImage: 'none',
        backdropFilter: `blur(${glassTokens.blurPx}px)`,
        WebkitBackdropFilter: `blur(${glassTokens.blurPx}px)`,
        border: `0.5px solid ${glassTokens.border}`,
        borderRadius: radius,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 160ms ease',
        '&:hover': onClick ? { transform: 'translateY(-2px) scale(1.01)' } : undefined,
        '&:active': onClick ? { transform: 'translateY(0) scale(0.98)' } : undefined,
        ...sx,
      }}
    >
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
      <Box sx={{ p: contentPadding }}>{children}</Box>
    </Paper>
  );
}

export function GlassSurface({ children, strong = false, onClick, sx, radius = 2.5 }) {
  const tint = strong ? glassTokens.fillStrong : glassTokens.fill;
  const elevation = strong ? 8 : 3;
  return (
    <Paper
      elevation={elevation}
      onClick={onClick}
      sx={{
        backgroundColor: tint,
        backgroundImage: 'none',
        backdropFilter: `blur(${glassTokens.blurPx}px)`,
        WebkitBackdropFilter: `blur(${glassTokens.blurPx}px)`,
        border: `0.5px solid ${glassTokens.border}`,
        borderRadius: radius,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
