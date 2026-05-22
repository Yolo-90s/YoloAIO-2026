import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { auth } from '../../data/firebase.js';
import { roomForUsers } from './callRoom.js';

// Builds the Jitsi URL with userInfo + initial-state fragment params.
// meet.jit.si reads `#userInfo.*` and `#config.*` fragments from the URL
// directly — no SDK load needed.
function buildJitsiUrl({ serverUrl, room, displayName, email, video }) {
  const base = (serverUrl || 'https://meet.jit.si').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (displayName) params.set('userInfo.displayName', `"${displayName}"`);
  if (email) params.set('userInfo.email', `"${email}"`);
  params.set('config.prejoinPageEnabled', 'false');
  params.set('config.startWithVideoMuted', String(!video));
  params.set('config.disableInviteFunctions', 'true');
  // URLSearchParams encodes spaces as +, which Jitsi tolerates in fragments
  return `${base}/${encodeURIComponent(room)}#${params.toString()}`;
}

export function JitsiCallModal({ open, onClose, otherUser, video, serverUrl }) {
  const me = auth?.currentUser;
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setRoom(null);
      setError(null);
      return;
    }
    if (!me?.uid || !otherUser?.uid) {
      setError('Missing user info — try again.');
      return;
    }
    let cancelled = false;
    roomForUsers(me.uid, otherUser.uid)
      .then((r) => {
        if (!cancelled) setRoom(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Could not start call');
      });
    return () => {
      cancelled = true;
    };
  }, [open, me?.uid, otherUser?.uid]);

  const url = useMemo(() => {
    if (!room) return null;
    return buildJitsiUrl({
      serverUrl,
      room,
      displayName:
        me?.displayName?.trim() ||
        me?.email?.split('@')[0] ||
        'Yolo user',
      email: me?.email,
      video,
    });
  }, [room, serverUrl, me?.displayName, me?.email, video]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            backgroundColor: '#000',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          px: 2,
          py: 1.5,
          zIndex: 2,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
        }}
      >
        <IconButton
          onClick={onClose}
          aria-label="End call"
          sx={{ color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
            {video ? 'Video call' : 'Voice call'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {otherUser?.displayName || 'Connecting…'}
          </Typography>
        </Stack>
      </Stack>

      {error && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'error.main',
            px: 3,
            textAlign: 'center',
          }}
        >
          <Typography>{error}</Typography>
        </Box>
      )}

      {!error && !url && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#fff',
          }}
        >
          <CircularProgress sx={{ color: '#fff' }} />
        </Box>
      )}

      {url && (
        <Box
          component="iframe"
          src={url}
          title="Jitsi call"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          sx={{
            border: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      )}
    </Dialog>
  );
}
