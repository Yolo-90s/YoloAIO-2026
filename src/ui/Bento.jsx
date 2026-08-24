import { motion } from 'framer-motion';
import { Box, Stack, Typography } from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';

// The app's bento-grid tile — a vivid gradient-fill card with a soft
// top-edge "glass sheen" highlight (ties it into the same Liquid-Glass
// light language as GlassCard without dulling the brand color), a
// spring hover/press feedback, and a staggered fade/rise entrance.
//
// Generalized from HomeScreen's original HeroTile/StandardTile — Home now
// consumes this directly rather than keeping its own copies. Mirrors
// BentoTile.kt on Android (same visual language, same param shape).
//
// `hero` renders a 2-column-span featured tile; otherwise a square
// standard tile — place inside a CSS grid the same way HomeScreen does
// (`gridTemplateColumns: repeat(auto-fill, minmax(min(220px,100%),1fr))`).
// `index` staggers the entrance animation — pass the item's position in
// its grid/list.
export function BentoTile({ title, tagline, icon: Icon, accent, onClick, hero = false, index = 0 }) {
  return (
    <Box
      component={motion.div}
      onClick={onClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.04, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.96 }}
      sx={{
        gridColumn: hero ? 'span 2' : undefined,
        position: 'relative',
        minHeight: hero ? { xs: 200, md: 260 } : undefined,
        aspectRatio: hero ? { xs: '2 / 1', md: 'auto' } : '1 / 1',
        borderRadius: hero ? { xs: '24px', md: '28px' } : '20px',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${accent[0]} 0%, ${accent[1]} 100%)`,
        boxShadow: hero ? '0 16px 40px rgba(0,0,0,0.32)' : '0 10px 24px rgba(0,0,0,0.26)',
        cursor: 'pointer',
      }}
    >
      {/* Glass sheen — soft light from the top edge, the same rim-light
          language as GlassCard's blur+tint, applied here as a highlight
          over the vivid gradient instead of a translucent blur (a bento
          tile is a bold branded surface, not a see-through pane). */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 55%)',
        }}
      />

      <Icon
        sx={{
          position: 'absolute',
          top: hero ? { xs: 16, md: 20 } : 12,
          right: hero ? { xs: 16, md: 24 } : 12,
          fontSize: hero ? { xs: 140, md: 180 } : { xs: 80, md: 100 },
          color: hero ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.16)',
        }}
      />

      <Stack
        sx={{
          position: 'absolute',
          inset: 0,
          p: hero ? { xs: 3, md: 4 } : { xs: 2, md: 2.5 },
          justifyContent: 'space-between',
          color: '#fff',
        }}
      >
        {hero ? (
          <>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <IconChip Icon={Icon} size={44} iconSize={24} />
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                Featured
              </Typography>
            </Stack>
            <Stack>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '2rem', md: '2.5rem' } }}>
                {title}
              </Typography>
              <Stack direction="row" alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="body1" sx={{ flex: 1, opacity: 0.85 }}>
                  {tagline}
                </Typography>
                <ArrowOutwardIcon sx={{ fontSize: 22 }} />
              </Stack>
            </Stack>
          </>
        ) : (
          <>
            <IconChip Icon={Icon} size={36} iconSize={20} />
            <Stack>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {tagline}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}

function IconChip({ Icon, size, iconSize }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${size * 0.32}px`,
        background: 'rgba(255,255,255,0.20)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sx={{ fontSize: iconSize }} />
    </Box>
  );
}
