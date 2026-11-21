import { COMPLETION_THRESHOLD, RESUME_MAX_PCT, RESUME_MIN_SECONDS } from '../config.js';

/** Clamp a number into [0, 1]. */
export function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * Compute the furthest watched fraction. Playback position can go backwards
 * (the user scrubs back), but completion must not regress — so we track the
 * maximum position ever reached.
 */
export function mergeWatchedPct(previousPct, positionSec, durationSec) {
  const dur = Number(durationSec);
  if (!Number.isFinite(dur) || dur <= 0) return clamp01(previousPct);
  return Math.max(clamp01(previousPct), clamp01(Number(positionSec) / dur));
}

/**
 * A lesson counts as complete at 90% watched, or when marked manually.
 *
 * These helpers read raw `progress` table rows, whose columns are snake_case.
 */
export function isComplete({ watched_pct, completed }) {
  if (completed) return true;
  return clamp01(watched_pct) >= COMPLETION_THRESHOLD;
}

/**
 * Whether to offer a "resume" affordance for a lesson.
 * Below 5 seconds there is nothing to resume; at/above 95% the lesson is done.
 */
export function shouldOfferResume({ position_sec, watched_pct, completed }) {
  if (completed) return false;
  const pos = Number(position_sec) || 0;
  if (pos < RESUME_MIN_SECONDS) return false;
  if (clamp01(watched_pct) >= RESUME_MAX_PCT) return false;
  return true;
}

/**
 * Course-level completion.
 * Missing lessons are excluded from the denominator — a file the user deleted
 * from disk should not permanently block the course from reaching 100%.
 */
export function courseStats(lessons, progressByLessonId) {
  const total = lessons.length;
  const counted = lessons.filter((l) => !l.missing);
  const denom = counted.length || 0;

  let completed = 0;
  let watchedSum = 0;

  for (const lesson of lessons) {
    const p = progressByLessonId.get(lesson.id);
    if (!p) continue;
    if (isComplete(p)) completed += 1;
    watchedSum += clamp01(p.watched_pct);
  }

  const pct = denom > 0 ? completed / denom : 0;
  const average = counted.length > 0 ? watchedSum / counted.length : 0;

  return {
    total,
    counted: denom,
    missing: total - denom,
    completed,
    percent: Math.round(pct * 100),
    averagePercent: Math.round(average * 100),
  };
}

/**
 * Find the lesson the user should resume: the most recently played incomplete
 * lesson of a course.
 */
export function findResumeLesson(lessons, progressByLessonId) {
  let best = null;
  for (const lesson of lessons) {
    if (lesson.missing) continue;
    const p = progressByLessonId.get(lesson.id);
    if (!p || !p.last_played) continue;
    if (isComplete(p)) continue;
    if (!best) {
      best = lesson;
      continue;
    }
    const bp = progressByLessonId.get(best.id);
    if (new Date(p.last_played) > new Date(bp.last_played)) best = lesson;
  }
  return best;
}

/** Format seconds as mm:ss or h:mm:ss. */
export function formatTime(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default {
  clamp01,
  mergeWatchedPct,
  isComplete,
  shouldOfferResume,
  courseStats,
  findResumeLesson,
  formatTime,
};
