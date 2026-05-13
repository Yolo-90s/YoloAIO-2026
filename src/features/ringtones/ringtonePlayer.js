import { useEffect, useRef, useState } from 'react';

// One <audio> element shared across the whole screen. Returns a hook with
// the currently-playing tone id and a toggle handler — picking a different
// tone stops the previous one, picking the same tone toggles play/pause.
//
// Browsers throttle background audio and need user-initiated play to honor
// autoplay, so the `toggle` call must originate from a click handler.
export function useRingtonePlayer() {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      setLoading(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      setPlayingId(null);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const toggle = (id, src) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    // New tone — swap source. setLoading covers the network gap between
    // setting `.src` and the actual buffer becoming playable.
    setLoading(true);
    setPlayingId(id);
    audio.src = src;
    audio.play().catch(() => {
      setLoading(false);
      setPlayingId(null);
    });
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlayingId(null);
  };

  return { playingId, isPlaying, loading, toggle, stop };
}
