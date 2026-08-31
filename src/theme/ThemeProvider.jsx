import { createContext, useContext, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { usePalette } from './paletteStore.js';
import { baseBackground, darkSurface } from './palettes.js';

// Mirrors YoloAIOTheme + LocalGlass from the Android app. We expose the
// currently-active palette plus the resolved "glass" tokens (surface fills,
// blob colors, base gradient) through a React context so the AppBackground
// and GlassCard components can read them without prop-drilling.
const PaletteContext = createContext(null);

export function useYoloPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('useYoloPalette must be used inside YoloThemeProvider');
  return ctx;
}

export function YoloThemeProvider({ children }) {
  const [palette, setPalette] = usePalette();

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
          primary: { main: palette.primary },
          secondary: { main: palette.secondary },
          background: {
            default: darkSurface.background,
            paper: darkSurface.surface,
          },
          text: {
            primary: darkSurface.onBackground,
            secondary: darkSurface.onSurfaceVariant,
          },
          divider: darkSurface.outlineVariant,
        },
        shape: { borderRadius: 16 },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
          // Same ramp as Type.kt — bold display, semibold titles, +tracking labels.
          h1: { fontWeight: 900, fontSize: '3.5rem', letterSpacing: '-0.0625em', lineHeight: 1.07 },
          h2: { fontWeight: 800, fontSize: '2.75rem', letterSpacing: '-0.047em', lineHeight: 1.09 },
          h3: { fontWeight: 700, fontSize: '2.125rem', letterSpacing: '-0.031em', lineHeight: 1.18 },
          h4: { fontWeight: 700, fontSize: '1.875rem', letterSpacing: '-0.025em', lineHeight: 1.2 },
          h5: { fontWeight: 700, fontSize: '1.625rem', letterSpacing: '-0.019em', lineHeight: 1.23 },
          h6: { fontWeight: 600, fontSize: '1.375rem', letterSpacing: '-0.013em', lineHeight: 1.27 },
          subtitle1: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3 },
          subtitle2: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.375 },
          body1: { fontSize: '1rem', lineHeight: 1.5 },
          body2: { fontSize: '0.875rem', lineHeight: 1.43 },
          button: { textTransform: 'none', fontWeight: 600 },
        },
        // Layered-depth "3D button" language, applied globally — the
        // theme had zero component overrides before this, so every
        // Button/IconButton across all 15 feature folders picks this up
        // for free, no per-screen edits needed (mirrors the paired
        // light/dark shadow trick BentoTile/GlassCard use, as one static
        // CSS treatment instead of a per-instance framer-motion component
        // since this needs to apply everywhere, not just hand-picked
        // spots). Only `contained` buttons get the heavy shadow — it'd
        // look wrong on a bordered/transparent outlined or text button.
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 160ms ease',
              },
            },
            variants: [
              {
                props: { variant: 'contained' },
                style: {
                  boxShadow:
                    '0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.25)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow:
                      '0 10px 22px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.25)',
                  },
                  '&:active': {
                    transform: 'translateY(1px) scale(0.97)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(0,0,0,0.3)',
                  },
                },
              },
            ],
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': { transform: 'translateY(-1px)' },
                '&:active': { transform: 'translateY(1px) scale(0.92)' },
              },
            },
          },
        },
      }),
    [palette]
  );

  const glass = useMemo(
    () => ({
      isDark: true,
      blobA: palette.blobA,
      blobB: palette.blobB,
      blobC: palette.blobC,
      baseTop: baseBackground.top,
      baseMid: baseBackground.mid,
      baseBottom: baseBackground.bottom,
    }),
    [palette]
  );

  const ctx = useMemo(() => ({ palette, setPalette, glass }), [palette, setPalette, glass]);

  return (
    <PaletteContext.Provider value={ctx}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </PaletteContext.Provider>
  );
}
