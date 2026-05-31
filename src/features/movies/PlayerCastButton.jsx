import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CastIcon from '@mui/icons-material/Cast';
import {
  endCastSession,
  initCast,
  requestCastSession,
  subscribeCast,
} from '../music/castManager.js';

/**
 * Cast button rendered on top of the Movie/TV player iframe.
 *
 * Honest UX note: the player is a VidKing iframe, and we don't have
 * the underlying video URL — the Cast Web SDK needs a direct stream
 * URL to `loadMedia()`. That means we can't *programmatically* cast
 * the video. But Chrome's browser-level **tab cast** mirrors the
 * entire tab (including the iframe and its audio) to a Chromecast
 * receiver. So this button:
 *
 *   1. Loads the Cast SDK if available
 *   2. Opens a small dialog explaining tab cast + the two-click path
 *      to start it from the browser menu
 *   3. Optionally lets the user open the device chooser via the SDK
 *      as a first step (useful on some Chromebox / TV browsers where
 *      that flow includes a "Cast tab" choice)
 *
 * Hidden on browsers without Cast support (Firefox, Safari).
 */
export function PlayerCastButton() {
  const [castState, setCastState] = useState({ isAvailable: false, isConnected: false });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    initCast();
    return subscribeCast(setCastState);
  }, []);

  if (!castState.isAvailable) return null;

  return (
    <>
      <Tooltip title="Cast to TV">
        <IconButton
          onClick={() => setOpen(true)}
          sx={{
            color: castState.isConnected ? 'primary.main' : 'rgba(255,255,255,0.85)',
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.75)' },
          }}
          aria-label="Cast to TV"
        >
          <CastIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Cast this video to your TV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The in-app player is an embedded iframe, so casting it
            directly isn't possible — but you can mirror the whole
            browser tab to your Chromecast and watch on your TV.
          </Typography>
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            <Step n={1} text="Click Chrome's three-dot menu (top-right)." />
            <Step n={2} text="Choose “Cast…” from the menu." />
            <Step n={3} text="Pick your Chromecast / smart TV device." />
            <Step n={4} text="Set Sources to “Cast tab” (default)." />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Tip: full-screen the player first, then start tab cast — the
            TV will pick up the player at the same size.
          </Typography>
        </DialogContent>
        <DialogActions>
          {castState.isConnected ? (
            <Button onClick={() => { endCastSession(); setOpen(false); }} color="error">
              End cast session
            </Button>
          ) : (
            <Button
              onClick={() => {
                requestCastSession();
                // Don't auto-close — the user still needs to see step 4.
              }}
            >
              Open device chooser
            </Button>
          )}
          <Button onClick={() => setOpen(false)} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Step({ n, text }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.5}>
      <span
        style={{
          flex: '0 0 auto',
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {text}
      </Typography>
    </Stack>
  );
}
