// Lightweight wrapper around the Google Cast Web Sender SDK so the rest
// of the music feature can stay agnostic of `window.cast.framework`. Only
// loads the SDK on first use — keeps the no-Cast-browser case zero-cost.
//
// Counterpart of CastManager.kt on Android. Same idea: surface
// isInitialized / isConnected / deviceName, plus loadAudio() and
// togglePlayPause(). Anything more advanced (queue control, custom
// receiver) is intentionally out of scope.

const DEFAULT_RECEIVER = 'CC1AD845'; // Google's default media receiver

const SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

let state = {
  isAvailable: false,   // SDK loaded + Cast supported by browser
  isInitialized: false, // CastContext configured
  isConnected: false,   // an active session exists
  deviceName: null,
};
const subscribers = new Set();
let initPromise = null;
let sdkLoaded = false;

function patch(next) {
  state = { ...state, ...next };
  subscribers.forEach((cb) => cb(state));
}

export function getCastState() {
  return state;
}

export function subscribeCast(cb) {
  subscribers.add(cb);
  cb(state);
  return () => subscribers.delete(cb);
}

function loadScript() {
  return new Promise((resolve, reject) => {
    if (sdkLoaded) return resolve();
    if (typeof document === 'undefined') return reject(new Error('No document'));
    if (document.querySelector(`script[src="${SDK_URL}"]`)) {
      sdkLoaded = true;
      return resolve();
    }
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error('Failed to load Cast SDK'));
    document.head.appendChild(s);
  });
}

export function initCast() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await loadScript();
      await new Promise((resolve) => {
        // The SDK fires this once it's ready. The boolean arg is "Cast is
        // available in this browser".
        const existing = window.__onGCastApiAvailable;
        window.__onGCastApiAvailable = (available) => {
          existing?.(available);
          if (!available) {
            patch({ isAvailable: false });
            resolve();
            return;
          }
          const cast = window.cast?.framework;
          if (!cast) {
            patch({ isAvailable: false });
            resolve();
            return;
          }
          cast.CastContext.getInstance().setOptions({
            receiverApplicationId: DEFAULT_RECEIVER,
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          });

          const context = cast.CastContext.getInstance();
          context.addEventListener(
            cast.CastContextEventType.SESSION_STATE_CHANGED,
            () => {
              const session = context.getCurrentSession();
              if (session && session.getSessionState() === cast.SessionState.SESSION_STARTED) {
                patch({
                  isConnected: true,
                  deviceName: session.getCastDevice()?.friendlyName ?? null,
                });
              } else if (
                !session ||
                session.getSessionState() === cast.SessionState.SESSION_ENDED
              ) {
                patch({ isConnected: false, deviceName: null });
              }
            }
          );
          // Pick up an existing session (e.g. autoJoin to an in-progress one).
          const session = context.getCurrentSession();
          if (session && session.getSessionState() === cast.SessionState.SESSION_STARTED) {
            patch({
              isConnected: true,
              deviceName: session.getCastDevice()?.friendlyName ?? null,
            });
          }
          patch({ isAvailable: true, isInitialized: true });
          resolve();
        };
        // If the SDK script was already loaded before this listener was set,
        // it won't fire the callback again. Detect that and call manually.
        if (window.cast?.framework) {
          window.__onGCastApiAvailable(true);
        }
      });
    } catch {
      patch({ isAvailable: false, isInitialized: false });
    }
  })();
  return initPromise;
}

// Pops the Cast device chooser. Must be called from a user gesture handler.
export async function requestCastSession() {
  await initCast();
  const cast = window.cast?.framework;
  if (!cast) return false;
  try {
    await cast.CastContext.getInstance().requestSession();
    return true;
  } catch {
    // User dismissed the dialog or chose a device that failed.
    return false;
  }
}

export function endCastSession() {
  const cast = window.cast?.framework;
  if (!cast) return;
  try {
    cast.CastContext.getInstance().endCurrentSession(true);
  } catch {
    // Ignore.
  }
}

// Sends a track to the connected receiver. Returns true if the load
// request was issued, false if there's no active session.
export function loadAudioOnCast({
  streamUrl,
  title,
  artist,
  albumArtUrl,
  contentType = 'audio/mp4',
  durationSec,
}) {
  const cast = window.cast?.framework;
  const chrome = window.chrome?.cast;
  if (!cast || !chrome) return false;
  const session = cast.CastContext.getInstance().getCurrentSession();
  if (!session) return false;

  const meta = new chrome.media.MusicTrackMediaMetadata();
  meta.title = title;
  meta.artist = artist;
  if (albumArtUrl) meta.images = [new chrome.cast.Image(albumArtUrl)];

  const info = new chrome.media.MediaInfo(streamUrl, contentType);
  info.metadata = meta;
  if (durationSec) info.duration = durationSec;
  info.streamType = chrome.media.StreamType.BUFFERED;

  const request = new chrome.media.LoadRequest(info);
  request.autoplay = true;

  try {
    session.loadMedia(request);
    return true;
  } catch {
    return false;
  }
}

export function castTogglePlayPause() {
  const cast = window.cast?.framework;
  if (!cast) return;
  const session = cast.CastContext.getInstance().getCurrentSession();
  const media = session?.getMediaSession();
  const chrome = window.chrome?.cast?.media;
  if (!media || !chrome) return;
  try {
    if (media.playerState === chrome.PlayerState.PLAYING) {
      media.pause(null);
    } else {
      media.play(null);
    }
  } catch {
    // Ignore.
  }
}
