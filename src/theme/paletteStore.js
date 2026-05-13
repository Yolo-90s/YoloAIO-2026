import { useEffect, useState } from 'react';
import { defaultPalette, paletteFromKey } from './palettes.js';

// localStorage equivalent of ThemePreferenceStore. The hook subscribes to a
// `storage` event so multiple tabs stay in sync, and to a custom event so
// the same tab updates instantly after a write (the native `storage` event
// only fires in *other* tabs).
const KEY = 'yolo_theme_prefs.selected_palette';
const EVENT = 'yolo:palette-changed';

export function getStoredPalette() {
  if (typeof window === 'undefined') return defaultPalette;
  return paletteFromKey(localStorage.getItem(KEY) ?? '');
}

export function setStoredPalette(palette) {
  localStorage.setItem(KEY, palette.key);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: palette.key }));
}

export function usePalette() {
  const [palette, setPalette] = useState(getStoredPalette);

  useEffect(() => {
    const handler = () => setPalette(getStoredPalette());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return [palette, (next) => setStoredPalette(next)];
}
