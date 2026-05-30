// Web-Audio DSP chain — same conceptual layout as the Android
// MusicEffects (Equalizer + BassBoost + Virtualizer + LoudnessEnhancer)
// but built from primitives because Web Audio has no built-in BassBoost
// or Virtualizer nodes.
//
// Topology (left to right, source → destination):
//
//   sourceNode
//     ▼
//   inputGain   ── handle so MusicPlayer can plug/unplug us cleanly
//     ▼
//   bassShelf   (BiquadFilter "lowshelf" — bass boost)
//     ▼
//   eq[5]       (BiquadFilters: lowshelf / peak / peak / peak / highshelf
//                  centred at 60 / 230 / 910 / 3600 / 14000 Hz)
//     ▼
//   loudness    (GainNode — loudness gain in dB)
//     ▼
//   ┌── Virtualizer split ──┐
//   │   stereoSplit  (ChannelSplitter)
//   │     ├── direct  ──────────────┐
//   │     └── crossfeed (DelayNode +│ wetGain)
//   │                                ▼
//   │       merger (ChannelMerger)
//   └────────────────────────────────┘
//     ▼
//   wet / dry mix (Gain pair — full off when virtualizer = 0)
//     ▼
//   destination

export const EQ_BANDS = [
  // Same five bands as Android's stock Equalizer.
  { freq: 60,    type: 'lowshelf'  },
  { freq: 230,   type: 'peaking'   },
  { freq: 910,   type: 'peaking'   },
  { freq: 3600,  type: 'peaking'   },
  { freq: 14000, type: 'highshelf' },
];

// Per-preset band gains in dB. Mirrors the Android EqPreset table
// (which used millibels — divide by 100 to get dB).
export const EQ_PRESETS = [
  { name: 'Flat',       label: 'Flat',       gains: [ 0,   0,   0,   0,   0] },
  { name: 'Pop',        label: 'Pop',        gains: [ 2,   1,  -1,  -2,   1] },
  { name: 'Rock',       label: 'Rock',       gains: [ 4,   2,  -1,   1,   4] },
  { name: 'Classical',  label: 'Classical',  gains: [ 3, 1.5,   0, 1.5,   3] },
  { name: 'Dance',      label: 'Dance',      gains: [ 5,   3,   0,   2,   4] },
  { name: 'HipHop',     label: 'Hip-Hop',    gains: [ 6,   3,   0,   1,   3] },
  { name: 'Jazz',       label: 'Jazz',       gains: [ 3,   2,   0,   2,   3] },
  { name: 'Vocal',      label: 'Vocal',      gains: [-2,  -1,   2,   4,   1] },
  { name: 'BassPunch',  label: 'Bass punch', gains: [ 7,   4,  -1,  -1,   1] },
];

export class MusicEffects {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();

    // Bass-boost low-shelf — separate from the EQ so the user can ride
    // bass strength without touching their preset.
    this.bassShelf = audioContext.createBiquadFilter();
    this.bassShelf.type = 'lowshelf';
    this.bassShelf.frequency.value = 120;
    this.bassShelf.gain.value = 0;

    // 5-band parametric EQ.
    this.eqNodes = EQ_BANDS.map((b) => {
      const f = audioContext.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.freq;
      if (b.type === 'peaking') f.Q.value = 1.2;
      f.gain.value = 0;
      return f;
    });

    // Loudness gain stage.
    this.loudness = audioContext.createGain();
    this.loudness.gain.value = 1;

    // Stereo virtualizer — gentle Haas-effect crossfeed for stereo
    // widening. Single delay + gain is enough on speakers / typical
    // headphones; anything more sophisticated would need IIR filters
    // (HRTF-style) that are out of scope.
    this.virtSplit = audioContext.createChannelSplitter(2);
    this.virtMerge = audioContext.createChannelMerger(2);
    this.virtDelayL = audioContext.createDelay(0.05);
    this.virtDelayR = audioContext.createDelay(0.05);
    this.virtDelayL.delayTime.value = 0.012;
    this.virtDelayR.delayTime.value = 0.018;
    this.virtWet = audioContext.createGain();
    this.virtWet.gain.value = 0;
    this.virtDry = audioContext.createGain();
    this.virtDry.gain.value = 1;

    // Wire it all up.
    //   input → bassShelf → eq0 → eq1 → … → loudness → (split → merge) → output
    this.input.connect(this.bassShelf);
    let last = this.bassShelf;
    for (const node of this.eqNodes) {
      last.connect(node);
      last = node;
    }
    last.connect(this.loudness);

    // Wet path (virtualizer)
    this.loudness.connect(this.virtSplit);
    this.virtSplit.connect(this.virtDelayL, 0);
    this.virtSplit.connect(this.virtDelayR, 1);
    this.virtDelayL.connect(this.virtMerge, 0, 1); // L → R channel
    this.virtDelayR.connect(this.virtMerge, 0, 0); // R → L channel
    this.virtMerge.connect(this.virtWet);
    this.virtWet.connect(this.output);

    // Dry path (no virtualizer)
    this.loudness.connect(this.virtDry);
    this.virtDry.connect(this.output);

    // Enabled state — when disabled, we mute the bass shelf, flatten
    // all EQ bands, kill loudness gain back to 1.0, and full-dry the
    // virtualizer. We don't physically disconnect nodes because that
    // would click; staying flat is silent.
    this.enabled = false;
  }

  // Bass strength 0..100 → 0..15 dB shelf gain.
  setBassStrength(pct) {
    const gain = (pct / 100) * 15;
    this.bassShelf.gain.value = this.enabled ? gain : 0;
  }

  // Virtualizer strength 0..100 → wet mix proportion. Above ~60%
  // it gets phasey on speakers; mid-range is the sweet spot for
  // headphones.
  setVirtualizerStrength(pct) {
    const wet = this.enabled ? (pct / 100) * 0.6 : 0;
    this.virtWet.gain.value = wet;
    this.virtDry.gain.value = 1 - wet * 0.4;
  }

  // Loudness gain 0..100 → 0..20 dB amplification.
  setLoudnessGain(pct) {
    const db = (pct / 100) * 20;
    const linear = Math.pow(10, db / 20);
    this.loudness.gain.value = this.enabled ? linear : 1;
  }

  setPreset(preset) {
    const found = EQ_PRESETS.find((p) => p.name === preset) ?? EQ_PRESETS[0];
    for (let i = 0; i < this.eqNodes.length && i < found.gains.length; i++) {
      this.eqNodes[i].gain.value = this.enabled ? found.gains[i] : 0;
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  // Apply a full settings snapshot. Used by the player when prefs
  // change, so a single call updates everything atomically.
  apply(settings) {
    this.setEnabled(settings.enabled);
    this.setPreset(settings.preset);
    this.setBassStrength(settings.bassStrength);
    this.setVirtualizerStrength(settings.virtualizerStrength);
    this.setLoudnessGain(settings.loudnessGain);
  }
}
