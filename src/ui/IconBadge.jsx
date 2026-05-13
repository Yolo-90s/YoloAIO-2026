import { Box } from '@mui/material';

// Small gradient-filled rounded square that hosts an icon. Used for nav rows
// and settings entries, matches the IconBadge pattern in the Android code.
export function IconBadge({ icon, colors, size = 34, radius = 10, iconSize = 20 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[colors.length - 1]} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        flexShrink: 0,
        '& svg': { fontSize: iconSize },
      }}
    >
      {icon}
    </Box>
  );
}
