import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { computeInitials } from '../../data/userProfile.js';
import {
  observeChatPreviews,
  gradientForUser,
  formatPreviewTime,
} from './chatRepository.js';
import { routes } from '../../routes.js';

export function ChatScreen() {
  const navigate = useNavigate();
  const [previews, setPreviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const off = observeChatPreviews((p) => {
      setPreviews(p);
      setLoaded(true);
    });
    return off;
  }, []);

  return (
    <FeatureScaffold title="Chat">
      {loaded && previews.length === 0 ? (
        <EmptyState />
      ) : (
        <Stack spacing={1.25}>
          {previews.map((preview) => (
            <ChatPreviewCard
              key={preview.user.uid}
              preview={preview}
              onClick={() => navigate(routes.chatConversation(preview.user.uid))}
            />
          ))}
        </Stack>
      )}
    </FeatureScaffold>
  );
}

function EmptyState() {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 8, textAlign: 'center' }}>
      <ForumIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        No one to chat with yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        Sign up another account in a different browser or on Android to see them here.
      </Typography>
    </Stack>
  );
}

function ChatPreviewCard({ preview, onClick }) {
  const { user, lastMessage, lastTimeMs } = preview;
  const hasChat = lastTimeMs > 0;
  const accent = gradientForUser(user.uid);

  return (
    <GlassCard onClick={onClick} accentColors={accent} contentPadding={1.75}>
      <Stack direction="row" alignItems="center" spacing={1.75}>
        <GradientAvatar user={user} gradient={accent} />
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: hasChat ? 700 : 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.displayName || 'Unknown'}
            </Typography>
            {hasChat && (
              <Typography variant="caption" color="text.secondary">
                {formatPreviewTime(lastTimeMs)}
              </Typography>
            )}
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mt: 0.25,
            }}
          >
            {hasChat ? lastMessage || '[Media]' : 'Tap to start a chat'}
          </Typography>
        </Stack>
      </Stack>
    </GlassCard>
  );
}

function GradientAvatar({ user, gradient }) {
  const initials = user.initials || computeInitials(user.displayName || '');
  return (
    <Box
      sx={{
        width: 58,
        height: 58,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
        border: '2px solid rgba(255,255,255,0.20)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: 20,
        flexShrink: 0,
      }}
    >
      {initials}
    </Box>
  );
}
