import { useState } from 'react';
import { Box, CircularProgress, IconButton, Popover, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplyIcon from '@mui/icons-material/Reply';
import AddReactionIcon from '@mui/icons-material/AddReaction';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SendIcon from '@mui/icons-material/Send';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import GifIcon from '@mui/icons-material/Gif';
import ImageIcon from '@mui/icons-material/Image';
import { MSG_IMAGE, MSG_GIF, MSG_SYSTEM, formatMessageTime } from './chatRepository.js';

// Mirrors ChatMessageComponents.kt — message-bubble rendering + input bar
// shared by ChatConversationScreen (1:1) and GroupChatScreen, so the
// reactions/reply/read-receipt UI is built once instead of duplicated.
// The two screens keep their own headers/data-loading — only the render
// layer lives here.

export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const EMOJI_SET = [
  '😀', '😂', '🥹', '😍', '😎', '🤔', '🙃', '😴',
  '👍', '🙏', '👏', '🔥', '🎉', '💯', '❤️', '💜',
  '🚀', '✨', '⭐', '🌈', '☕', '🍕', '🎵', '📸',
];

export function MessageBubble({
  msg,
  fromMe,
  myUid,
  seen = false,
  senderLabel = null,
  onReact,
  onReply,
}) {
  if (msg.type === MSG_SYSTEM) {
    return <SystemMessageLine text={msg.text || ''} />;
  }

  const time = msg.timestamp?.toMillis ? formatMessageTime(msg.timestamp.toMillis()) : '';
  const myReaction = myUid ? msg.reactions?.[myUid] : null;

  return (
    <Stack alignItems={fromMe ? 'flex-end' : 'flex-start'} spacing={0.25}>
      {senderLabel && !fromMe && (
        <Typography variant="caption" sx={{ px: 0.75, fontWeight: 600, color: 'primary.main' }}>
          {senderLabel}
        </Typography>
      )}
      {msg.replyToId && <ReplyQuoteStrip text={msg.replyToText || 'Message'} />}

      <Stack direction="row" alignItems="center" spacing={0.5}>
        {fromMe && <BubbleActions onReact={onReact} onReply={onReply} />}
        {msg.type === MSG_IMAGE || msg.type === MSG_GIF ? (
          <MediaBubble url={msg.mediaUrl} tag={msg.type === MSG_GIF ? 'GIF' : 'PHOTO'} fromMe={fromMe} />
        ) : (
          <TextBubble text={msg.text || ''} fromMe={fromMe} />
        )}
        {!fromMe && <BubbleActions onReact={onReact} onReply={onReply} />}
      </Stack>

      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <ReactionChipsRow reactions={msg.reactions} myUid={myUid} onToggle={(emoji) => onReact?.(emoji)} />
      )}

      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 0.75, pt: 0.25 }}>
        <Typography variant="caption" color="text.secondary">
          {time}
        </Typography>
        {fromMe && (
          seen
            ? <DoneAllIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            : <CheckIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        )}
      </Stack>
    </Stack>
  );
}

function BubbleActions({ onReact, onReply }) {
  const [anchor, setAnchor] = useState(null);
  if (!onReact && !onReply) return null;
  return (
    <Stack direction="row" spacing={0}>
      {onReact && (
        <>
          <IconButton
            size="small"
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ color: 'text.secondary', opacity: 0.6 }}
            aria-label="React"
          >
            <AddReactionIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Popover
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{
              paper: {
                sx: {
                  backgroundColor: 'rgba(24,16,35,0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                },
              },
            }}
          >
            <ReactionPicker onPick={(emoji) => { onReact(emoji); setAnchor(null); }} />
          </Popover>
        </>
      )}
      {onReply && (
        <IconButton size="small" onClick={onReply} sx={{ color: 'text.secondary', opacity: 0.6 }} aria-label="Reply">
          <ReplyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Stack>
  );
}

function SystemMessageLine({ text }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 0.5 }}>
      <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <Typography variant="caption" color="text.secondary">{text}</Typography>
      </Box>
    </Box>
  );
}

function ReplyQuoteStrip({ text }) {
  return (
    <Box
      sx={{
        maxWidth: 260,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: 1.25,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Box sx={{ width: 3, height: 20, backgroundColor: 'primary.main', borderRadius: 1 }} />
      <Typography variant="caption" color="text.secondary" noWrap>{text}</Typography>
    </Box>
  );
}

function ReactionChipsRow({ reactions, myUid, onToggle }) {
  const counts = {};
  Object.values(reactions).forEach((emoji) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
  });
  const mine = myUid ? reactions[myUid] : null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ px: 0.75 }}>
      {Object.entries(counts).map(([emoji, count]) => (
        <Box
          key={emoji}
          onClick={() => onToggle(emoji)}
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1.5,
            fontSize: 12,
            cursor: 'pointer',
            backgroundColor: emoji === mine ? 'rgba(124,156,255,0.25)' : 'rgba(255,255,255,0.08)',
          }}
        >
          {emoji} {count}
        </Box>
      ))}
    </Stack>
  );
}

export function ReplyComposerStrip({ replyTo, onCancel }) {
  if (!replyTo) return null;
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mx: 1, mb: 0.5, px: 1.25, py: 0.75, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      <ReplyIcon sx={{ fontSize: 18 }} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>Replying to</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>{replyTo.text || 'Message'}</Typography>
      </Stack>
      <IconButton size="small" onClick={onCancel} aria-label="Cancel reply">
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  );
}

/** Quick-react row + a "more" grid — used from a message's react icon. */
export function ReactionPicker({ onPick }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ p: 1 }}>
      {QUICK_REACTION_EMOJIS.map((emoji) => (
        <Box
          key={emoji}
          onClick={() => onPick(emoji)}
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            borderRadius: '50%',
            cursor: 'pointer',
            '@media (hover: hover)': { '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } },
          }}
        >
          {emoji}
        </Box>
      ))}
    </Stack>
  );
}

export function EmojiGrid({ onPick }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5 }}>
      {EMOJI_SET.map((emoji) => (
        <Box
          key={emoji}
          onClick={() => onPick(emoji)}
          sx={{
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            borderRadius: 1,
            cursor: 'pointer',
            '@media (hover: hover)': { '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } },
          }}
        >
          {emoji}
        </Box>
      ))}
    </Box>
  );
}

export function TextBubble({ text, fromMe }) {
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

export function MediaBubble({ url, tag, fromMe }) {
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

/** `onImageClick` is optional — group chats skip the raw-image picker, GIF-only like Android. */
export function InputBar({ draft, onChange, onSend, onEmojiClick, onImageClick, onGifClick }) {
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
      {onImageClick && (
        <IconButton onClick={onImageClick} sx={{ color: 'text.secondary' }} aria-label="Image">
          <ImageIcon />
        </IconButton>
      )}
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

export function LoadingShell({ title, onBack, message }) {
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
