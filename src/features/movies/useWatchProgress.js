import { useEffect, useRef, useState } from 'react';
import {
  getWatchProgress,
  parsePlayerEvent,
  saveWatchPosition,
} from './watchProgressRepository.js';

// Drives watch-progress for a vidking iframe player. Fetches the last
// saved position once on mount (so the caller can pass `progressSeconds`
// to the embed URL), then listens for the iframe's postMessage events and
// throttle-saves them back to Firestore.
//
// Vidking posts events with shape:
//   { type: 'PLAYER_EVENT', data: { event, currentTime, duration, progress, id, mediaType } }
// We only persist timeupdate/pause/ended/seeked/play.

const PERSIST_EVENTS = new Set(['timeupdate', 'pause', 'ended', 'seeked', 'play']);
const MIN_SAVE_INTERVAL_MS = 5000;

export function useWatchProgress({ tmdbId, mediaType }) {
  const [initialSeconds, setInitialSeconds] = useState(null); // null = loading
  const lastSaveRef = useRef(0);
  const idRef = useRef(String(tmdbId));
  const mediaRef = useRef(mediaType);

  useEffect(() => {
    idRef.current = String(tmdbId);
    mediaRef.current = mediaType;
  }, [tmdbId, mediaType]);

  // Fetch saved position once.
  useEffect(() => {
    let alive = true;
    setInitialSeconds(null);
    if (!tmdbId) {
      setInitialSeconds(0);
      return;
    }
    getWatchProgress(tmdbId).then((p) => {
      if (!alive) return;
      const t = Math.floor(Number(p?.currentTime) || 0);
      // Don't auto-resume right at the very end of a movie.
      const dur = Number(p?.duration) || 0;
      const tooCloseToEnd = dur > 0 && t > 0 && dur - t < 30;
      setInitialSeconds(tooCloseToEnd ? 0 : t);
    });
    return () => {
      alive = false;
    };
  }, [tmdbId]);

  // Listen for vidking postMessage events.
  useEffect(() => {
    function handler(e) {
      const ev = parsePlayerEvent(e.data);
      if (!ev || !PERSIST_EVENTS.has(ev.name)) return;
      const now = Date.now();
      // timeupdate fires frequently — throttle. pause/seek/ended/play
      // always write.
      if (ev.name === 'timeupdate' && now - lastSaveRef.current < MIN_SAVE_INTERVAL_MS) {
        return;
      }
      lastSaveRef.current = now;
      saveWatchPosition({
        tmdbId: idRef.current,
        mediaType: mediaRef.current,
        currentTime: ev.currentTime,
        duration: ev.duration,
      });
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return { initialSeconds };
}
