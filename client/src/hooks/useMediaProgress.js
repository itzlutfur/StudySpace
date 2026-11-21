import { useCallback, useEffect, useRef } from 'react';

import { saveProgress } from '../api/progress.js';

const SAVE_INTERVAL_MS = 5000;

/**
 * Autosave the playback position while the media plays.
 *
 * Saves are debounced to one every five seconds (and skipped when the
 * position barely moved), flushed immediately on pause, and sent one last
 * time via `sendBeacon` when the page is hidden so nothing is lost on close.
 */
export default function useMediaProgress(lessonId, mediaRef, { onEnded } = {}) {
  const lastSaved = useRef(0);
  const timer = useRef(null);
  const saved = useRef(false);

  const flush = useCallback(() => {
    const media = mediaRef.current;
    if (!media || !lessonId) return;
    const position = Number(media.currentTime) || 0;
    const duration = Number(media.duration) || 0;
    if (!position && !duration) return;
    lastSaved.current = position;
    saveProgress(lessonId, position, duration).catch(() => {});
  }, [lessonId, mediaRef]);

  const schedule = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, SAVE_INTERVAL_MS);
  }, [flush]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !lessonId) return undefined;

    const onTimeUpdate = () => {
      if (Math.abs((media.currentTime ?? 0) - lastSaved.current) < 1) return;
      schedule();
    };

    const onPause = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      flush();
    };

    const onEnded = () => {
      flush();
      onEnded?.();
    };

    const onPageHide = () => {
      const position = Number(media.currentTime) || 0;
      const duration = Number(media.duration) || 0;
      if (!position && !duration) return;
      const blob = new Blob([JSON.stringify({ position, duration })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`/api/progress/${lessonId}`, blob);
    };

    media.addEventListener('timeupdate', onTimeUpdate);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      media.removeEventListener('timeupdate', onTimeUpdate);
      media.removeEventListener('pause', onPause);
      media.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', onPageHide);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [lessonId, mediaRef, flush, schedule, onEnded]);

  return { flush, saved: saved.current };
}
