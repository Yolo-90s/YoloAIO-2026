import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar.jsx';

// Persistent chrome for authenticated routes. The TopBar lives here so
// screens nested inside don't repeat their own AppBar — page-level back +
// title strips come from FeatureScaffold instead.
export function AppShell() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <TopBar />
      <Box component="main" sx={{ flex: 1, width: '100%' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
