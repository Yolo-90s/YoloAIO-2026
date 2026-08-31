import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HeadsetIcon from '@mui/icons-material/Headset';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import {
  ensureChannelCode,
  isCurrentUserAdmin,
  observeLiveChannels,
  refreshChannelCode,
} from './walkieRepository.js';
import { formatChannelCode, normalizeChannelCode } from './walkieChannelId.js';
import { WalkieTalkieEngine } from './walkieEngine.js';

// Live push-to-talk between two browsers/devices over raw peer-to-peer
// WebRTC, signaled through Firestore (walkieRepository.js — same
// collections the Android app reads/writes, so a Transfer on one platform
// is heard by a Receive on the other). Mirrors WalkieTalkieScreen.kt.
export function WalkieTalkieScreen() {
  const config = useAppConfig();
  const [myCode, setMyCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [peerCodeInput, setPeerCodeInput] = useState('');
  const [role, setRole] = useState(null); // 'transmit' | 'receive' | null
  const [status, setStatus] = useState({ kind: 'idle' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [liveChannels, setLiveChannels] = useState([]);

  const audioRef = useRef(null);
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new WalkieTalkieEngine();
  const engine = engineRef.current;

  useEffect(() => {
    engine.onStatusChange = setStatus;
    if (audioRef.current) engine.setRemoteAudioElement(audioRef.current);
    return () => engine.stop();
  }, [engine]);

  useEffect(() => {
    let alive = true;
    ensureChannelCode()
      .then((code) => {
        if (alive) setMyCode(code);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingCode(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    isCurrentUserAdmin().then((admin) => {
      if (alive) setIsAdmin(admin);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Only subscribed while isAdmin — a non-admin would just have this
  // listener fail against firestore.rules' `allow list: if isAdmin()`
  // anyway, but there's no reason to even try.
  useEffect(() => {
    if (!isAdmin) {
      setLiveChannels([]);
      return undefined;
    }
    return observeLiveChannels(setLiveChannels);
  }, [isAdmin]);

  const iceServers = useMemo(() => {
    const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (config.turnUrl) {
      servers.push({
        urls: config.turnUrl,
        username: config.turnUsername,
        credential: config.turnCredential,
      });
    }
    return servers;
  }, [config.turnUrl, config.turnUsername, config.turnCredential]);

  const stopActive = () => {
    engine.stop();
    setRole(null);
  };

  const onTransferTap = async () => {
    if (role === 'transmit') {
      stopActive();
      return;
    }
    stopActive();
    if (!myCode) return;
    setRole('transmit');
    await engine.startTransfer(myCode, iceServers);
  };

  const onReceiveTap = async () => {
    if (role === 'receive') {
      stopActive();
      return;
    }
    const code = normalizeChannelCode(peerCodeInput);
    if (code.length !== 6) return;
    stopActive();
    setRole('receive');
    await engine.startReceive(code, iceServers);
  };

  const onRefreshTap = async () => {
    if (role === 'transmit') stopActive();
    setRefreshing(true);
    try {
      const code = await refreshChannelCode();
      setMyCode(code);
    } catch {
      // keep showing the old code on failure
    }
    setRefreshing(false);
  };

  // Admin-only: tune into a channel discovered via the live-channels list
  // instead of a manually entered code. Marked isAdminMonitor so the
  // transmitter's own listener count doesn't reflect this session.
  const onAdminListenTap = async (channel) => {
    stopActive();
    setPeerCodeInput(channel.code);
    setRole('receive');
    await engine.startReceive(channel.code, iceServers, true);
  };

  return (
    <FeatureScaffold title="Walkie Talkie" maxWidth={520}>
      <Stack spacing={3}>
        <Card
          sx={{
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary">
              Your code
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {myCode ? formatChannelCode(myCode) : '…'}
            </Typography>
          </Box>
          {loadingCode || refreshing ? (
            <CircularProgress size={28} />
          ) : (
            <IconButton onClick={onRefreshTap} aria-label="Get a new code">
              <RefreshIcon />
            </IconButton>
          )}
        </Card>

        <TextField
          label="Peer's code (to Receive)"
          value={peerCodeInput}
          onChange={(e) => setPeerCodeInput(normalizeChannelCode(e.target.value))}
          disabled={role === 'receive'}
          fullWidth
        />

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            color={role === 'transmit' ? 'error' : 'primary'}
            startIcon={<CallMadeIcon />}
            onClick={onTransferTap}
            disabled={!myCode}
            fullWidth
            sx={{ height: 56 }}
          >
            {role === 'transmit' ? 'Stop Transfer' : 'Transfer'}
          </Button>
          <Button
            variant={role === 'receive' ? 'contained' : 'outlined'}
            color={role === 'receive' ? 'error' : 'primary'}
            startIcon={<CallReceivedIcon />}
            onClick={onReceiveTap}
            disabled={role !== 'receive' && normalizeChannelCode(peerCodeInput).length !== 6}
            fullWidth
            sx={{ height: 56 }}
          >
            {role === 'receive' ? 'Stop Receive' : 'Receive'}
          </Button>
        </Stack>

        <Typography align="center" color={status.kind === 'error' ? 'error' : 'text.secondary'}>
          {statusText(status)}
        </Typography>

        {isAdmin && (
          <AdminLiveChannelsSection channels={liveChannels} onListen={onAdminListenTap} />
        )}

        {/* Hidden audio sink the engine attaches the received stream to. */}
        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
      </Stack>
    </FeatureScaffold>
  );
}

function AdminLiveChannelsSection({ channels, onListen }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <AdminPanelSettingsIcon color="primary" sx={{ fontSize: 20 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Live channels (admin)
        </Typography>
      </Stack>
      {channels.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No one else is currently transmitting.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {channels.map((channel) => (
            <GlassCard key={channel.code} onClick={() => onListen(channel)} contentPadding={1.5}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {channel.ownerDisplayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatChannelCode(channel.code)}
                  </Typography>
                </Box>
                <HeadsetIcon />
              </Stack>
            </GlassCard>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function statusText(status) {
  switch (status.kind) {
    case 'connecting':
      return 'Connecting…';
    case 'live':
      return status.listenerCount > 0
        ? `Live — ${status.listenerCount} listening`
        : 'Live — waiting for listeners';
    case 'receiving':
      return 'Receiving live audio';
    case 'error':
      return status.message;
    default:
      return 'Not active';
  }
}
