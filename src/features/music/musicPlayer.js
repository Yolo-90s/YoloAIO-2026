import { useEffect, useRef, useState } from 'react';

// Single-track audio player shared across the Music screen + mini player.
// Lives as a module-level singleton so the same <audio> survives route
// changes within the music feature. Exposes Web Audio nodes for the beat
// visualizer to read FFT data from.

let audio = null;
let audioContext = null;
let analyser = null;
let mediaSource = null;
const subscribers = new Set();
let state = {
  track: null,
  isPlaying: false,
  isLoading: false,
  positionSec: 0,
  durationSec: 0,
};

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  audio.addEventListener('play', () => setState({ isPlaying: true, isLoading: false }));
  audio.addEventListener('pause', () => setState({ isPlaying: false }));
  audio.addEventListener('waiting', () => setState({ isLoading: true }));
  audio.addEventListener('playing', () => setState({ isLoading: false }));
  audio.addEventListener('timeupdate', () =>
    setState({ positionSec: audio.currentTime, durationSec: audio.duration || 0 })
  );
  audio.addEventListener('ended', () => setState({ isPlaying: false, positionSec: 0 }));
  return audio;
}

function ensureAnalyser() {
  if (analyser) return analyser;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audioContext = new AC();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    mediaSource = audioContext.createMediaElementSource(ensureAudio());
    mediaSource.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch (e) {
    // Some browsers refuse a MediaElementSource for cross-origin streams
    // even with `crossOrigin`. The visualizer simply falls back to its
    // synthetic animation if `analyser` ends up null.
    analyser = null;
  }
  return analyser;
}

function setState(patch) {
  state = { ...state, ...patch };
  subscribers.forEach((cb) => cb(state));
}

export function getPlayerState() {
  return state;
}

export function playTrack(track) {
  const el = ensureAudio();
  setState({ track, isLoading: true });
  el.src = track.streamUrl;
  audioContext?.resume?.();
  el.play().catch(() => setState({ isLoading: false, isPlaying: false }));
}

export function togglePlayPause(track) {
  const el = ensureAudio();
  if (!state.track || state.track.id !== track.id) {
    playTrack(track);
    return;
  }
  if (el.paused) {
    audioContext?.resume?.();
    el.play().catch(() => {});
  } else {
    el.pause();
  }
}

export function seekTo(seconds) {
  const el = ensureAudio();
  if (!isFinite(seconds)) return;
  el.currentTime = seconds;
}

export function stop() {
  const el = ensureAudio();
  el.pause();
  el.currentTime = 0;
  setState({ track: null, isPlaying: false, positionSec: 0 });
}

export function subscribePlayer(cb) {
  subscribers.add(cb);
  cb(state);
  return () => subscribers.delete(cb);
}

export function usePlayer() {
  const [snapshot, setSnapshot] = useState(getPlayerState());
  useEffect(() => subscribePlayer(setSnapshot), []);
  return snapshot;
}

export function useFrequencyData() {
  const ref = useRef(null);
  useEffect(() => {
    ensureAnalyser();
    if (analyser) {
      ref.current = new Uint8Array(analyser.frequencyBinCount);
    }
  }, []);
  return {
    get: () => {
      if (!analyser || !ref.current) return null;
      analyser.getByteFrequencyData(ref.current);
      return ref.current;
    },
  };
}
