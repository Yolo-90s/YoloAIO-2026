import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { firebaseReady } from '../../data/firebase.js';
import { signIn, signUp, signInWithGoogle } from './authRepository.js';
import { useCurrentUser } from '../../data/UserSession.jsx';
import { routes } from '../../routes.js';

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: sessionLoading } = useCurrentUser();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If a signed-in user lands here (e.g. via /auth direct nav), bounce them
  // to wherever they were heading (or home). Doing this in render avoids a
  // useEffect+state-update loop.
  if (!sessionLoading && user) {
    const to = location.state?.from?.pathname ?? routes.home;
    navigate(to, { replace: true });
    return null;
  }

  const handleAuthenticated = () => {
    const to = location.state?.from?.pathname ?? routes.home;
    navigate(to, { replace: true });
  };

  const runSignIn = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      handleAuthenticated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runSignUp = async (name, email, password) => {
    setError(null);
    setLoading(true);
    try {
      await signUp(name, email, password);
      handleAuthenticated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      handleAuthenticated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 3,
        pt: 8,
        pb: 4,
      }}
    >
      <Box
        sx={{
          width: 92,
          height: 92,
          borderRadius: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF66D4 0%, #B829E5 50%, #3F61FF 100%)',
          color: '#fff',
          mb: 3,
        }}
      >
        <AutoAwesomeIcon sx={{ fontSize: 48 }} />
      </Box>
      <Typography variant="h2" sx={{ mb: 0.5 }}>
        Yolo AIO
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        All-in-One, all for you.
      </Typography>

      <GlassCard sx={{ width: '100%', maxWidth: 420 }} contentPadding={2.5} radius={3}>
        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            setError(null);
          }}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab label="Sign In" />
          <Tab label="Sign Up" />
        </Tabs>

        {tab === 0 ? (
          <SignInForm loading={loading} onSubmit={runSignIn} />
        ) : (
          <SignUpForm loading={loading} onSubmit={runSignUp} />
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        )}
        {!firebaseReady && (
          <Typography color="warning.main" variant="body2" sx={{ mt: 1.5 }}>
            Firebase isn't configured yet. Create <code>.env.local</code> at the project root with the Web
            app config from the Firebase console.
          </Typography>
        )}

        <Divider sx={{ my: 2, '&::before, &::after': { borderColor: 'rgba(255,255,255,0.25)' } }}>
          <Typography variant="caption" color="text.secondary">
            or
          </Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          onClick={runGoogle}
          disabled={loading}
          sx={{ height: 52, borderRadius: '14px' }}
          startIcon={
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: '11px',
                background: '#fff',
                color: '#4285F4',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              G
            </Box>
          }
        >
          Continue with Google
        </Button>
      </GlassCard>
    </Box>
  );
}

function SignInForm({ loading, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <Stack spacing={1.5} component="form" onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(email, password); }}>
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        autoComplete="email"
      />
      <TextField
        label="Password"
        type={show ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        autoComplete="current-password"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShow((s) => !s)} edge="end" size="small">
                {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <PrimaryButton text="Sign In" loading={loading} disabled={!canSubmit} type="submit" />
    </Stack>
  );
}

function SignUpForm({ loading, onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && passwordsMatch;

  return (
    <Stack spacing={1.5} component="form" onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(name, email, password); }}>
      <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        autoComplete="email"
      />
      <TextField
        label="Password (6+ characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        autoComplete="new-password"
      />
      <TextField
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        fullWidth
        autoComplete="new-password"
        error={confirm.length > 0 && !passwordsMatch}
        helperText={confirm.length > 0 && !passwordsMatch ? "Passwords don't match" : ' '}
      />
      <PrimaryButton text="Create Account" loading={loading} disabled={!canSubmit} type="submit" />
    </Stack>
  );
}

function PrimaryButton({ text, loading, disabled, type = 'button', onClick }) {
  return (
    <Button
      type={type}
      onClick={onClick}
      variant="contained"
      disabled={disabled || loading}
      fullWidth
      sx={{ height: 52, borderRadius: '14px', fontWeight: 600, fontSize: '1rem' }}
    >
      {loading ? <CircularProgress size={20} color="inherit" /> : text}
    </Button>
  );
}
