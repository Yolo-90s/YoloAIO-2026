import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import GroupIcon from '@mui/icons-material/Group';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { computeInitials } from '../../data/userProfile.js';
import {
  observeChatPreviews,
  gradientForUser,
  formatPreviewTime,
} from './chatRepository.js';
import { observeMyGroupChats, observePendingInvites, acceptInvite, declineInvite, reconcileAcceptedInvites } from './groupRepository.js';
import { PendingInvitesBanner } from './PendingInvitesBanner.jsx';
import { CreateGroupDialog } from './CreateGroupDialog.jsx';
import { routes } from '../../routes.js';

// No more "browse every registered user" default — that leaked everyone
// who's ever signed into the app onto the first screen. Default view is
// just your own conversations (chats you've actually exchanged a message
// in, plus any group you've joined); typing in the search bar is the only
// way to look up someone new, searching the full directory by name/email,
// and tapping a result opens (or lazily starts) that conversation. Groups
// aren't part of that directory search — you join one via an invite, not
// by finding it. Mirrors ChatScreen.kt.
export function ChatScreen() {
  const navigate = useNavigate();
  const [previews, setPreviews] = useState([]);
  const [groupPreviews, setGroupPreviews] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const off = observeChatPreviews((p) => {
      setPreviews(p);
      setLoaded(true);
    });
    return off;
  }, []);

  useEffect(() => observeMyGroupChats(setGroupPreviews), []);
  useEffect(() => observePendingInvites(setPendingInvites), []);

  // Covers a crash between accept-invite's two writes — cheap, safe on
  // every load.
  useEffect(() => {
    reconcileAcceptedInvites();
  }, []);

  const hasQuery = query.trim().length > 0;

  const conversations = useMemo(
    () => previews.filter((p) => p.lastTimeMs > 0),
    [previews]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return previews.filter(
      (p) =>
        (p.user.displayName || '').toLowerCase().includes(q) ||
        (p.user.email || '').toLowerCase().includes(q)
    );
  }, [previews, query]);

  const mergedItems = useMemo(() => {
    const direct = conversations.map((p) => ({ kind: 'direct', key: `d_${p.user.uid}`, lastTimeMs: p.lastTimeMs, preview: p }));
    const groups = groupPreviews.map((g) => ({ kind: 'group', key: `g_${g.chatId}`, lastTimeMs: g.lastTimeMs, preview: g }));
    return [...direct, ...groups].sort((a, b) => b.lastTimeMs - a.lastTimeMs);
  }, [conversations, groupPreviews]);

  const displayed = hasQuery
    ? searchResults.map((p) => ({ kind: 'direct', key: `d_${p.user.uid}`, preview: p }))
    : mergedItems;

  return (
    <FeatureScaffold
      title="Chat"
      search={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or email"
        />
      }
      actions={
        <IconButton onClick={() => setCreateOpen(true)} aria-label="New group" sx={{ color: 'text.primary' }}>
          <GroupAddIcon />
        </IconButton>
      }
    >
      {!hasQuery && pendingInvites.length > 0 && (
        <PendingInvitesBanner
          invites={pendingInvites}
          onAccept={(invite) => acceptInvite(invite)}
          onDecline={(invite) => declineInvite(invite)}
        />
      )}
      {loaded && displayed.length === 0 ? (
        <EmptyState hasQuery={hasQuery} query={query} />
      ) : (
        <Stack spacing={1.25}>
          {displayed.map((item) =>
            item.kind === 'direct' ? (
              <ChatPreviewCard
                key={item.key}
                preview={item.preview}
                onClick={() => navigate(routes.chatConversation(item.preview.user.uid))}
              />
            ) : (
              <GroupPreviewCard
                key={item.key}
                preview={item.preview}
                onClick={() => navigate(routes.group(item.preview.chatId))}
              />
            )
          )}
        </Stack>
      )}

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(chatId) => {
          setCreateOpen(false);
          navigate(routes.group(chatId));
        }}
      />
    </FeatureScaffold>
  );
}

function EmptyState({ hasQuery, query }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 8, textAlign: 'center' }}>
      {hasQuery ? (
        <SearchIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      ) : (
        <ForumIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
      )}
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {hasQuery ? `No matches for "${query}"` : 'No conversations yet'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {hasQuery
          ? 'Try a different name or email.'
          : 'Search for someone by name or email to start a conversation.'}
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

function GroupPreviewCard({ preview, onClick }) {
  const hasMessages = preview.lastTimeMs > 0;
  return (
    <GlassCard onClick={onClick} contentPadding={1.75}>
      <Stack direction="row" alignItems="center" spacing={1.75}>
        <Box
          sx={{
            width: 58, height: 58, borderRadius: '50%',
            background: `linear-gradient(135deg, ${gradientForUser(preview.chatId)[0]} 0%, ${gradientForUser(preview.chatId)[1]} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <GroupIcon sx={{ color: '#fff' }} />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {preview.groupName}
            </Typography>
            {hasMessages && (
              <Typography variant="caption" color="text.secondary">
                {formatPreviewTime(preview.lastTimeMs)}
              </Typography>
            )}
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}
          >
            {hasMessages ? preview.lastMessage || '[Media]' : `${preview.memberCount} member${preview.memberCount === 1 ? '' : 's'}`}
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
