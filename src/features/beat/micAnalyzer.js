import { useEffect, useState } from 'react';

// Web port of the Android MicAnalyzer. Captures the device microphone
// via getUserMedia, runs it through a single AnalyserNode for FFT,
// and exposes the same four signals as the Android side:
//
//   - rmsDb         instantaneous loudness in dBFS (-90 ≈ silent, 0 ≈ peak)
//   - bandMagnitudes  smoothed per-bin magnitudes (Float32Array, 0..1)
//   - bandEnergies  named bands (sub / kick / bass / mids / highs), 0..1
//   - pulse         drum-onset pulse (0..1, springs back to 0 in ~250 ms)
//
// Unlike the music player's analyser (which reads its own audio
// session), this captures whatever the mic hears — external music,
// voices, claps, ambient noise.

const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;

// Bin ranges scaled as fractions of total binCount so the math works
// regardless of sample rate.
export const BANDS = {
  sub:   { start: 1,  end: 3   },
  kick:  { start: 3,  end: 7   },
  bass:  { start: 7,  end: 15  },
  mids:  { start: 15, end: 90  },
  highs: { start: 90, end: 230 },
};

class MicAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.rafId = 0;
    this.subscribers = new Set();

    this.state = {
      isRunning: false,
      rmsDb: -90,
      bandMagnitudes: null,
      bandEnergies: { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 },
      pulse: 0,
    };

    // Spectral-flux onset detector state
    this.previousRaw = null;
    this.fluxHistory = new Float32Array(43);
    this.fluxHistoryIdx = 0;
    this.currentPulse = 0;
    this.pulseTarget = 0;
    this.lastPulseMs = 0;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb(this.state);
    return () => this.subscribers.delete(cb);
  }

  emit(patch) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((cb) => cb(this.state));
  }

  async start() {
    if (this.state.isRunning) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Mic capture for visualization — turn OFF the browser's
          // built-in noise/echo cancellation so quiet ambient sound
          // still produces measurable FFT energy. Without this, the
          // browser would auto-gate quiet input to "silence".
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
    this.analyser.smoothingTimeConstant = 0.6;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    // Don't connect to destination — would loop mic into speakers.

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Uint8Array(this.analyser.fftSize);

    const tick = () => {
      this.analyser.getByteFrequencyData(freqData);
      this.analyser.getByteTimeDomainData(timeData);
      this.process(freqData, timeData);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();

    this.emit({ isRunning: true });
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
    this.currentPulse = 0;
    this.pulseTarget = 0;
    this.fluxHistory.fill(0);
    this.fluxHistoryIdx = 0;
    this.emit({
      isRunning: false,
      rmsDb: -90,
      bandMagnitudes: null,
      bandEnergies: { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 },
      pulse: 0,
    });
  }

  process(freqData, timeData) {
    // ── RMS / dBFS from the waveform ────────────────────────────
    // getByteTimeDomainData returns samples centered around 128.
    // Convert to signed [-128..127], compute RMS, then dBFS.
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const s = timeData[i] - 128;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const db = rms > 1 ? Math.max(-90, 20 * Math.log10(rms / 128)) : -90;

    // ── Magnitudes (normalize byte values 0..255 → 0..1) ────────
    const raw = new Float32Array(freqData.length);
    for (let i = 0; i < freqData.length; i++) raw[i] = freqData[i] / 255;

    // ── Spectral flux on the drum band ──────────────────────────
    const flux = this.computeDrumFlux(raw);

    // ── Adaptive threshold + spring-damped pulse ────────────────
    this.updatePulse(flux);

    // ── Asymmetric peak-hold smoothing on the bands ─────────────
    const smoothed = new Float32Array(raw.length);
    const prev = this.state.bandMagnitudes;
    if (prev && prev.length === raw.length) {
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i];
        const p = prev[i];
        smoothed[i] = r > p ? p + (r - p) * 0.55 : p + (r - p) * 0.08;
      }
    } else {
      smoothed.set(raw);
    }

    this.emit({
      rmsDb: db,
      bandMagnitudes: smoothed,
      bandEnergies: this.computeBandEnergies(smoothed),
      pulse: this.currentPulse,
    });
  }

  computeDrumFlux(raw) {
    const prev = this.previousRaw;
    if (!prev || prev.length !== raw.length) {
      this.previousRaw = raw.slice();
      return 0;
    }
    let flux = 0;
    const start = BANDS.sub.start;
    const end = BANDS.bass.end;
    for (let i = start; i < end; i++) {
      const d = raw[i] - prev[i];
      if (d > 0) flux += d;
    }
    this.previousRaw = raw.slice();
    return flux / (end - start);
  }

  updatePulse(flux) {
    // Rolling average → adaptive threshold (same algorithm as
    // Android MicAnalyzer). Aggressive tuning: low threshold and
    // big multiplier so soft sounds still trigger a visible pulse.
    let avg = 0;
    for (const v of this.fluxHistory) avg += v;
    avg /= this.fluxHistory.length;
    this.fluxHistory[this.fluxHistoryIdx] = flux;
    this.fluxHistoryIdx = (this.fluxHistoryIdx + 1) % this.fluxHistory.length;

    const now = performance.now();
    const dtMs = Math.max(1, now - (this.lastPulseMs || now));
    this.lastPulseMs = now;

    const threshold = Math.max(0.0007, avg * 1.10);
    if (flux > threshold) {
      this.pulseTarget = Math.min(1, (flux - threshold) * 38);
    }
    // Spring damping: fast attack, slow release.
    if (this.pulseTarget > this.currentPulse) {
      this.currentPulse += (this.pulseTarget - this.currentPulse) * 0.55;
    } else {
      this.currentPulse += (this.pulseTarget - this.currentPulse) * 0.12;
    }
    this.pulseTarget *= Math.pow(0.5, dtMs / 180);
    this.currentPulse = Math.max(0, Math.min(1, this.currentPulse));
  }

  computeBandEnergies(mags) {
    const out = { sub: 0, kick: 0, bass: 0, mids: 0, highs: 0 };
    for (const key of Object.keys(BANDS)) {
      const { start, end } = BANDS[key];
      let sum = 0;
      let count = 0;
      for (let i = start; i < end && i < mags.length; i++) {
        sum += mags[i];
        count++;
      }
      out[key] = count > 0 ? sum / count : 0;
    }
    return out;
  }
}

// Module-level singleton — same lifecycle pattern as the music player.
// Multiple components can subscribe to the same analyzer.
const instance = new MicAnalyzer();

export function getMicAnalyzer() {
  return instance;
}

export function useMicAnalyzer() {
  const [state, setState] = useState(instance.state);
  useEffect(() => instance.subscribe(setState), []);
  return state;
}
