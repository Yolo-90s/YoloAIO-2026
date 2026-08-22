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
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { ensureChannelCode, refreshChannelCode } from './walkieRepository.js';
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

        {/* Hidden audio sink the engine attaches the received stream to. */}
        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
      </Stack>
    </FeatureScaffold>
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
