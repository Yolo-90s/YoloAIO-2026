import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PhotoIcon from '@mui/icons-material/Photo';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import BlockIcon from '@mui/icons-material/Block';
import DownloadIcon from '@mui/icons-material/Download';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { IconBadge } from '../../ui/IconBadge.jsx';
import {
  usePrivacyPrefs,
  VISIBILITY_PRIVATE,
  VISIBILITY_PUBLIC,
} from './privacyPrefs.js';

export function PrivacyScreen() {
  const prefs = usePrivacyPrefs();
  const [dataDialog, setDataDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  return (
    <FeatureScaffold title="Privacy">
      <Stack spacing={1.25}>
        {/* ── Quote sharing ── */}
        <SectionLabel>Quote sharing</SectionLabel>
        <GlassCard contentPadding={0}>
          <HeaderRow
            icon={<VisibilityIcon />}
            accent={['#B85AC1', '#6A1B9A']}
            title="Default visibility"
            subtitle="Pre-selected when you create a new quote."
          />
          <Divider sx={{ ml: 8, borderColor: 'divider' }} />
          <VisibilityRadio
            icon={<LockIcon />}
            title="Private"
            subtitle="Only you can see it"
            selected={prefs.defaultVisibility === VISIBILITY_PRIVATE}
            onClick={() => prefs.setDefaultVisibility(VISIBILITY_PRIVATE)}
          />
          <Divider sx={{ ml: 8, borderColor: 'divider' }} />
          <VisibilityRadio
            icon={<PublicIcon />}
            title="Public"
            subtitle="Everyone signed in can see it"
            selected={prefs.defaultVisibility === VISIBILITY_PUBLIC}
            onClick={() => prefs.setDefaultVisibility(VISIBILITY_PUBLIC)}
          />
        </GlassCard>
        <HintCard>
          You can still override this per-quote in the editor — this just pre-selects the choice.
        </HintCard>

        {/* ── Profile ── */}
        <SectionLabel>Profile</SectionLabel>
        <GlassCard contentPadding={0}>
          <ToggleRow
            icon={<PersonSearchIcon />}
            accent={['#5A8DEE', '#1A237E']}
            title="Discoverable in chat"
            subtitle="Others can find you when starting a new conversation."
            checked={prefs.discoverableInChat}
            onChange={prefs.setDiscoverable}
          />
          <DividerLine />
          <ToggleRow
            icon={<PhotoIcon />}
            accent={['#FF9F73', '#E65100']}
            title="Show profile photo"
            subtitle="Hide your avatar from people you haven't chatted with."
            checked={prefs.showProfilePhoto}
            onChange={prefs.setShowPhoto}
          />
        </GlassCard>

        {/* ── Chat ── */}
        <SectionLabel>Chat</SectionLabel>
        <GlassCard contentPadding={0}>
          <ToggleRow
            icon={<RadioButtonCheckedIcon />}
            accent={['#00BFA5', '#1B5E20']}
            title="Show online status"
            subtitle="Let others see when you're active."
            checked={prefs.showOnlineStatus}
            onChange={prefs.setShowOnline}
          />
          <DividerLine />
          <ToggleRow
            icon={<VisibilityIcon />}
            accent={['#A8C7FF', '#263238']}
            title="Read receipts"
            subtitle="Notify senders when you've read their messages."
            checked={prefs.readReceipts}
            onChange={prefs.setReadReceipts}
          />
          <DividerLine />
          <ActionRow
            icon={<BlockIcon />}
            accent={['#EF5350', '#B71C1C']}
            title="Blocked accounts"
            subtitle="Manage who can't message or see you."
            onClick={() => {}}
          />
        </GlassCard>

        {/* ── Data ── */}
        <SectionLabel>Your data</SectionLabel>
        <GlassCard contentPadding={0}>
          <ActionRow
            icon={<DownloadIcon />}
            accent={['#E0AAFF', '#6A1B9A']}
            title="Download my data"
            subtitle="Get a copy of your quotes, chats, and profile."
            onClick={() => setDataDialog(true)}
          />
          <DividerLine />
          <ActionRow
            icon={<RemoveCircleIcon />}
            accent={['#EF5350', '#B71C1C']}
            title="Delete account"
            subtitle="Permanently remove your account and all data."
            destructive
            onClick={() => setDeleteDialog(true)}
          />
        </GlassCard>
        <Box sx={{ height: 16 }} />
      </Stack>

      <Dialog open={dataDialog} onClose={() => setDataDialog(false)}>
        <DialogTitle>Data export</DialogTitle>
        <DialogContent>
          <Typography>
            Data export isn't wired up yet — when it is, you'll get a JSON bundle of your quotes,
            chats, and profile sent to your registered email.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDataDialog(false)}>Got it</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete account?</DialogTitle>
        <DialogContent>
          <Typography>
            Account deletion isn't enabled in this build. When it is, it will permanently remove
            your profile, every quote you saved (public and private), all chat history, and any
            favorites. There's no undo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)} color="error">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureScaffold>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{ color: 'primary.main', fontWeight: 700, pt: 1.5, pb: 0.25, pl: 1 }}
    >
      {children}
    </Typography>
  );
}

function HeaderRow({ icon, accent, title, subtitle }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.75} sx={{ px: 2, py: 1.5 }}>
      <IconBadge icon={icon} colors={accent} />
      <Stack sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>
    </Stack>
  );
}

function VisibilityRadio({ icon, title, subtitle, selected, onClick }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <Box sx={{ color: 'text.secondary', display: 'flex', '& svg': { fontSize: 22 } }}>{icon}</Box>
      <Stack sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: selected ? 600 : 400 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>
      {selected ? (
        <RadioButtonCheckedIcon sx={{ color: 'primary.main' }} />
      ) : (
        <RadioButtonUncheckedIcon sx={{ color: 'text.secondary' }} />
      )}
    </Stack>
  );
}

function ToggleRow({ icon, accent, title, subtitle, checked, onChange }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.75} sx={{ px: 2, py: 1.5 }}>
      <IconBadge icon={icon} colors={accent} />
      <Stack sx={{ flex: 1 }}>
        <Typography variant="body1">{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        sx={{
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#34C759', opacity: 1 },
        }}
      />
    </Stack>
  );
}

function ActionRow({ icon, accent, title, subtitle, destructive, onClick }) {
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
      <Stack sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ color: destructive ? 'error.main' : 'text.primary' }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>
    </Stack>
  );
}

function HintCard({ children }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        backgroundColor: 'rgba(176, 102, 255, 0.10)',
        borderRadius: '10px',
        p: 1.5,
      }}
    >
      <VisibilityIcon sx={{ fontSize: 18, color: 'primary.main', mt: '2px' }} />
      <Typography variant="caption" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

function DividerLine() {
  return <Divider sx={{ ml: 8, borderColor: 'divider' }} />;
}
