import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LogoutIcon from '@mui/icons-material/Logout';
import { auth } from '../../data/firebase.js';
import { fetchUser, observeOtherUsers } from './chatRepository.js';
import {
  observeGroup,
  observeMyInvitesFor,
  renameGroup,
  setGroupPhoto,
  removeMember,
  leaveGroup,
  inviteMembers,
  cancelInvite,
} from './groupRepository.js';
import { computeInitials } from '../../data/userProfile.js';
import { routes } from '../../routes.js';
import { LoadingShell } from './ChatMessageComponents.jsx';

/**
 * Admin toolkit + member list — rename, photo (admin), add/remove members
 * (admin), leave group (anyone). Owner-leaves edge case is an accepted
 * simplification: adminUids (not ownerUid) gates permissions, so a group
 * can end up admin-less if every admin leaves. Mirrors GroupInfoScreen.kt.
 */
export function GroupInfoScreen() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const me = auth?.currentUser?.uid;
  const photoInputRef = useRef(null);

  const [group, setGroup] = useState(null);
  const [myInvites, setMyInvites] = useState([]);
  const [memberNames, setMemberNames] = useState({});
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    return observeGroup(groupId, setGroup);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    return observeMyInvitesFor(groupId, setMyInvites);
  }, [groupId]);

  useEffect(() => {
    if (!group?.participants) return;
    const uids = [...group.participants, ...myInvites.map((i) => i.invitedUid)].filter(
      (uid) => uid && !(uid in memberNames)
    );
    if (uids.length === 0) return;
    let alive = true;
    Promise.all(uids.map((uid) => fetchUser(uid).then((u) => [uid, u]))).then((pairs) => {
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
  }, [group?.participants, myInvites]);

  if (!group) {
    return <LoadingShell title="Group info" onBack={() => navigate(-1)} />;
  }

  const isAdmin = me && (group.adminUids || []).includes(me);

  const handleRenameSave = async () => {
    setRenaming(false);
    try {
      await renameGroup(groupId, nameDraft);
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    try {
      await setGroupPhoto(groupId, file);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', width: '100%', px: 2, py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ color: 'text.primary', ml: -1 }} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Group info</Typography>
      </Stack>

      <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
        <Box
          onClick={() => isAdmin && photoInputRef.current?.click()}
          sx={{
            width: 88, height: 88, borderRadius: '50%', backgroundColor: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            cursor: isAdmin ? 'pointer' : 'default',
          }}
        >
          {group.groupPhotoUrl ? (
            <Box component="img" src={group.groupPhotoUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <GroupIcon sx={{ color: '#fff', fontSize: 40 }} />
          )}
        </Box>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            handlePhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {renaming ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <TextField value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} size="small" autoFocus />
            <IconButton onClick={handleRenameSave} aria-label="Save"><CheckIcon /></IconButton>
            <IconButton onClick={() => setRenaming(false)} aria-label="Cancel"><CloseIcon /></IconButton>
          </Stack>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{group.groupName}</Typography>
            {isAdmin && (
              <IconButton size="small" onClick={() => { setNameDraft(group.groupName); setRenaming(true); }} aria-label="Rename">
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary">
          {(group.participants || []).length} member{(group.participants || []).length === 1 ? '' : 's'}
        </Typography>
      </Stack>

      {error && <Typography color="error" variant="caption">{error}</Typography>}

      {isAdmin && (
        <Button
          startIcon={<GroupAddIcon />}
          variant="outlined"
          fullWidth
          onClick={() => setShowAddMembers(true)}
          sx={{ my: 1 }}
        >
          Add members
        </Button>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5 }}>Members</Typography>
      <List>
        {(group.participants || []).map((uid) => (
          <MemberRow
            key={uid}
            name={uid === me ? 'You' : memberNames[uid] || '…'}
            isAdmin={(group.adminUids || []).includes(uid)}
            showRemove={isAdmin && uid !== me}
            onRemove={() => setPendingRemove(uid)}
          />
        ))}
      </List>

      {myInvites.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 0.5 }}>Invited (pending)</Typography>
          <List>
            {myInvites.map((invite) => (
              <Stack key={invite.inviteId} direction="row" alignItems="center" spacing={1.5} sx={{ px: 1, py: 1 }}>
                <HourglassEmptyIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {memberNames[invite.invitedUid] || '…'}
                </Typography>
                <Button size="small" onClick={() => cancelInvite(groupId, invite.invitedUid)}>Cancel</Button>
              </Stack>
            ))}
          </List>
        </>
      )}

      <Button
        startIcon={<LogoutIcon />}
        variant="outlined"
        color="error"
        fullWidth
        onClick={() => setShowLeaveConfirm(true)}
        sx={{ mt: 3 }}
      >
        Leave group
      </Button>

      <Dialog open={showLeaveConfirm} onClose={() => setShowLeaveConfirm(false)}>
        <DialogTitle>Leave group?</DialogTitle>
        <DialogContent>
          <Typography>
            You'll stop seeing new messages in "{group.groupName}" unless someone invites you back.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeaveConfirm(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              setShowLeaveConfirm(false);
              await leaveGroup(groupId);
              navigate(routes.chat, { replace: true });
            }}
          >
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingRemove)} onClose={() => setPendingRemove(null)}>
        <DialogTitle>Remove member?</DialogTitle>
        <DialogContent>
          <Typography>{memberNames[pendingRemove] || 'This person'} will stop seeing new messages.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemove(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              const uid = pendingRemove;
              setPendingRemove(null);
              await removeMember(groupId, uid, memberNames[uid] || 'Someone');
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <AddMembersDialog
        open={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        excludeUids={new Set([...(group.participants || []), ...myInvites.map((i) => i.invitedUid)])}
        onAdd={async (uids) => {
          await inviteMembers(groupId, group.groupName, uids);
          setShowAddMembers(false);
        }}
      />
    </Box>
  );
}

function MemberRow({ name, isAdmin, showRemove, onRemove }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1, py: 1 }}>
      <Avatar>{computeInitials(name)}</Avatar>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography>
        {isAdmin && <Typography variant="caption" color="primary.main">Admin</Typography>}
      </Stack>
      {showRemove && (
        <IconButton onClick={onRemove} sx={{ color: 'error.main' }} aria-label="Remove">
          <PersonRemoveIcon />
        </IconButton>
      )}
    </Stack>
  );
}

function AddMembersDialog({ open, onClose, excludeUids, onAdd }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    return observeOtherUsers(setUsers);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setError(null);
      setInviting(false);
    }
  }, [open]);

  const handleInvite = async () => {
    if (inviting || selected.size === 0) return;
    setInviting(true);
    setError(null);
    try {
      await onAdd(Array.from(selected));
    } catch (e) {
      // Without this, a failed invite left the dialog silently stuck open
      // with no feedback — the actual bug behind the "invite modal won't
      // close" report (a rules gotcha that's since been fixed, but this
      // stays as a real safety net for any future failure too).
      setError(e.message || "Couldn't send invites");
    } finally {
      setInviting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => !excludeUids.has(u.uid))
      .filter((u) => !q || (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  }, [users, query, excludeUids]);

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Add members</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField label="Search" value={query} onChange={(e) => setQuery(e.target.value)} size="small" fullWidth />
        <List sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.map((u) => (
            <ListItemButton key={u.uid} onClick={() => toggle(u.uid)} sx={{ borderRadius: 1.5 }}>
              <ListItemAvatar>
                <Avatar>{u.initials || computeInitials(u.displayName || '')}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={u.displayName || 'Unknown'} />
              <Checkbox checked={selected.has(u.uid)} edge="end" />
            </ListItemButton>
          ))}
        </List>
        {error && <Typography color="error" variant="caption">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={inviting}>Cancel</Button>
        <Button variant="contained" disabled={selected.size === 0 || inviting} onClick={handleInvite}>
          {inviting ? 'Inviting…' : `Invite ${selected.size > 0 ? selected.size : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
