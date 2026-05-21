// Video export pipeline. Takes a streaming Drive URL, applies trim +
// playback rate + text overlay + mute/audio-only, and returns a Blob.
//
// Pipeline:
//   <video> (hidden, crossOrigin)  ─┬──▶ captureStream() audio track  ──┐
//                                   │                                    │
//   rAF: drawImage + drawText  ───▶ <canvas>.captureStream() video  ────┴─▶ MediaRecorder  ─▶ Blob
//
// We always go through the canvas (even when there's no text overlay)
// because that keeps one code path. Browsers that don't support
// `captureStream` will throw early with a clear message.

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
];

function pickMime(candidates) {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export function getSupportedVideoMime() { return pickMime(VIDEO_MIME_CANDIDATES); }
export function getSupportedAudioMime() { return pickMime(AUDIO_MIME_CANDIDATES); }

// Loads metadata so we know intrinsic width/height + actual duration.
// Resolves with the prepared <video> element, which the caller must
// remove from the DOM when done.
function prepareSourceVideo(url, { muted } = {}) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    v.playsInline = true;
    v.muted = !!muted;
    // Hidden but in the DOM — some browsers refuse captureStream() on a
    // detached element.
    v.style.position = 'fixed';
    v.style.left = '-10000px';
    v.style.width = '1px';
    v.style.height = '1px';
    v.style.opacity = '0';
    v.style.pointerEvents = 'none';
    document.body.appendChild(v);

    const cleanup = () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('error', onErr);
    };
    const onMeta = () => { cleanup(); resolve(v); };
    const onErr = () => {
      cleanup();
      v.remove();
      reject(new Error('Could not load the video. Check that the Drive file streams via the proxy.'));
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('error', onErr);
    v.src = url;
  });
}

// Draws a single frame from the source video onto the canvas, then
// (optionally) renders a text overlay on top.
function drawFrame(canvas, ctx, video, overlay) {
  if (video.readyState >= 2) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  if (!overlay || !overlay.text) return;
  const text = String(overlay.text);
  const fontSize = Math.max(14, Math.round((overlay.fontSize ?? 0.06) * canvas.height));
  ctx.save();
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = canvas.width / 2;
  let cy;
  switch (overlay.position) {
    case 'top':    cy = fontSize * 1.1; break;
    case 'middle': cy = canvas.height / 2; break;
    case 'bottom':
    default:       cy = canvas.height - fontSize * 1.1; break;
  }

  if (overlay.background === 'box') {
    // Translucent pill behind the text — much more legible over busy footage.
    const metrics = ctx.measureText(text);
    const w = metrics.width + fontSize * 0.8;
    const h = fontSize * 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundedRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
  } else if (overlay.background !== 'none') {
    // Default: text shadow. Cheap and looks great over most backgrounds.
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = fontSize * 0.35;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = overlay.color || '#ffffff';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Combine the canvas video track with the source's audio track (or
// drop audio entirely for mute). Returns a MediaStream the recorder
// can consume.
function buildCombinedStream({ canvas, sourceVideo, muted, fps }) {
  const canvasStream = canvas.captureStream(fps);
  const out = new MediaStream();
  for (const t of canvasStream.getVideoTracks()) out.addTrack(t);
  if (!muted) {
    const srcStream = typeof sourceVideo.captureStream === 'function'
      ? sourceVideo.captureStream()
      : sourceVideo.mozCaptureStream?.();
    if (srcStream) {
      for (const t of srcStream.getAudioTracks()) out.addTrack(t);
    }
  }
  return out;
}

// Main export: produces a WebM video Blob.
//
//   await exportClip({
//     sourceUrl,
//     start, end,                 // seconds within the original video
//     speed: 1,                   // 0.5 | 1 | 1.5 | 2
//     muted: false,
//     overlay: null | { text, color, fontSize, position, background },
//     maxHeight: 720,             // downscale tall videos for performance
//     fps: 30,
//     onProgress: (ratio) => {},  // 0..1
//   })
export async function exportClip({
  sourceUrl,
  start,
  end,
  speed = 1,
  muted = false,
  overlay = null,
  maxHeight = 720,
  fps = 30,
  onProgress,
} = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support MediaRecorder. Try Chrome, Edge, or Firefox.');
  }
  const mime = getSupportedVideoMime();
  if (!mime) throw new Error('No supported WebM codec found in this browser.');
  if (!(end > start)) throw new Error('Trim range is empty — drag the handles to select a clip.');

  const sourceVideo = await prepareSourceVideo(sourceUrl, { muted });
  let recorder;
  let raf = 0;
  let removed = false;
  const finish = () => {
    if (removed) return;
    removed = true;
    cancelAnimationFrame(raf);
    try { sourceVideo.pause(); } catch { /* noop */ }
    sourceVideo.removeAttribute('src');
    try { sourceVideo.load(); } catch { /* noop */ }
    sourceVideo.remove();
  };

  try {
    const srcW = sourceVideo.videoWidth || 1280;
    const srcH = sourceVideo.videoHeight || 720;
    const scale = srcH > maxHeight ? maxHeight / srcH : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(srcW * scale));
    canvas.height = Math.max(2, Math.round(srcH * scale));
    const ctx = canvas.getContext('2d');

    const stream = buildCombinedStream({ canvas, sourceVideo, muted, fps });
    recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (e) => reject(new Error(`Recorder error: ${e?.error?.message || 'unknown'}`));
    });

    // Seek to start, then start playback + recording together. We can't
    // seek-then-immediately-play in all browsers; wait for `seeked`.
    sourceVideo.playbackRate = speed;
    sourceVideo.currentTime = start;
    await waitFor(sourceVideo, 'seeked');

    recorder.start();
    const playStarted = sourceVideo.play();
    if (playStarted && typeof playStarted.catch === 'function') {
      playStarted.catch(() => { /* autoplay errors surface via onerror below */ });
    }

    // Frame pump. Reading `currentTime` per frame is enough to decide
    // when to stop — playbackRate is already baked into how time advances.
    const totalSpan = end - start;
    const draw = () => {
      drawFrame(canvas, ctx, sourceVideo, overlay);
      const elapsed = sourceVideo.currentTime - start;
      if (onProgress) onProgress(Math.max(0, Math.min(1, elapsed / totalSpan)));
      if (sourceVideo.currentTime >= end || sourceVideo.ended) {
        if (recorder.state === 'recording') recorder.stop();
        return;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // Safety net — if the video stalls past the expected duration, stop
    // anyway. Wall-clock duration = span / speed, give it 1.5×.
    const safety = setTimeout(() => {
      if (recorder.state === 'recording') {
        try { recorder.stop(); } catch { /* noop */ }
      }
    }, ((totalSpan / Math.max(0.25, speed)) + 2) * 1000 * 1.5);

    await stopped;
    clearTimeout(safety);
    if (onProgress) onProgress(1);

    return new Blob(chunks, { type: mime });
  } finally {
    finish();
  }
}

// Audio-only export — same trim + speed + overlay-is-irrelevant. Output
// is a WebM/Opus Blob suitable for sharing as an audio file.
export async function exportAudio({
  sourceUrl,
  start,
  end,
  speed = 1,
  onProgress,
} = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support MediaRecorder.');
  }
  const mime = getSupportedAudioMime();
  if (!mime) throw new Error('No supported Opus codec found in this browser.');
  if (!(end > start)) throw new Error('Trim range is empty.');

  const sourceVideo = await prepareSourceVideo(sourceUrl, { muted: false });
  let recorder;
  let removed = false;
  const finish = () => {
    if (removed) return;
    removed = true;
    try { sourceVideo.pause(); } catch { /* noop */ }
    sourceVideo.removeAttribute('src');
    try { sourceVideo.load(); } catch { /* noop */ }
    sourceVideo.remove();
  };

  try {
    const srcStream = typeof sourceVideo.captureStream === 'function'
      ? sourceVideo.captureStream()
      : sourceVideo.mozCaptureStream?.();
    if (!srcStream) throw new Error('Browser refused to capture audio from the video element.');

    const audioOnly = new MediaStream();
    for (const t of srcStream.getAudioTracks()) audioOnly.addTrack(t);
    if (audioOnly.getAudioTracks().length === 0) {
      throw new Error('This video has no audio track to extract.');
    }

    recorder = new MediaRecorder(audioOnly, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (e) => reject(new Error(`Recorder error: ${e?.error?.message || 'unknown'}`));
    });

    sourceVideo.playbackRate = speed;
    sourceVideo.currentTime = start;
    await waitFor(sourceVideo, 'seeked');

    recorder.start();
    sourceVideo.play().catch(() => { /* errors surface via recorder.onerror */ });

    // Audio-only doesn't need rAF; a simple polling loop is fine and
    // cheaper. 100ms granularity is plenty for trim accuracy.
    const totalSpan = end - start;
    await new Promise((resolve) => {
      const tick = () => {
        const elapsed = sourceVideo.currentTime - start;
        if (onProgress) onProgress(Math.max(0, Math.min(1, elapsed / totalSpan)));
        if (sourceVideo.currentTime >= end || sourceVideo.ended) {
          if (recorder.state === 'recording') recorder.stop();
          resolve();
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });

    await stopped;
    if (onProgress) onProgress(1);
    return new Blob(chunks, { type: mime });
  } finally {
    finish();
  }
}

function waitFor(el, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let t;
    const handler = () => { clearTimeout(t); el.removeEventListener(event, handler); resolve(); };
    el.addEventListener(event, handler, { once: true });
    t = setTimeout(() => {
      el.removeEventListener(event, handler);
      reject(new Error(`Timed out waiting for video "${event}".`));
    }, timeoutMs);
  });
}

// Web Share API helper. Falls back to a download link when files-share
// isn't supported (most desktop browsers).
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return { shared: true };
    } catch (e) {
      // User cancelled — treat as silent no-op, not an error.
      if (e?.name === 'AbortError') return { shared: false, cancelled: true };
      // Some browsers throw NotAllowedError if the share gesture timing
      // is off; fall through to download in that case.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false, downloaded: true };
}
