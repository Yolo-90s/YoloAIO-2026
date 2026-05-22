import { useEffect, useState } from 'react';

// Mirrors MusicQualityPreferences.kt — JioSaavn serves the same track at
// three AAC bitrates (96 / 160 / 320 kbps). The URL ends in `_320.mp4` by
// default; we swap the suffix to step down to the chosen quality.

export const MUSIC_QUALITIES = [
  { code: '96', label: 'Data Saver', description: '≈ 0.7 MB / minute' },
  { code: '160', label: 'Standard', description: '≈ 1.2 MB / minute' },
  { code: '320', label: 'HD', description: '≈ 2.4 MB / minute' },
];

export const DEFAULT_QUALITY = '320';
const STORAGE_KEY = 'yolo_music_quality';

const listeners = new Set();
let current = readFromStorage();

function readFromStorage() {
  if (typeof window === 'undefined') return DEFAULT_QUALITY;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return MUSIC_QUALITIES.some((q) => q.code === v) ? v : DEFAULT_QUALITY;
}

export function getMusicQuality() {
  return current;
}

export function setMusicQuality(code) {
  if (!MUSIC_QUALITIES.some((q) => q.code === code)) return;
  current = code;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, code);
  }
  listeners.forEach((cb) => cb(current));
}

export function subscribeMusicQuality(cb) {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}

export function useMusicQuality() {
  const [val, setVal] = useState(current);
  useEffect(() => subscribeMusicQuality(setVal), []);
  return val;
}

// Replaces the bitrate suffix on a JioSaavn URL. URLs that don't match
// the expected pattern (legacy hosts etc.) are returned unchanged.
export function applyMusicQuality(url, quality = current) {
  if (!url) return url;
  const re = /_(96|160|320)\.mp4(\?.*)?$/;
  return url.replace(re, `_${quality}.mp4$2`);
}
