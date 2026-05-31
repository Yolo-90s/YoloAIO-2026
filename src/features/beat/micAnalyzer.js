import { useEffect, useState } from 'react';

// Web port of the Android MicAnalyzer. Captures the device microphone
// via getUserMedia, runs it through a single AnalyserNode for FFT, and
// exposes the signals every visualizer in BeatAnalyserScreen needs.
//
// Two read paths are provided:
//   - subscribe(cb): React-friendly, coalesced to ~20 Hz so state-bound
//                    UI (the noise meter, the sliders' "isRunning" badge)
//                    doesn't trigger 60 renders per second.
//   - getSnapshot(): zero-cost live read of the latest values, intended
//                    for canvas RAF loops that paint at 60 fps without
//                    needing React to re-render anything.
//
// Canvas readers must NOT mutate the returned object — it is the same
// instance the analyzer writes to every frame.

const FFT_SIZE = 2048;
const SMOOTHING_TIME_CONSTANT = 0.5;

// Bin ranges as fractions of the 1024-bin spectrum (FFT_SIZE / 2). At a
// typical 48 kHz sample rate, bin 1 ≈ 23 Hz and bin 230 ≈ 5.4 kHz.
//
//   sub   ≈ 20–70 Hz     (sub-bass)
//   kick  ≈ 70–165 Hz    (kick drum body)
//   bass  ≈ 165–350 Hz   (bass guitar / low toms)
//   mids  ≈ 350 Hz–2 kHz (vocals, guitars, snare)
//   highs ≈ 2 kHz–5 kHz  (hi-hats, cymbals, sibilance)
export const BANDS = {
  sub:   { start: 1,  end: 3   },
  kick:  { start: 3,  end: 7   },
  bass:  { start: 7,  end: 15  },
  mids:  { start: 15, end: 90  },
  highs: { start: 90, end: 230 },
};

const EMIT_INTERVAL_MS = 50; // ~20 Hz React updates

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

class MicAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.rafId = 0;
    this.subscribers = new Set();

    // User-tweakable per-band sensitivity multipliers (applied to the
    // compact `bands` object that tile grid + disco read).
    this.sensitivity = { bass: 1, mid: 1, high: 1 };

    // The single state object — mutated in-place every frame. Canvas
    // readers see fresh values via getSnapshot(). React subscribers see
    // shallow clones through the throttled emit().
    this.state = {
      isRunning: false,
      rmsDb: -90,
      bandMagnitudes: null,
      bandEnergies: { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 },
      bands: { bass: 0, mid: 0, high: 0 },  // sensitivity-adjusted
      pulse: 0,                              // smooth visual pulse 0..1
      beatFlash: 0,                          // decays in ~240 ms from a beat
      beatTime: 0,                           // performance.now() of last beat
    };

    // Onset detector state
    this.previousRaw = null;
    this.fluxHistory = new Float32Array(43);
    this.fluxHistoryIdx = 0;
    this.currentPulse = 0;
    this.pulseTarget = 0;
    this.lastFrameMs = 0;
    this.lastBeatMs = 0;
    this.lastEmitMs = 0;

    // Reusable typed-array scratch buffers — sized lazily when we know
    // the FFT bin count.
    this._raw = null;
    this._smoothed = null;
  }

  // Live read for RAF loops. Returns the live state object (no clone).
  getSnapshot() {
    return this.state;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb(this.state);
    return () => this.subscribers.delete(cb);
  }

  setSensitivity(patch) {
    if (patch.bass != null) this.sensitivity.bass = patch.bass;
    if (patch.mid  != null) this.sensitivity.mid  = patch.mid;
    if (patch.high != null) this.sensitivity.high = patch.high;
  }

  getSensitivity() {
    return { ...this.sensitivity };
  }

  emit(force = false) {
    const now = performance.now();
    if (!force && now - this.lastEmitMs < EMIT_INTERVAL_MS) return;
    this.lastEmitMs = now;
    const s = this.state;
    const snap = {
      isRunning: s.isRunning,
      rmsDb: s.rmsDb,
      bandMagnitudes: s.bandMagnitudes,
      bandEnergies: { ...s.bandEnergies },
      bands: { ...s.bands },
      pulse: s.pulse,
      beatFlash: s.beatFlash,
      beatTime: s.beatTime,
    };
    this.subscribers.forEach((cb) => cb(snap));
  }

  async start() {
    if (this.state.isRunning) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (e) {
      return false;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AC();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Uint8Array(this.analyser.fftSize);

    const tick = () => {
      this.analyser.getByteFrequencyData(freqData);
      this.analyser.getByteTimeDomainData(timeData);
      this.process(freqData, timeData);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();

    this.state.isRunning = true;
    this.emit(true);
    return true;
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    try { this.source?.disconnect(); } catch {}
    try { this.audioContext?.close(); } catch {}
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch {}
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.previousRaw = null;
    this._raw = null;
    this._smoothed = null;
    this.currentPulse = 0;
    this.pulseTarget = 0;
    this.fluxHistory.fill(0);
    this.fluxHistoryIdx = 0;
    this.state = {
      isRunning: false,
      rmsDb: -90,
      bandMagnitudes: null,
      bandEnergies: { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 },
      bands: { bass: 0, mid: 0, high: 0 },
      pulse: 0,
      beatFlash: 0,
      beatTime: 0,
    };
    this.emit(true);
  }

  process(freqData, timeData) {
    // ── RMS → dBFS ────────────────────────────────────────────────
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const s = timeData[i] - 128;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const db = rms > 1 ? Math.max(-90, 20 * Math.log10(rms / 128)) : -90;

    // ── Raw magnitudes (0..1) ─────────────────────────────────────
    if (!this._raw || this._raw.length !== freqData.length) {
      this._raw = new Float32Array(freqData.length);
    }
    const raw = this._raw;
    for (let i = 0; i < freqData.length; i++) raw[i] = freqData[i] / 255;

    // ── Spectral flux on the drum band → pulse + beat event ──────
    const flux = this.computeDrumFlux(raw);
    this.updatePulseAndBeat(flux);

    // ── Per-bin asymmetric peak-hold (fast attack, slow release) ─
    if (!this._smoothed || this._smoothed.length !== raw.length) {
      this._smoothed = new Float32Array(raw.length);
      this._smoothed.set(raw);
    }
    const smoothed = this._smoothed;
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const p = smoothed[i];
      smoothed[i] = r > p ? p + (r - p) * 0.55 : p + (r - p) * 0.08;
    }

    // ── Band energies (mean magnitude per band) ──────────────────
    const e = this.state.bandEnergies;
    e.sub = 0; e.kick = 0; e.bass = 0; e.mids = 0; e.highs = 0;
    const N = smoothed.length;
    let n;
    n = 0; for (let i = BANDS.sub.start;   i < BANDS.sub.end   && i < N; i++) { e.sub   += smoothed[i]; n++; } if (n) e.sub   /= n;
    n = 0; for (let i = BANDS.kick.start;  i < BANDS.kick.end  && i < N; i++) { e.kick  += smoothed[i]; n++; } if (n) e.kick  /= n;
    n = 0; for (let i = BANDS.bass.start;  i < BANDS.bass.end  && i < N; i++) { e.bass  += smoothed[i]; n++; } if (n) e.bass  /= n;
    n = 0; for (let i = BANDS.mids.start;  i < BANDS.mids.end  && i < N; i++) { e.mids  += smoothed[i]; n++; } if (n) e.mids  /= n;
    n = 0; for (let i = BANDS.highs.start; i < BANDS.highs.end && i < N; i++) { e.highs += smoothed[i]; n++; } if (n) e.highs /= n;

    // ── Compact, sensitivity-adjusted bands {bass, mid, high} ────
    const b = this.state.bands;
    b.bass = clamp01((e.kick * 0.5 + e.bass * 0.5) * this.sensitivity.bass);
    b.mid  = clamp01(e.mids  * this.sensitivity.mid);
    b.high = clamp01(e.highs * this.sensitivity.high);

    // ── beatFlash decay ──────────────────────────────────────────
    const now = performance.now();
    const dtMs = Math.max(1, now - (this.lastFrameMs || now));
    this.lastFrameMs = now;
    if (this.state.beatFlash > 0) {
      this.state.beatFlash *= Math.pow(0.5, dtMs / 240);
      if (this.state.beatFlash < 0.01) this.state.beatFlash = 0;
    }

    this.state.rmsDb = db;
    this.state.bandMagnitudes = smoothed;
    this.state.pulse = this.currentPulse;

    this.emit();
  }

  computeDrumFlux(raw) {
    let prev = this.previousRaw;
    if (!prev || prev.length !== raw.length) {
      this.previousRaw = new Float32Array(raw.length);
      this.previousRaw.set(raw);
      return 0;
    }
    let flux = 0;
    const start = BANDS.sub.start;
    const end = BANDS.bass.end;
    for (let i = start; i < end; i++) {
      const d = raw[i] - prev[i];
      if (d > 0) flux += d;
    }
    // Update previousRaw in-place — no per-frame allocation.
    for (let i = 0; i < raw.length; i++) prev[i] = raw[i];
    return flux / (end - start);
  }

  updatePulseAndBeat(flux) {
    // Rolling-window average for adaptive thresholding.
    let avg = 0;
    for (const v of this.fluxHistory) avg += v;
    avg /= this.fluxHistory.length;
    this.fluxHistory[this.fluxHistoryIdx] = flux;
    this.fluxHistoryIdx = (this.fluxHistoryIdx + 1) % this.fluxHistory.length;

    const now = performance.now();
    const dtMs = Math.max(1, now - (this.lastFrameMs || now));

    // Pulse: low threshold, smooth visual. Used by NoiseMeter ring and
    // anything wanting a gentle continuous beat indicator.
    const pulseThreshold = Math.max(0.0007, avg * 1.1);
    if (flux > pulseThreshold) {
      this.pulseTarget = Math.min(1, (flux - pulseThreshold) * 38);
    }
    if (this.pulseTarget > this.currentPulse) {
      this.currentPulse += (this.pulseTarget - this.currentPulse) * 0.55;
    } else {
      this.currentPulse += (this.pulseTarget - this.currentPulse) * 0.12;
    }
    this.pulseTarget *= Math.pow(0.5, dtMs / 180);
    this.currentPulse = Math.max(0, Math.min(1, this.currentPulse));

    // Discrete beat: stricter threshold + 130 ms cooldown. This is what
    // tile-grid and disco listen to so background noise can't drive them.
    const beatThreshold = Math.max(0.0012, avg * 1.45);
    if (flux > beatThreshold && now - this.lastBeatMs > 130) {
      this.lastBeatMs = now;
      this.state.beatTime = now;
      this.state.beatFlash = 1;
    }
  }
}

const instance = new MicAnalyzer();

export function getMicAnalyzer() {
  return instance;
}

export function useMicAnalyzer() {
  const [state, setState] = useState(instance.state);
  useEffect(() => instance.subscribe(setState), []);
  return state;
}
