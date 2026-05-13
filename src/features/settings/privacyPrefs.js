import { useEffect, useState } from 'react';

// localStorage equivalent of PrivacyPreferenceStore.kt. Same key names so a
// future migration path is obvious if we ever sync these across devices via
// Firestore — for now the choices live in the browser only.

export const VISIBILITY_PRIVATE = 'private';
export const VISIBILITY_PUBLIC = 'public';

const KEYS = {
  defaultVisibility: 'yolo_privacy_prefs.default_quote_visibility',
  discoverableInChat: 'yolo_privacy_prefs.discoverable_in_chat',
  showProfilePhoto: 'yolo_privacy_prefs.show_profile_photo',
  showOnlineStatus: 'yolo_privacy_prefs.show_online_status',
  readReceipts: 'yolo_privacy_prefs.read_receipts',
};

const EVENT = 'yolo:privacy-changed';

const DEFAULTS = {
  defaultVisibility: VISIBILITY_PRIVATE,
  discoverableInChat: true,
  showProfilePhoto: true,
  showOnlineStatus: true,
  readReceipts: true,
};

function readBool(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

function readString(key, fallback) {
  return localStorage.getItem(key) ?? fallback;
}

function snapshot() {
  if (typeof window === 'undefined') return DEFAULTS;
  return {
    defaultVisibility: readString(KEYS.defaultVisibility, DEFAULTS.defaultVisibility),
    discoverableInChat: readBool(KEYS.discoverableInChat, DEFAULTS.discoverableInChat),
    showProfilePhoto: readBool(KEYS.showProfilePhoto, DEFAULTS.showProfilePhoto),
    showOnlineStatus: readBool(KEYS.showOnlineStatus, DEFAULTS.showOnlineStatus),
    readReceipts: readBool(KEYS.readReceipts, DEFAULTS.readReceipts),
  };
}

function write(key, value) {
  localStorage.setItem(key, String(value));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePrivacyPrefs() {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    const handler = () => setState(snapshot());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return {
    ...state,
    setDefaultVisibility: (value) => {
      if (value !== VISIBILITY_PRIVATE && value !== VISIBILITY_PUBLIC) return;
      write(KEYS.defaultVisibility, value);
    },
    setDiscoverable: (value) => write(KEYS.discoverableInChat, value),
    setShowPhoto: (value) => write(KEYS.showProfilePhoto, value),
    setShowOnline: (value) => write(KEYS.showOnlineStatus, value),
    setReadReceipts: (value) => write(KEYS.readReceipts, value),
  };
}
