import { useEffect, useRef, useState } from "react";
import { applyMusicQuality } from "./musicQuality.js";
import {
  castTogglePlayPause,
  getCastState,
  loadAudioOnCast,
  subscribeCast,
} from "./castManager.js";
import { MusicEffects } from "./musicEffects.js";
import {
  getMusicEffects,
  subscribeEffects,
} from "./musicEffectsPreferences.js";

// Single-track audio player shared across the Music screen + mini player.
// Lives as a module-level singleton so the same <audio> survives route
// changes within the music feature. Exposes Web Audio nodes for the beat
// visualizer to read FFT data from.
//
// Mirrors MusicPlayer.kt — adds queue, "Play next", repeat (Off/One/All),
// and shuffle. The Android side also drives Cast routing here; the web
// version stays local-only.

export const REPEAT_OFF = "off";
export const REPEAT_ONE = "one";
export const REPEAT_ALL = "all";

let audio = null;
let audioContext = null;
let analyser = null;
let mediaSource = null;
let effects = null;
let effectsUnsub = null;
const subscribers = new Set();
let state = {
  track: null,
  isPlaying: false,
  isLoading: false,
  positionSec: 0,
  durationSec: 0,
  queue: [],
  queueIndex: -1,
  playNext: [],
  repeatMode: REPEAT_OFF,
  shuffleEnabled: false,
};

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.crossOrigin = "anonymous";

  audio.addEventListener("play", () =>
    setState({ isPlaying: true, isLoading: false }),
  );
  audio.addEventListener("pause", () => setState({ isPlaying: false }));
  audio.addEventListener("waiting", () => setState({ isLoading: true }));
  audio.addEventListener("playing", () => setState({ isLoading: false }));
  audio.addEventListener("timeupdate", () =>
    setState({
      positionSec: audio.currentTime,
      durationSec: audio.duration || 0,
    }),
  );
  audio.addEventListener("ended", () => {
    setState({ isPlaying: false, positionSec: 0 });
    handleCompletion();
  });
  return audio;
}

function ensureAnalyser() {
  if (analyser) return analyser;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audioContext = new AC();
    analyser = audioContext.createAnalyser();
    // 2048-bin FFT → ~21.5 Hz per bin at 44.1 kHz. Doubles the low-end
    // resolution vs 1024, which lets the kick band (60-150 Hz) actually
    // separate from sub-bass and bass guitar harmonics. 0.6 smoothing
    // dampens flicker without burying onset transients (0.8+ would).
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    mediaSource = audioContext.createMediaElementSource(ensureAudio());
    // Audio graph:
    //   mediaSource → effects (EQ + bass + virtualizer + loudness)
    //               → analyser (visualizer reads the processed signal)
    //               → destination (speakers)
    // We always insert the effects chain even when disabled — the chain
    // passes audio through transparently when settings are at "Flat",
    // and physically rebuilding the graph mid-playback would click.
    effects = new MusicEffects(audioContext);
    mediaSource.connect(effects.input);
    effects.output.connect(analyser);
    analyser.connect(audioContext.destination);
    // Apply saved settings + subscribe so changes in Settings re-apply
    // in real time.
    effects.apply(getMusicEffects());
    effectsUnsub = subscribeEffects((s) => effects.apply(s));
  } catch (e) {
    analyser = null;
  }
  return analyser;
}

// === Spectral analysis ===
//
// At 44.1 kHz with fftSize=2048, ~21.5 Hz per bin. The bands below carve
// the spectrum into musically-meaningful slices so visualizers can react
// to *what* changed rather than overall loudness.
//
//   sub:   22-66 Hz   — kick fundamentals, sub-bass synths
//   kick:  66-150 Hz  — main kick punch
//   bass:  150-330 Hz — bass guitar, low snare body
//   mids:  330-2 kHz  — vocals + most instruments
//   highs: 2-5 kHz    — vocal sibilance, hi-hats, cymbals
export const BANDS = {
  sub:   { start: 1,  end: 3   },
  kick:  { start: 3,  end: 7   },
  bass:  { start: 7,  end: 15  },
  mids:  { start: 15, end: 90  },
  highs: { start: 90, end: 230 },
};

// Back-compat exports — callers that used to sample by these constants
// still work; new code should reach for BANDS directly.
const DRUM_BIN_START = BANDS.sub.start;
const DRUM_BIN_END = BANDS.kick.end;

// === Drum-onset detector ===
//
// Spectral flux: the sum of positive bin-to-bin changes between
// consecutive frames, restricted to the drum band. A kick drum is a
// burst of broadband low energy — every bin in the band jumps at once,
// producing a sharp flux spike that's much more reliable than just
// "loud" detection (a sustained bassline reads loud but produces near-
// zero flux).
//
// All state is module-scoped so multiple visualizers share one detector.
let previousSpectrum = null;
const FLUX_HISTORY_LEN = 43;
const fluxHistory = new Float32Array(FLUX_HISTORY_LEN);
let fluxHistoryIdx = 0;
let currentPulse = 0;
let pulseTarget = 0;
let lastPulseUpdateMs = 0;

function computeDrumFlux(freqData) {
  if (!previousSpectrum || previousSpectrum.length !== freqData.length) {
    previousSpectrum = new Uint8Array(freqData.length);
    previousSpectrum.set(freqData);
    return 0;
  }
  let flux = 0;
  const start = BANDS.sub.start;
  const end = BANDS.bass.end; // sub + kick + bass = drum + low-end
  for (let i = start; i < end; i++) {
    const diff = freqData[i] - previousSpectrum[i];
    if (diff > 0) flux += diff;
  }
  previousSpectrum.set(freqData);
  // Normalize to roughly 0..1 (max possible = (end-start)*255).
  return flux / ((end - start) * 255);
}

function updatePulse(freqData) {
  if (!freqData) {
    currentPulse = 0;
    pulseTarget = 0;
    return 0;
  }

  const flux = computeDrumFlux(freqData);

  // Adaptive threshold: a rolling average of recent flux scaled by 1.6.
  // Loud passages raise the bar so we only fire on real transients;
  // quiet passages lower it so soft kicks still register.
  let avgFlux = 0;
  for (let i = 0; i < FLUX_HISTORY_LEN; i++) avgFlux += fluxHistory[i];
  avgFlux /= FLUX_HISTORY_LEN;
  fluxHistory[fluxHistoryIdx] = flux;
  fluxHistoryIdx = (fluxHistoryIdx + 1) % FLUX_HISTORY_LEN;

  const now = performance.now();
  const dtMs = now - (lastPulseUpdateMs || now);
  lastPulseUpdateMs = now;

  const threshold = Math.max(0.004, avgFlux * 1.6);
  if (flux > threshold) {
    pulseTarget = Math.min(1, (flux - threshold) * 12);
  }

  // Spring damping: fast attack toward the new target, slow release back
  // down. Looks cinematic instead of robotic, and an attack-then-decay
  // shape reads as "a beat" much more than a plain exp decay would.
  if (pulseTarget > currentPulse) {
    currentPulse += (pulseTarget - currentPulse) * 0.55;
  } else {
    currentPulse += (pulseTarget - currentPulse) * 0.12;
  }
  // Target decays so the pulse falls back to 0 between beats.
  pulseTarget *= Math.pow(0.5, dtMs / 180);
  return currentPulse;
}

export function getBeatPulse() {
  return currentPulse;
}

// Mean amplitude (0..1) in each named band, computed from the most
// recent FFT scan. Cheap to call every frame.
export function getBandEnergies(freqData) {
  const out = { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 };
  if (!freqData) return out;
  for (const key of Object.keys(BANDS)) {
    const { start, end } = BANDS[key];
    let sum = 0;
    let count = 0;
    for (let i = start; i < end && i < freqData.length; i++) {
      sum += freqData[i];
      count++;
    }
    out[key] = count > 0 ? sum / count / 255 : 0;
  }
  return out;
}

function setState(patch) {
  state = { ...state, ...patch };
  subscribers.forEach((cb) => cb(state));
}

export function getPlayerState() {
  return state;
}

// Internal: actually loads the URL and starts playback. Doesn't mutate
// queue/index — caller is responsible for keeping those in sync.
function startTrack(track) {
  const el = ensureAudio();
  setState({ track, isLoading: true });
  // Apply the user's quality choice at play time so changes in Settings
  // take effect on the next track without invalidating cached SaavnTrack
  // objects.
  const url = applyMusicQuality(track.streamUrl);

  // When a Cast session is connected, send playback to the remote
  // receiver instead of starting local playback. Local audio is paused so
  // it doesn't fight the cast device.
  const cast = getCastState();
  if (cast.isConnected) {
    const sent = loadAudioOnCast({
      streamUrl: url,
      title: track.title,
      artist: track.artist,
      albumArtUrl: track.artworkUrlLarge || track.artworkUrlSmall,
      durationSec: track.durationSec,
    });
    if (sent) {
      try {
        if (!el.paused) el.pause();
      } catch {
        // ignore
      }
      setState({
        isLoading: false,
        isPlaying: true,
        durationSec: track.durationSec || 0,
        positionSec: 0,
      });
      return;
    }
  }

  el.src = url;
  audioContext?.resume?.();
  el.play().catch(() => setState({ isLoading: false, isPlaying: false }));
}

// Resolve the queue context for a play call. When the caller passes a
// `queue` array we use it verbatim; otherwise we fall back to a single-track
// queue so next/previous still no-op safely.
function resolveQueueContext(track, queue) {
  if (Array.isArray(queue) && queue.length > 0) {
    const idx = queue.findIndex((t) => t.id === track.id);
    return {
      queue,
      queueIndex: idx >= 0 ? idx : 0,
    };
  }
  return { queue: [track], queueIndex: 0 };
}

export function playTrack(track, opts = {}) {
  const ctx = resolveQueueContext(track, opts.queue);
  setState({ queue: ctx.queue, queueIndex: ctx.queueIndex });
  startTrack(track);
}

export function togglePlayPause(track, queue = null) {
  const el = ensureAudio();
  if (!state.track || state.track.id !== track.id) {
    playTrack(track, { queue });
    return;
  }
  const cast = getCastState();
  if (cast.isConnected) {
    castTogglePlayPause();
    setState({ isPlaying: !state.isPlaying });
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

// "Play next" inserts at the head of a FIFO queue — entries jump in front
// of the main `queue` when the current track ends.
export function addToPlayNext(track) {
  if (state.playNext.some((t) => t.id === track.id)) return;
  setState({ playNext: [track, ...state.playNext] });
}

export function removeFromPlayNext(trackId) {
  setState({ playNext: state.playNext.filter((t) => t.id !== trackId) });
}

export function cycleRepeatMode() {
  const order = [REPEAT_OFF, REPEAT_ALL, REPEAT_ONE];
  const i = order.indexOf(state.repeatMode);
  const nextMode = order[(i + 1) % order.length];
  setState({ repeatMode: nextMode });
}

export function toggleShuffle() {
  setState({ shuffleEnabled: !state.shuffleEnabled });
}

function pickNextTrack() {
  // 1. Anything the user explicitly queued via Play Next.
  if (state.playNext.length > 0) {
    const [head, ...rest] = state.playNext;
    setState({ playNext: rest });
    return { track: head, fromPlayNext: true };
  }
  const queue = state.queue;
  if (!queue.length) return null;
  // 2. Shuffle — random pick that isn't the current track.
  if (state.shuffleEnabled) {
    const pool =
      queue.length > 1 ? queue.filter((t) => t.id !== state.track?.id) : queue;
    return { track: pool[Math.floor(Math.random() * pool.length)] };
  }
  // 3. Sequential next; wrap if REPEAT_ALL.
  const nextIdx = state.queueIndex + 1;
  if (nextIdx >= queue.length) {
    if (state.repeatMode === REPEAT_ALL)
      return { track: queue[0], queueIndex: 0 };
    return null;
  }
  return { track: queue[nextIdx], queueIndex: nextIdx };
}

export function next() {
  // Repeat-one only kicks in on auto-completion. Pressing the "next" button
  // explicitly advances the queue.
  const picked = pickNextTrack();
  if (!picked) return;
  if (typeof picked.queueIndex === "number") {
    setState({ queueIndex: picked.queueIndex });
  } else if (!picked.fromPlayNext) {
    const idx = state.queue.findIndex((t) => t.id === picked.track.id);
    if (idx >= 0) setState({ queueIndex: idx });
  }
  startTrack(picked.track);
}

export function previous() {
  const queue = state.queue;
  if (!queue.length) return;
  // Matches every music app: previous ignores the Play Next list and walks
  // the main queue backward, wrapping at the start.
  const prevIdx =
    state.queueIndex <= 0 ? queue.length - 1 : state.queueIndex - 1;
  const track = queue[prevIdx];
  setState({ queueIndex: prevIdx });
  startTrack(track);
}

function handleCompletion() {
  if (state.repeatMode === REPEAT_ONE && state.track) {
    startTrack(state.track);
    return;
  }
  next();
}

export function subscribePlayer(cb) {
  subscribers.add(cb);
  cb(state);
  return () => subscribers.delete(cb);
}

// Mid-playback handoff: when the user opens a Cast session while a track
// is already playing locally, push that track to the receiver. When the
// session ends, resume the same track locally from the same position so
// the user keeps hearing music without re-clicking.
let wasCastConnected = false;
let localPosBeforeCast = 0;
subscribeCast((cast) => {
  if (cast.isConnected && !wasCastConnected) {
    wasCastConnected = true;
    const track = state.track;
    if (track) {
      const el = ensureAudio();
      localPosBeforeCast = el.currentTime || 0;
      const url = applyMusicQuality(track.streamUrl);
      const sent = loadAudioOnCast({
        streamUrl: url,
        title: track.title,
        artist: track.artist,
        albumArtUrl: track.artworkUrlLarge || track.artworkUrlSmall,
        durationSec: track.durationSec,
      });
      if (sent) {
        try {
          if (!el.paused) el.pause();
        } catch {
          // ignore
        }
        setState({ isPlaying: true });
      }
    }
  } else if (!cast.isConnected && wasCastConnected) {
    wasCastConnected = false;
    // Resume locally from where the cast handoff left off.
    const track = state.track;
    if (track) {
      const el = ensureAudio();
      el.src = applyMusicQuality(track.streamUrl);
      el.currentTime = localPosBeforeCast || 0;
      audioContext?.resume?.();
      el.play().catch(() => setState({ isPlaying: false }));
    }
  }
});

export function usePlayer() {
  const [snapshot, setSnapshot] = useState(getPlayerState());
  useEffect(() => subscribePlayer(setSnapshot), []);
  return snapshot;
}

// Shared FFT buffer + pulse computation. Every visualizer calls `get()`
// each frame; we run the analyser scan only once per RAF regardless of
// how many visualizers are mounted, and pulse state lives at module
// scope (see updatePulse).
//
// DRUM_BAND / MELODY_BAND_END are kept as back-compat exports — they
// now resolve to the same ranges as BANDS.sub..kick / BANDS.highs.end.
export const DRUM_BAND = { start: DRUM_BIN_START, end: DRUM_BIN_END };
export const MELODY_BAND_END = BANDS.highs.end;

let sharedBuffer = null;
let sharedLastFrame = -1;

function readFrequencyData() {
  const a = ensureAnalyser();
  if (!a) return null;
  if (!sharedBuffer || sharedBuffer.length !== a.frequencyBinCount) {
    sharedBuffer = new Uint8Array(a.frequencyBinCount);
  }
  // One scan per RAF. Two visualizers in the same paint will both read
  // the same buffer instead of triggering two FFT reads.
  const frame =
    typeof window !== "undefined" && typeof performance !== "undefined"
      ? Math.floor(performance.now() / 8)
      : 0;
  if (frame !== sharedLastFrame) {
    a.getByteFrequencyData(sharedBuffer);
    updatePulse(sharedBuffer);
    sharedLastFrame = frame;
  }
  return sharedBuffer;
}

export function useFrequencyData() {
  useEffect(() => {
    ensureAnalyser();
  }, []);
  return { get: readFrequencyData };
}

// Tiny convenience for visualizers that only care about the current
// drum-onset pulse (0..1, springs back to 0 over ~250ms after a kick).
export function useBeatPulse() {
  useEffect(() => {
    ensureAnalyser();
  }, []);
  return { get: getBeatPulse };
}

// Per-band energy. Returns { sub, kick, bass, mids, highs } each 0..1.
// Useful for layered visualizers (bass glow + treble sparkle + etc.).
export function useBandEnergies() {
  useEffect(() => {
    ensureAnalyser();
  }, []);
  return {
    get: () => getBandEnergies(readFrequencyData()),
  };
}
