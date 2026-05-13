import { Box, Paper } from '@mui/material';
import { yoloSurfaceColor } from '../theme/palettes.js';

// Solid card with optional accent stripe at the top. Mirrors GlassCard.kt:
// `strong` swaps to the brighter container color used for hero/profile panels.
export function GlassCard({
  children,
  strong = false,
  accentColors,
  onClick,
  sx,
  contentPadding = 2,
  radius = 2.5,
}) {
  const bg = strong ? yoloSurfaceColor.strong : yoloSurfaceColor.normal;
  const elevation = strong ? 10 : 4;
  const accent = Array.isArray(accentColors) && accentColors.length > 0;

  return (
    <Paper
      elevation={elevation}
      onClick={onClick}
      sx={{
        position: 'relative',
        backgroundColor: bg,
        backgroundImage: 'none',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: radius,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        '&:hover': onClick ? { transform: 'translateY(-1px)' } : undefined,
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
  const bg = strong ? yoloSurfaceColor.strong : yoloSurfaceColor.normal;
  const elevation = strong ? 8 : 3;
  return (
    <Paper
      elevation={elevation}
      onClick={onClick}
      sx={{
        backgroundColor: bg,
        backgroundImage: 'none',
        border: '0.5px solid rgba(255,255,255,0.12)',
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
