import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { observeOtherUsers } from './chatRepository.js';
import { createGroup } from './groupRepository.js';
import { computeInitials, avatarColorToCss } from '../../data/userProfile.js';

/**
 * Member picker + name field, opened from Chat's FAB. Reuses the same
 * directory listener the Chat list's own search bar uses — observeOtherUsers
 * — just made multi-select instead of tap-to-open. Mirrors CreateGroupScreen.kt.
 */
export function CreateGroupDialog({ open, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    return observeOtherUsers(setUsers);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setName('');
      setQuery('');
      setSelected(new Set());
      setError(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const chatId = await createGroup(name, Array.from(selected));
      onCreated(chatId);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>New group</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Search people to add"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          size="small"
        />
        {selected.size > 0 && (
          <Typography variant="caption" color="text.secondary">
            {selected.size} selected
          </Typography>
        )}
        <List sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.map((u) => (
            <ListItemButton key={u.uid} onClick={() => toggle(u.uid)} sx={{ borderRadius: 1.5 }}>
              <ListItemAvatar>
                <Avatar sx={{ background: avatarColorToCss(u.avatarColor) }}>
                  {u.initials || computeInitials(u.displayName || '')}
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={u.displayName || 'Unknown'} secondary={u.email} />
              <Checkbox checked={selected.has(u.uid)} edge="end" />
            </ListItemButton>
          ))}
        </List>
        {error && <Typography color="error" variant="caption">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={selected.size === 0 || creating}
        >
          {creating ? <CircularProgress size={16} /> : 'Create group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
