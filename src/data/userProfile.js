// Mirror of UserProfile.kt — same Firestore document shape so the Android
// app and web app share the `users/{uid}` collection without translation.

export const AVATAR_PALETTE = [
  '#6A1B9A', '#00897B', '#E65100', '#AD1457',
  '#1565C0', '#2E7D32', '#4527A0', '#BF360C',
];

export function computeInitials(name) {
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return letters || '?';
}

export function pickAvatarColor() {
  return AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
}

// Note: the Android side stores avatarColor as a Long (ARGB). Web reads it
// as an ARGB hex via the same number, so we normalize at the read site.
export function avatarColorToCss(raw) {
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') {
    const hex = (raw >>> 0).toString(16).padStart(8, '0');
    // ARGB → #RRGGBB (drop alpha)
    return `#${hex.substring(2)}`;
  }
  return AVATAR_PALETTE[0];
}
