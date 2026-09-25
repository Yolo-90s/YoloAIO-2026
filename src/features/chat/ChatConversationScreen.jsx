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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CallIcon from '@mui/icons-material/Call';
import VideocamIcon from '@mui/icons-material/Videocam';
import { auth } from '../../data/firebase.js';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { JitsiCallModal } from './JitsiCallModal.jsx';
import { setActiveChatPartnerUid } from './chatNotifications.js';
import { computeInitials, avatarColorToCss } from '../../data/userProfile.js';
import {
  observeMessages,
  observeChatDoc,
  fetchUser,
  sendText,
  sendMedia,
  deleteChat,
  MSG_IMAGE,
  MSG_GIF,
} from './chatRepository.js';
import { markChatRead, toggleReaction } from './chatInteractions.js';
import { MessageBubble, InputBar, ReplyComposerStrip, EmojiGrid, LoadingShell } from './ChatMessageComponents.jsx';
import { routes } from '../../routes.js';

export function ChatConversationScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const me = auth?.currentUser?.uid;

  const [other, setOther] = useState(null);
  const [otherLoading, setOtherLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatDoc, setChatDoc] = useState(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
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

  useEffect(() => {
    if (!userId) return;
    const off = observeChatDoc(userId, setChatDoc);
    return off;
  }, [userId]);

  // Suppress chat notifications for the conversation the user is actively
  // reading — matches Android's activeChatPartnerUid.
  useEffect(() => {
    if (!userId) return;
    setActiveChatPartnerUid(userId);
    return () => setActiveChatPartnerUid(null);
  }, [userId]);

  // Mark read whenever the conversation is open and messages change —
  // being on this screen at all means you've seen the latest message.
  useEffect(() => {
    if (!userId) return;
    const cid = [me, userId].sort().join('_');
    markChatRead(cid);
  }, [userId, me, messages.length]);

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

  const chatId = me ? [me, userId].sort().join('_') : null;
  const otherLastReadMs = chatDoc?.lastRead?.[userId]?.toMillis?.() ?? 0;
  const lastMineMs = [...messages].reverse().find((m) => m.senderId === me)?.timestamp?.toMillis?.() ?? 0;
  const seenLastMine = lastMineMs > 0 && otherLastReadMs >= lastMineMs;

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setDraft('');
    const pendingReply = replyTo;
    setReplyTo(null);
    try {
      await sendText(userId, text, pendingReply);
    } catch (e) {
      setError(e.message);
      setDraft(text);
      setReplyTo(pendingReply);
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
          {messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              msg={m}
              fromMe={m.senderId === me}
              myUid={me}
              seen={m.senderId === me && idx === messages.length - 1 && seenLastMine}
              onReact={(emoji) => {
                if (!chatId) return;
                const mine = m.reactions?.[me];
                toggleReaction(chatId, m.id, emoji, mine);
              }}
              onReply={() =>
                setReplyTo({
                  messageId: m.id,
                  senderId: m.senderId,
                  text: m.text || (m.type === MSG_IMAGE ? '📷 Photo' : m.type === MSG_GIF ? '🎞️ GIF' : 'Message'),
                })
              }
            />
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

      <ReplyComposerStrip replyTo={replyTo} onCancel={() => setReplyTo(null)} />

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
        <EmojiGrid onPick={pickEmoji} />
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

