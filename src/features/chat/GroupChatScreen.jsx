import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, CircularProgress, IconButton, Popover, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GroupIcon from '@mui/icons-material/Group';
import { auth } from '../../data/firebase.js';
import {
  observeGroup,
  observeGroupMessages,
  sendGroupText,
  sendGroupMedia,
} from './groupRepository.js';
import { fetchUser } from './chatRepository.js';
import { markChatRead, toggleReaction } from './chatInteractions.js';
import { setActiveChatPartnerUid } from './chatNotifications.js';
import { MessageBubble, InputBar, ReplyComposerStrip, EmojiGrid, LoadingShell } from './ChatMessageComponents.jsx';
import { routes } from '../../routes.js';

/**
 * Group counterpart to ChatConversationScreen — own header (group name/
 * photo/member count, tap -> info screen), built on the SAME shared
 * message-bubble/input-bar components so reactions/reply/read-receipts
 * aren't duplicated between the two screens.
 */
export function GroupChatScreen() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const me = auth?.currentUser?.uid;

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const gifInputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!groupId) return;
    const off = observeGroup(groupId, setGroup);
    return off;
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const off = observeGroupMessages(groupId, setMessages);
    return off;
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    setActiveChatPartnerUid(groupId);
    return () => setActiveChatPartnerUid(null);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    markChatRead(groupId);
  }, [groupId, messages.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!group?.participants) return;
    const missing = group.participants.filter((uid) => uid !== me && !(uid in memberNames));
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(missing.map((uid) => fetchUser(uid).then((u) => [uid, u]))).then((pairs) => {
      if (!alive) return;
      setMemberNames((prev) => {
        const next = { ...prev };
        pairs.forEach(([uid, u]) => {
          if (u) next[uid] = u.displayName?.trim() || 'Unknown';
        });
        return next;
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.participants]);

  if (!group) {
    return <LoadingShell title="Group" onBack={() => navigate(routes.chat)} />;
  }

  const lastMsg = messages[messages.length - 1];
  const lastMsgMs = lastMsg?.timestamp?.toMillis?.() ?? 0;
  const others = (group.participants || []).filter((uid) => uid !== me);
  const seenByAll =
    lastMsgMs > 0 &&
    others.length > 0 &&
    others.every((uid) => (group.lastRead?.[uid]?.toMillis?.() ?? 0) >= lastMsgMs);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setDraft('');
    const pendingReply = replyTo;
    setReplyTo(null);
    try {
      await sendGroupText(groupId, text, pendingReply);
    } catch (e) {
      setError(e.message);
      setDraft(text);
      setReplyTo(pendingReply);
    }
  };

  const handleGif = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await sendGroupMedia(groupId, file, 'gif');
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh - 64px)',
        maxWidth: 960,
        mx: 'auto',
        width: '100%',
      }}
    >
      <GroupHeader
        group={group}
        onBack={() => navigate(routes.chat)}
        onInfo={() => navigate(routes.groupInfo(groupId))}
      />

      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, sm: 2 }, py: 2 }}>
        <Stack spacing={1}>
          {messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              msg={m}
              fromMe={m.senderId === me}
              myUid={me}
              seen={m.senderId === me && idx === messages.length - 1 && seenByAll}
              senderLabel={m.senderId !== me ? memberNames[m.senderId] || '…' : null}
              onReact={(emoji) => {
                const mine = m.reactions?.[me];
                toggleReaction(groupId, m.id, emoji, mine);
              }}
              onReply={() =>
                setReplyTo({
                  messageId: m.id,
                  senderId: m.senderId,
                  text: m.text || (m.type === 'image' ? '📷 Photo' : m.type === 'gif' ? '🎞️ GIF' : 'Message'),
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
          <Typography variant="caption" color="text.secondary">Uploading…</Typography>
        </Stack>
      )}

      <ReplyComposerStrip replyTo={replyTo} onCancel={() => setReplyTo(null)} />

      <InputBar
        draft={draft}
        onChange={(v) => { setDraft(v); setError(null); }}
        onSend={handleSend}
        onEmojiClick={(e) => setEmojiAnchor(e.currentTarget)}
        onGifClick={() => gifInputRef.current?.click()}
      />

      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif"
        hidden
        onChange={(e) => {
          handleGif(e.target.files?.[0]);
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
        <EmojiGrid onPick={(emoji) => { setDraft((d) => d + emoji); setEmojiAnchor(null); }} />
      </Popover>
    </Box>
  );
}

function GroupHeader({ group, onBack, onInfo }) {
  const memberCount = (group.participants || []).length;
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
        onClick={onInfo}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInfo?.(); }
        }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, cursor: 'pointer',
          borderRadius: 1, px: 0.5, mx: -0.5,
          '@media (hover: hover)': { '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' } },
        }}
      >
        <Box
          sx={{
            width: 40, height: 40, borderRadius: '50%', backgroundColor: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
          }}
        >
          {group.groupPhotoUrl ? (
            <Box component="img" src={group.groupPhotoUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <GroupIcon sx={{ color: '#fff' }} />
          )}
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{group.groupName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </Typography>
        </Stack>
      </Box>
      <IconButton onClick={onInfo} sx={{ color: 'text.primary' }} aria-label="Group info">
        <InfoOutlinedIcon />
      </IconButton>
    </Stack>
  );
}
