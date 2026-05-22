import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockIcon from '@mui/icons-material/Lock';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LanguageIcon from '@mui/icons-material/Language';
import PaletteIcon from '@mui/icons-material/Palette';
import InfoIcon from '@mui/icons-material/Info';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckIcon from '@mui/icons-material/Check';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { IconBadge } from '../../ui/IconBadge.jsx';
import { useCurrentUser } from '../../data/UserSession.jsx';
import { computeInitials } from '../../data/userProfile.js';
import { useYoloPalette } from '../../theme/ThemeProvider.jsx';
import { palettes } from '../../theme/palettes.js';
import { signOutUser, updateDisplayName, changePassword } from '../auth/authRepository.js';
import { routes } from '../../routes.js';
import {
  getNotificationsEnabledPref,
  isNotificationsSupported,
  requestNotificationPermission,
  setNotificationsEnabledPref,
} from '../chat/chatNotifications.js';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [notifications, setNotificationsState] = useState(() => getNotificationsEnabledPref());

  // Reflect a permission revoke that happens outside this tab.
  useEffect(() => {
    if (notifications && isNotificationsSupported() && Notification.permission !== 'granted') {
      setNotificationsEnabledPref(false);
      setNotificationsState(false);
    }
  }, [notifications]);

  const setNotifications = async (next) => {
    if (next) {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        setNotificationsEnabledPref(false);
        setNotificationsState(false);
        return;
      }
    }
    setNotificationsEnabledPref(next);
    setNotificationsState(next);
    window.dispatchEvent(new Event('yolo:notif-pref-changed'));
  };
  const [editProfile, setEditProfile] = useState(false);
  const [pwd, setPwd] = useState(false);

  const displayName = user?.displayName?.trim() || 'Yolo User';
  const email = user?.email ?? '';
  const initials = computeInitials(displayName);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } finally {
      navigate(routes.auth, { replace: true });
    }
  };

  return (
    <FeatureScaffold title="Settings">
      <Stack spacing={1.25}>
        <ProfileCard name={displayName} email={email} initials={initials} />

        <SectionLabel>Account</SectionLabel>
        <GlassCard contentPadding={0}>
          <NavRow
            icon={<AccountCircleIcon />}
            accent={['#5A8DEE', '#1A237E']}
            title="Edit profile"
            onClick={() => setEditProfile(true)}
          />
          <DividerLine />
          <NavRow
            icon={<LockIcon />}
            accent={['#B85AC1', '#6A1B9A']}
            title="Change password"
            onClick={() => setPwd(true)}
          />
          <DividerLine />
          <NavRow
            icon={<PrivacyTipIcon />}
            accent={['#FF7AB6', '#AD1457']}
            title="Privacy"
            onClick={() => navigate(routes.privacy)}
          />
        </GlassCard>

        <SectionLabel>App</SectionLabel>
        <GlassCard contentPadding={0}>
          <ToggleRow
            icon={<DarkModeIcon />}
            accent={['#263238', '#000000']}
            title="Dark mode"
            checked
            disabled
          />
          <DividerLine />
          <ToggleRow
            icon={<NotificationsIcon />}
            accent={['#FF9F73', '#E65100']}
            title="Notifications"
            checked={notifications}
            onChange={setNotifications}
          />
          <DividerLine />
          <NavRow
            icon={<LanguageIcon />}
            accent={['#00BFA5', '#1B5E20']}
            title="Language"
            trailingText="English"
            onClick={() => {}}
          />
        </GlassCard>

        <SectionLabel>Appearance</SectionLabel>
        <AppearanceCard />

        <SectionLabel>About</SectionLabel>
        <GlassCard contentPadding={0}>
          <NavRow
            icon={<InfoIcon />}
            accent={['#A8C7FF', '#263238']}
            title="About Yolo AIO"
            trailingText="v1.0"
            onClick={() => {}}
          />
        </GlassCard>

        <Box sx={{ height: 8 }} />
        <GlassCard onClick={handleSignOut} contentPadding={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LogoutIcon sx={{ color: 'error.main' }} />
            <Typography variant="subtitle1" sx={{ color: 'error.main', fontWeight: 600 }}>
              Sign out
            </Typography>
          </Stack>
        </GlassCard>
      </Stack>

      {editProfile && (
        <EditProfileDialog initialName={displayName} onClose={() => setEditProfile(false)} />
      )}
      {pwd && <ChangePasswordDialog onClose={() => setPwd(false)} />}
    </FeatureScaffold>
  );
}

function ProfileCard({ name, email, initials }) {
  return (
    <GlassCard strong contentPadding={2.5} radius={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF7AB6 0%, #B85AC1 50%, #7C9CFF 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 20,
          }}
        >
          {initials}
        </Box>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email}
          </Typography>
        </Stack>
      </Stack>
    </GlassCard>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        color: 'primary.main',
        fontWeight: 700,
        pt: 1.5,
        pb: 0.25,
        pl: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function NavRow({ icon, accent, title, trailingText, onClick }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.75}
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <IconBadge icon={icon} colors={accent} />
      <Typography variant="body1" sx={{ flex: 1 }}>
        {title}
      </Typography>
      {trailingText && (
        <Typography variant="body2" color="text.secondary">
          {trailingText}
        </Typography>
      )}
      <ChevronRightIcon sx={{ color: 'text.secondary' }} />
    </Stack>
  );
}

function ToggleRow({ icon, accent, title, checked, onChange, disabled }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.75} sx={{ px: 2, py: 1.5 }}>
      <IconBadge icon={icon} colors={accent} />
      <Typography variant="body1" sx={{ flex: 1 }}>
        {title}
      </Typography>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#34C759', opacity: 1 },
        }}
      />
    </Stack>
  );
}

function DividerLine() {
  return <Divider sx={{ ml: 8, borderColor: 'rgba(255,255,255,0.25)' }} />;
}

function AppearanceCard() {
  const { palette, setPalette } = useYoloPalette();
  return (
    <GlassCard contentPadding={0}>
      <Stack direction="row" alignItems="center" spacing={1.75} sx={{ px: 2, py: 1.5 }}>
        <IconBadge icon={<PaletteIcon />} colors={['#E0AAFF', '#6A1B9A']} />
        <Stack sx={{ flex: 1 }}>
          <Typography variant="body1">Color theme</Typography>
          <Typography variant="caption" color="text.secondary">
            {palette.displayName}
          </Typography>
        </Stack>
      </Stack>
      <Divider sx={{ ml: 8, borderColor: 'rgba(255,255,255,0.25)' }} />
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1.5, py: 1.75 }}>
        {palettes.map((p) => {
          const isSelected = p.key === palette.key;
          return (
            <Stack key={p.key} alignItems="center" sx={{ flex: 1 }}>
              <Box
                onClick={() => setPalette(p)}
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${p.primary} 0%, ${p.secondary} 50%, ${p.tertiary} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  outline: isSelected ? `2px solid ${p.primary}` : 'none',
                  outlineOffset: 2,
                }}
              >
                {isSelected && <CheckIcon sx={{ fontSize: 20 }} />}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  color: isSelected ? 'primary.main' : 'text.secondary',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {p.displayName}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </GlassCard>
  );
}

function EditProfileDialog({ initialName, onClose }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const canSave = name.trim().length > 0 && name.trim() !== initialName && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(name);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 600 }}>Edit profile</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <TextField
            label="Display name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            disabled={saving}
            fullWidth
            margin="dense"
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {saving ? <CircularProgress size={16} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChangePasswordDialog({ onClose }) {
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit =
    current.length > 0 && newPwd.length >= 6 && newPwd === confirm && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, newPwd);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 600 }}>Change password</DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <TextField
            label="Current password"
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setError(null);
            }}
            disabled={saving}
            fullWidth
            margin="dense"
          />
          <TextField
            label="New password (6+ chars)"
            type="password"
            value={newPwd}
            onChange={(e) => {
              setNewPwd(e.target.value);
              setError(null);
            }}
            disabled={saving}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            disabled={saving}
            error={confirm.length > 0 && confirm !== newPwd}
            helperText={confirm.length > 0 && confirm !== newPwd ? "Passwords don't match" : ' '}
            fullWidth
            margin="dense"
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {saving ? <CircularProgress size={16} /> : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
