// Mirrors ThemePalette.kt from the Android app — same keys, same colors.
// Each palette recolors the accent triple (primary/secondary/tertiary) plus
// the three drifting blobs in the animated background.

export const palettes = [
  {
    key: 'aurora',
    displayName: 'Aurora',
    primary: '#FF66D4',
    secondary: '#8C9EFF',
    tertiary: '#FFB36B',
    blobA: '#FF1E83',
    blobB: '#3F61FF',
    blobC: '#B829E5',
  },
  {
    key: 'sunset',
    displayName: 'Sunset',
    primary: '#FF8A3D',
    secondary: '#FF5C8A',
    tertiary: '#FFC93B',
    blobA: '#FF6F00',
    blobB: '#E91E63',
    blobC: '#FF3D88',
  },
  {
    key: 'ocean',
    displayName: 'Ocean',
    primary: '#4CDDF7',
    secondary: '#6EA8FE',
    tertiary: '#42E6B4',
    blobA: '#00838F',
    blobB: '#1565FF',
    blobC: '#00BFA5',
  },
  {
    key: 'forest',
    displayName: 'Forest',
    primary: '#66E07A',
    secondary: '#B7E83C',
    tertiary: '#FFD740',
    blobA: '#1B5E20',
    blobB: '#558B2F',
    blobC: '#689F38',
  },
  {
    key: 'lavender',
    displayName: 'Lavender',
    primary: '#B388FF',
    secondary: '#E040FB',
    tertiary: '#7C4DFF',
    blobA: '#6A1B9A',
    blobB: '#4527A0',
    blobC: '#AA00FF',
  },
  {
    key: 'rose',
    displayName: 'Rose',
    primary: '#FF5C8A',
    secondary: '#FF8FB1',
    tertiary: '#FFAD42',
    blobA: '#C2185B',
    blobB: '#D81B60',
    blobC: '#FF3D88',
  },
  {
    key: 'midnight',
    displayName: 'Midnight',
    primary: '#82B1FF',
    secondary: '#9FA8DA',
    tertiary: '#B0BEC5',
    blobA: '#1A237E',
    blobB: '#283593',
    blobC: '#37474F',
  },
];

export const defaultPalette = palettes[0];

export function paletteFromKey(key) {
  return palettes.find((p) => p.key === key) ?? defaultPalette;
}

// Base dark scheme colors — same trio as DarkBlobBase1/2/3 in Color.kt.
// AppBackground reads these for the deep indigo-black gradient.
export const baseBackground = {
  top: '#0A0612',
  mid: '#050410',
  bottom: '#02020A',
};

// Mirrors Color.kt — these are the dark-scheme "on" / surface tokens.
export const darkSurface = {
  background: '#0E0B14',
  onBackground: '#F2EFF7',
  surface: '#181023',
  onSurface: '#F2EFF7',
  surfaceVariant: '#2A2435',
  onSurfaceVariant: '#E2DCEA',
  outline: '#6E6480',
  outlineVariant: '#332C42',
};

// Opaque card colors used by GlassCard. Match Glass.kt surfaceColor().
// Kept for reference/back-compat; GlassCard itself now uses `glassTokens`
// below (real translucency) instead of these solid fills.
export const yoloSurfaceColor = {
  normal: '#110D1A',
  strong: '#1B1726',
};

// Mirrors GlassPalette / DarkGlassFill etc. in Color.kt — same alpha values,
// so the two platforms' glass surfaces read identically. Palette-neutral
// (translucency reads consistently regardless of the active accent color,
// same design choice as the Android GlassPalette).
export const glassTokens = {
  fill: 'rgba(255,255,255,0.15)',
  fillStrong: 'rgba(255,255,255,0.25)',
  border: 'rgba(255,255,255,0.40)',
  highlight: 'rgba(255,255,255,0.20)',
  blurPx: 20,
};
