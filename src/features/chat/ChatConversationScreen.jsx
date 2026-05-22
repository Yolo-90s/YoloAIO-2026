import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import GifIcon from '@mui/icons-material/Gif';
import ImageIcon from '@mui/icons-material/Image';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import { auth } from '../../data/firebase.js';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { JitsiCallModal } from './JitsiCallModal.jsx';
import { setActiveChatPartnerUid } from './chatNotifications.js';
import { computeInitials, avatarColorToCss } from '../../data/userProfile.js';
import {
  observeMessages,
  fetchUser,
  sendText,
  sendMedia,
  deleteChat,
  MSG_TEXT,
  MSG_IMAGE,
  MSG_GIF,
  formatMessageTime,
} from './chatRepository.js';
import { routes } from '../../routes.js';

const EMOJI_SET = [
  '😀', '😂', '🥹', '😍', '😎', '🤔', '🙃', '😴',
  '👍', '🙏', '👏', '🔥', '🎉', '💯', '❤️', '💜',
  '🚀', '✨', '⭐', '🌈', '☕', '🍕', '🎵', '📸',
];

export function ChatConversationScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const me = auth?.currentUser?.uid;

  const [other, setOther] = useState(null);
  const [otherLoading, setOtherLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [callOpen, setCallOpen] = useState(null); // null | 'audio' | 'video'
  const config = useAppConfig();
  const imageInputRef = useRef(null);
  const gifInputRef = useRef(null);
  const listRef = useRef(null);
  const draftRef = useRef('');

  useEffect(() => {
    let alive = true;
    setOtherLoading(true);
    fetchUser(userId).then((u) => {
      if (alive) {
        setOther(u);
        setOtherLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const off = observeMessages(userId, setMessages);
    return off;
  }, [userId]);

  // Suppress chat notifications for the conversation the user is actively
  // reading — matches Android's activeChatPartnerUid.
  useEffect(() => {
    if (!userId) return;
    setActiveChatPartnerUid(userId);
    return () => setActiveChatPartnerUid(null);
  }, [userId]);

  // Auto-scroll to the newest message. Run after the DOM updates so the
  // list has already grown to its new height.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (otherLoading) {
    return (
      <LoadingShell title="Chat" onBack={() => navigate(routes.chat)} />
    );
  }
  if (!other) {
    return (
      <LoadingShell
        title="Chat"
        onBack={() => navigate(routes.chat)}
        message="That user no longer exists."
      />
    );
  }

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setDraft('');
    try {
      await sendText(userId, text);
    } catch (e) {
      setError(e.message);
      setDraft(text);
    }
  };

  const handleFile = async (file, type) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await sendMedia(userId, file, type);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChat(userId);
      navigate(routes.chat, { replace: true });
    } catch (e) {
      setError(e.message);
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const pickEmoji = (emoji) => {
    setDraft((d) => d + emoji);
    setEmojiAnchor(null);
  };

  // Track latest draft for the keydown handler so closures don't go stale.
  draftRef.current = draft;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh - 64px)', // 64px = TopBar height
        maxWidth: 960,
        mx: 'auto',
        width: '100%',
      }}
    >
      <ConversationHeader
        user={other}
        onBack={() => navigate(routes.chat)}
        onDelete={() => setDeleteOpen(true)}
        deleting={deleting}
        onAudioCall={() => setCallOpen('audio')}
        onVideoCall={() => setCallOpen('video')}
        onOpenProfile={() => navigate(routes.userProfile(other.uid))}
      />

      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 1.5, sm: 2 },
          py: 2,
        }}
      >
        <Stack spacing={1}>
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} fromMe={m.senderId === me} />
          ))}
        </Stack>
      </Box>

      {error && (
        <Typography color="error" variant="caption" sx={{ px: 2, py: 0.5 }}>
          {error}
        </Typography>
      )}

      {uploading && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.5 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Uploading…
          </Typography>
        </Stack>
      )}

      <InputBar
        draft={draft}
        onChange={(v) => {
          setDraft(v);
          setError(null);
        }}
        onSend={handleSend}
        onEmojiClick={(e) => setEmojiAnchor(e.currentTarget)}
        onImageClick={() => imageInputRef.current?.click()}
        onGifClick={() => gifInputRef.current?.click()}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0], MSG_IMAGE);
          e.target.value = '';
        }}
      />
      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0], MSG_GIF);
          e.target.value = '';
        }}
      />

      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'rgba(24,16,35,0.96)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              p: 1.5,
              maxWidth: 320,
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.5,
          }}
        >
          {EMOJI_SET.map((emoji) => (
            <Box
              key={emoji}
              onClick={() => pickEmoji(emoji)}
              sx={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Popover>

      <JitsiCallModal
        open={callOpen !== null}
        onClose={() => setCallOpen(null)}
        otherUser={other}
        video={callOpen === 'video'}
        serverUrl={config.jitsiServerUrl}
      />

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogTitle sx={{ fontWeight: 600 }}>Delete chat?</DialogTitle>
        <DialogContent>
          <Typography>
            This permanently removes every message in your conversation with{' '}
            {other.displayName || 'this person'}. The chat disappears for both of you and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ConversationHeader({ user, onBack, onDelete, deleting, onAudioCall, onVideoCall, onOpenProfile }) {
  const initials = user.initials || computeInitials(user.displayName || '');
  const avatarBg = avatarColorToCss(user.avatarColor);
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
        onClick={onOpenProfile}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenProfile?.();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flex: 1,
          minWidth: 0,
          cursor: onOpenProfile ? 'pointer' : 'default',
          borderRadius: 1,
          px: 0.5,
          mx: -0.5,
          '&:hover': onOpenProfile ? { backgroundColor: 'rgba(255,255,255,0.04)' } : undefined,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {user.displayName || 'Unknown'}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {user.email}
          </Typography>
        </Stack>
      </Box>
      <IconButton
        onClick={onAudioCall}
        sx={{ color: 'text.primary' }}
        aria-label="Voice call"
      >
        <CallIcon />
      </IconButton>
      <IconButton
        onClick={onVideoCall}
        sx={{ color: 'text.primary' }}
        aria-label="Video call"
      >
        <VideocamIcon />
      </IconButton>
      <IconButton
        onClick={onDelete}
        disabled={deleting}
        sx={{ color: 'error.main' }}
        aria-label="Delete chat"
      >
        <DeleteOutlineIcon />
      </IconButton>
    </Stack>
  );
}

function MessageBubble({ msg, fromMe }) {
  const time = msg.timestamp?.toMillis ? formatMessageTime(msg.timestamp.toMillis()) : '';
  return (
    <Stack alignItems={fromMe ? 'flex-end' : 'flex-start'}>
      {msg.type === MSG_IMAGE || msg.type === MSG_GIF ? (
        <MediaBubble url={msg.mediaUrl} tag={msg.type === MSG_GIF ? 'GIF' : 'PHOTO'} fromMe={fromMe} />
      ) : (
        <TextBubble text={msg.text || ''} fromMe={fromMe} />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, pt: 0.25 }}>
        {time}
      </Typography>
    </Stack>
  );
}

function TextBubble({ text, fromMe }) {
  return (
    <Box
      sx={{
        maxWidth: { xs: 260, sm: 320, md: 420 },
        px: 1.75,
        py: 1.25,
        borderRadius: fromMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        backgroundColor: fromMe ? 'primary.main' : 'rgba(255,255,255,0.08)',
        color: fromMe ? 'primary.contrastText' : 'text.primary',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
    >
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}

function MediaBubble({ url, tag, fromMe }) {
  if (!url) return null;
  return (
    <Box
      sx={{
        position: 'relative',
        maxWidth: { xs: 240, sm: 280, md: 360 },
        borderRadius: fromMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Box
        component="img"
        src={url}
        alt={tag}
        sx={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          px: 0.75,
          py: 0.25,
          borderRadius: 0.75,
          backgroundColor: 'rgba(0,0,0,0.45)',
          color: '#fff',
        }}
      >
        <Typography variant="caption">{tag}</Typography>
      </Box>
    </Box>
  );
}

function InputBar({ draft, onChange, onSend, onEmojiClick, onImageClick, onGifClick }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={{
        px: 1,
        py: 1,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(14,11,20,0.6)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <IconButton onClick={onEmojiClick} sx={{ color: 'text.secondary' }} aria-label="Emoji">
        <EmojiEmotionsIcon />
      </IconButton>
      <IconButton onClick={onGifClick} sx={{ color: 'text.secondary' }} aria-label="GIF">
        <GifIcon />
      </IconButton>
      <IconButton onClick={onImageClick} sx={{ color: 'text.secondary' }} aria-label="Image">
        <ImageIcon />
      </IconButton>
      <TextField
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Message"
        size="small"
        multiline
        maxRows={4}
        fullWidth
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
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
        sx={{
          width: 44,
          height: 44,
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { backgroundColor: 'primary.dark' },
        }}
        aria-label="Send"
      >
        <SendIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function LoadingShell({ title, onBack, message }) {
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%', px: 2, py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <IconButton onClick={onBack} sx={{ color: 'text.primary', ml: -1 }} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>
      <Stack alignItems="center" sx={{ py: 8 }}>
        {message ? (
          <Typography color="text.secondary">{message}</Typography>
        ) : (
          <CircularProgress />
        )}
      </Stack>
    </Box>
  );
}
