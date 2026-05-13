import { useState } from 'react';
import { Badge, IconButton, Popover } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';

// Icon-button + Popover wrapper. The popover content is whatever the caller
// passes as `children` — typically a stack of multi-select chips. Pass
// `badgeCount` (> 0) to show an active-filter indicator on the button.
export function FilterButton({ children, badgeCount = 0, ariaLabel = 'Filters' }) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  return (
    <>
      <IconButton
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: badgeCount > 0 ? 'primary.main' : 'text.secondary' }}
        aria-label={ariaLabel}
      >
        <Badge badgeContent={badgeCount} color="primary" overlap="circular">
          <TuneIcon />
        </Badge>
      </IconButton>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'rgba(24,16,35,0.96)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              minWidth: 260,
              maxWidth: 360,
              mt: 1,
            },
          },
        }}
      >
        {typeof children === 'function' ? children({ close }) : children}
      </Popover>
    </>
  );
}
