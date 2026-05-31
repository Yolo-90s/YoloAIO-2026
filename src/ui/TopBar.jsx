import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useCurrentUser } from '../data/UserSession.jsx';
import { useAppConfig } from '../data/AppConfig.jsx';
import { computeInitials } from '../data/userProfile.js';
import { signOutUser } from '../features/auth/authRepository.js';
import { routes } from '../routes.js';

// Persistent top app bar. Brand on the left, primary nav in the middle
// (collapses behind a hamburger on small screens), account menu on the right.
// Visibility of feature nav items honours AppConfig flags so a remote
// `showMoviesMenu=false` hides the link here too.
export function TopBar() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const config = useAppConfig();
  const [navAnchor, setNavAnchor] = useState(null);
  const [accountAnchor, setAccountAnchor] = useState(null);

  const navItems = [
    config.showMoviesMenu && { label: 'Movies', to: routes.movies },
    config.showMusicMenu && { label: 'Music', to: routes.music },
    { label: 'Chat', to: routes.chat },
    { label: 'Quotes', to: routes.quotes },
    { label: 'Community', to: routes.community },
    config.showWeatherMenu && { label: 'Weather', to: routes.weather },
    config.showWallpapersMenu && { label: 'Wallpaper', to: routes.wallpaper },
  ].filter(Boolean);

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Yolo';
  const initials = computeInitials(displayName);
  const isActive = (to) =>
    to === routes.home ? location.pathname === '/' : location.pathname.startsWith(to);

  const handleSignOut = async () => {
    setAccountAnchor(null);
    try {
      await signOutUser();
    } finally {
      navigate(routes.auth, { replace: true });
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'rgba(14, 11, 20, 0.72)',
        backgroundImage: 'none',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: 64 }}>
        <Box
          component={RouterLink}
          to={routes.home}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            color: 'text.primary',
            textDecoration: 'none',
            mr: 2,
          }}
        >
          <Box
            component="img"
            src="/yoloaio-icon.svg"
            alt="YoloAIO"
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'block',
            }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
            Yolo AIO
          </Typography>
        </Box>

        {!isCompact && (
          <Stack direction="row" spacing={0.5} sx={{ flex: 1, ml: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                size="small"
                sx={{
                  color: isActive(item.to) ? 'primary.main' : 'text.secondary',
                  fontWeight: isActive(item.to) ? 600 : 500,
                  px: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
        )}

        {isCompact && (
          <>
            <Box sx={{ flex: 1 }} />
            <IconButton
              onClick={(e) => setNavAnchor(e.currentTarget)}
              sx={{ color: 'text.primary' }}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={navAnchor}
              open={Boolean(navAnchor)}
              onClose={() => setNavAnchor(null)}
              slotProps={{
                paper: {
                  sx: {
                    backgroundColor: 'rgba(24, 16, 35, 0.96)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    minWidth: 200,
                  },
                },
              }}
            >
              {navItems.map((item) => (
                <MenuItem
                  key={item.to}
                  component={RouterLink}
                  to={item.to}
                  onClick={() => setNavAnchor(null)}
                  selected={isActive(item.to)}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <IconButton
          onClick={(e) => setAccountAnchor(e.currentTarget)}
          sx={{ ml: 0.5, p: 0.5 }}
          aria-label="Account menu"
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: 14,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #FF7AB6 0%, #B85AC1 50%, #7C9CFF 100%)',
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: 'rgba(24, 16, 35, 0.96)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                minWidth: 220,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {displayName}
            </Typography>
            {user?.email && (
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            )}
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <MenuItem
            onClick={() => {
              setAccountAnchor(null);
              navigate(routes.settings);
            }}
          >
            <ListItemIcon sx={{ color: 'text.primary' }}>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem onClick={handleSignOut}>
            <ListItemIcon sx={{ color: 'error.main' }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <Typography color="error.main">Sign out</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
