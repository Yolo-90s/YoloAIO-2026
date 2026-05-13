import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ForumIcon from '@mui/icons-material/Forum';
import SendIcon from '@mui/icons-material/Send';
import { auth } from '../../data/firebase.js';
import { computeInitials, avatarColorToCss } from '../../data/userProfile.js';
import {
  observeMessages,
  sendMessage,
  deleteMessage,
  formatCommunityTime,
} from './communityRepository.js';
import { routes } from '../../routes.js';

export function CommunityChannelScreen() {
  const navigate = useNavigate();
  const me = auth?.currentUser?.uid;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const listRef = useRef(null);

  useEffect(() => observeMessages(setMessages), []);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    try {
      await sendMessage(text);
    } catch (e) {
      setError(e.message);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMessage(target);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh - 64px)',
        maxWidth: 880,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Header onBack={() => navigate(routes.home)} />

      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, sm: 2 }, py: 2 }}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <Stack spacing={0.75}>
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                fromMe={m.senderId === me}
                onDelete={() => setPendingDelete(m)}
              />
            ))}
          </Stack>
        )}
      </Box>

      {error && (
        <Typography color="error" variant="caption" sx={{ px: 2, py: 0.5 }}>
          {error}
        </Typography>
      )}

      <InputBar
        draft={draft}
        onChange={(v) => {
          setDraft(v);
          setError(null);
        }}
        sending={sending}
        onSend={handleSend}
      />

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete message?</DialogTitle>
        <DialogContent>
          <Typography>This removes your message from the Community Channel for everyone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Header({ onBack }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(14,11,20,0.55)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <IconButton onClick={onBack} sx={{ color: 'text.primary', ml: -1 }} aria-label="Back">
        <ArrowBackIcon />
      </IconButton>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
        }}
      >
        <ForumIcon />
      </Box>
      <Stack>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Community Channel
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Open forum · all members
        </Typography>
      </Stack>
    </Stack>
  );
}

function EmptyState() {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 10, textAlign: 'center' }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          backgroundColor: 'rgba(176,102,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
        }}
      >
        <ForumIcon sx={{ fontSize: 40 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Be the first to post
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        Everyone using Yolo AIO sees what's posted here. Share an idea, ask a question, or just say hi.
      </Typography>
    </Stack>
  );
}

function MessageRow({ message, fromMe, onDelete }) {
  const initials = computeInitials(message.senderName || '');
  const avatarBg = avatarColorToCss(message.senderAvatarColor);
  return (
    <Stack
      direction={fromMe ? 'row-reverse' : 'row'}
      alignItems="flex-start"
      spacing={1}
      sx={{ width: '100%', py: 0.5 }}
    >
      <Avatar bg={avatarBg} initials={initials} />
      <Stack sx={{ maxWidth: { xs: 260, sm: 360, md: 440 } }} alignItems={fromMe ? 'flex-end' : 'flex-start'}>
        {!fromMe && (
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: avatarBg, px: 0.75, pb: 0.25 }}
          >
            {message.senderName || 'Anonymous'}
          </Typography>
        )}
        <Box
          onContextMenu={(e) => {
            if (!fromMe) return;
            e.preventDefault();
            onDelete();
          }}
          sx={{
            px: 1.75,
            py: 1.25,
            borderRadius: fromMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            backgroundColor: fromMe ? 'primary.main' : 'rgba(255,255,255,0.08)',
            color: fromMe ? 'primary.contrastText' : 'text.primary',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            cursor: fromMe ? 'context-menu' : 'default',
          }}
        >
          <Typography variant="body2">{message.text}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.75, pt: 0.25 }}>
          <Typography variant="caption" color="text.secondary">
            {formatCommunityTime(message.timestampMs)}
          </Typography>
          {fromMe && (
            <Button
              size="small"
              onClick={onDelete}
              sx={{
                color: 'text.secondary',
                fontSize: '0.7rem',
                minWidth: 0,
                p: 0,
                textTransform: 'none',
                '&:hover': { color: 'error.main', background: 'transparent' },
              }}
            >
              delete
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

function Avatar({ bg, initials }) {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {initials}
    </Box>
  );
}

function InputBar({ draft, onChange, sending, onSend }) {
  const canSend = draft.trim().length > 0 && !sending;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1.5,
        py: 1,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(14,11,20,0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <TextField
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Share something with everyone…"
        size="small"
        multiline
        maxRows={4}
        fullWidth
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '20px',
            backgroundColor: 'rgba(255,255,255,0.06)',
          },
        }}
      />
      <IconButton
        onClick={onSend}
        disabled={!canSend}
        sx={{
          width: 44,
          height: 44,
          backgroundColor: canSend ? 'primary.main' : 'rgba(255,255,255,0.08)',
          color: canSend ? 'primary.contrastText' : 'text.secondary',
          '&:hover': { backgroundColor: canSend ? 'primary.dark' : 'rgba(255,255,255,0.08)' },
          '&.Mui-disabled': { color: 'text.secondary' },
        }}
        aria-label="Send"
      >
        {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon fontSize="small" />}
      </IconButton>
    </Stack>
  );
}
