import { useEffect, useState } from 'react';

// localStorage-backed preferences for the music DSP chain. Mirrors the
// Android MusicEffectsPreferences pattern: single immutable settings
// object, subscribe pattern, "Quick enhance" one-tap preset.

const STORAGE_KEY = 'yolo_music_effects';

const DEFAULTS = {
  enabled: false,
  preset: 'Flat',
  bassStrength: 0,          // 0..100
  virtualizerStrength: 0,   // 0..100
  loudnessGain: 0,          // 0..100 (mapped to 0..20 dB by the engine)
};

const ENHANCED = {
  enabled: true,
  preset: 'BassPunch',
  bassStrength: 45,
  virtualizerStrength: 60,
  loudnessGain: 15,         // ~3 dB lift
};

const listeners = new Set();
let current = readFromStorage();

function readFromStorage() {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function emit() {
  listeners.forEach((cb) => cb(current));
}

function update(patch) {
  current = { ...current, ...patch };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
  emit();
}

export function getMusicEffects() {
  return current;
}

export function setEffectsEnabled(enabled) {
  update({ enabled });
}

export function setEffectsPreset(preset) {
  update({ preset });
}

export function setEffectsBass(strength) {
  update({ bassStrength: Math.max(0, Math.min(100, strength)) });
}

export function setEffectsVirtualizer(strength) {
  update({ virtualizerStrength: Math.max(0, Math.min(100, strength)) });
}

export function setEffectsLoudness(gain) {
  update({ loudnessGain: Math.max(0, Math.min(100, gain)) });
}

export function applyEnhanced() {
  update({ ...ENHANCED });
}

export function resetEffects() {
  update({ ...DEFAULTS });
}

export function subscribeEffects(cb) {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}

export function useMusicEffects() {
  const [state, setState] = useState(current);
  useEffect(() => subscribeEffects(setState), []);
  return state;
}
