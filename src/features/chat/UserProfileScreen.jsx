import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import MapIcon from '@mui/icons-material/Map';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { computeInitials, avatarColorToCss } from '../../data/userProfile.js';
import { fetchUser } from './chatRepository.js';
import { routes } from '../../routes.js';

// Mirrors UserProfileScreen.kt — header / details / location / privacy note.
// Location fields (`lastLat`, `lastLon`, `lastLocationAt`, `hasLocation`)
// are written by the Android LocationPresence writer; on web they're simply
// absent and the location card falls back to the empty-state message.

export function UserProfileScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setError('Missing user id.');
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchUser(userId)
      .then((u) => {
        if (!alive) return;
        if (!u) setError('User not found.');
        setProfile(u);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Couldn't load profile.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <FeatureScaffold
      title="Profile"
      onBack={() => navigate(-1)}
      maxWidth={640}
    >
      {loading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}
      {!loading && (error || !profile) && (
        <GlassCard contentPadding={2.5}>
          <Typography>{error || 'User not found.'}</Typography>
        </GlassCard>
      )}
      {!loading && !error && profile && (
        <Stack spacing={1.5}>
          <HeaderCard profile={profile} />
          <DetailsCard profile={profile} />
          <LocationCard profile={profile} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 1 }}
          >
            Location is refreshed when the person last opened the app or this
            chat — never live-tracked. Permission is required on their device.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate(routes.chatConversation(profile.uid))}
            sx={{ alignSelf: 'flex-start', borderRadius: '14px' }}
          >
            Message
          </Button>
        </Stack>
      )}
    </FeatureScaffold>
  );
}

function HeaderCard({ profile }) {
  const initials = profile.initials || computeInitials(profile.displayName || '');
  const avatarBg = avatarColorToCss(profile.avatarColor);
  return (
    <GlassCard strong contentPadding={3} sx={{ textAlign: 'center' }}>
      <Box
        sx={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          mx: 'auto',
          background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}88)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        {initials}
      </Box>
      <Typography variant="h5" sx={{ mt: 1.5, fontWeight: 600 }}>
        {profile.displayName || 'Unknown'}
      </Typography>
      {profile.email && (
        <Typography variant="body2" color="text.secondary">
          {profile.email}
        </Typography>
      )}
    </GlassCard>
  );
}

function DetailsCard({ profile }) {
  const joined =
    profile.createdAt > 0
      ? new Date(profile.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;
  return (
    <GlassCard>
      <Stack spacing={1.5}>
        <DetailRow icon={<EmailIcon />} label="Email" value={profile.email || '—'} />
        {joined && <DetailRow icon={<ScheduleIcon />} label="Joined" value={joined} />}
      </Stack>
    </GlassCard>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Stack>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2">{value}</Typography>
      </Stack>
    </Stack>
  );
}

function LocationCard({ profile }) {
  const hasLocation =
    profile.hasLocation === true ||
    (typeof profile.lastLat === 'number' && typeof profile.lastLon === 'number');
  const lat = profile.lastLat;
  const lon = profile.lastLon;
  const updatedAt = profile.lastLocationAt;

  return (
    <GlassCard>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ color: hasLocation ? 'primary.main' : 'text.secondary', display: 'flex' }}>
          {hasLocation ? <LocationOnIcon /> : <LocationOffIcon />}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Last known location
        </Typography>
      </Stack>
      <Box sx={{ mt: 1.5 }}>
        {!hasLocation ? (
          <Typography variant="body2" color="text.secondary">
            {profile.displayName || 'This user'} hasn't shared a location yet.
            Their location updates the next time they open the app with
            location permission granted.
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </Typography>
            {updatedAt > 0 && (
              <Typography variant="caption" color="text.secondary">
                Updated {relativeAgo(updatedAt)}
              </Typography>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<MapIcon />}
              href={`https://www.google.com/maps?q=${lat},${lon}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ alignSelf: 'flex-start', borderRadius: '10px' }}
            >
              Open in Maps
            </Button>
          </Stack>
        )}
      </Box>
    </GlassCard>
  );
}

function relativeAgo(epochMs) {
  const delta = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} hr ago`;
  if (delta < 7 * 86400) return `${Math.floor(delta / 86400)} day(s) ago`;
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
