import { useEffect, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import CastIcon from '@mui/icons-material/Cast';
import CastConnectedIcon from '@mui/icons-material/CastConnected';
import {
  endCastSession,
  initCast,
  requestCastSession,
  subscribeCast,
} from './castManager.js';

// Cast device chooser button. Renders unconditionally — when the SDK
// isn't available yet (still loading) or the browser can't Cast
// (Firefox / Safari / Cast disabled), the icon is dimmed and clicks
// no-op with an explanatory tooltip instead of disappearing.
export function CastButton({ size }) {
  const [cast, setCast] = useState(() => ({
    isAvailable: false,
    isInitialized: false,
    isConnected: false,
    deviceName: null,
  }));

  useEffect(() => {
    initCast();
    return subscribeCast(setCast);
  }, []);

  const disabled = !cast.isAvailable;
  const tooltip = cast.isConnected
    ? `Casting to ${cast.deviceName || 'device'} — tap to disconnect`
    : cast.isAvailable
    ? 'Cast to device'
    : cast.isInitialized
    ? 'Cast not supported in this browser'
    : 'Cast is loading…';

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          onClick={() => {
            if (disabled) return;
            if (cast.isConnected) endCastSession();
            else requestCastSession();
          }}
          size={size}
          disabled={disabled}
          sx={{
            color: cast.isConnected ? 'primary.main' : 'text.secondary',
            opacity: disabled ? 0.4 : 1,
          }}
          aria-label={cast.isConnected ? 'Disconnect Cast' : 'Cast'}
        >
          {cast.isConnected ? <CastConnectedIcon /> : <CastIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
