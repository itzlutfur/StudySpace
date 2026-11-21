import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp01,
  mergeWatchedPct,
  isComplete,
  shouldOfferResume,
  courseStats,
  findResumeLesson,
  formatTime,
} from '../src/lib/progress.js';

test('clamp01 keeps values inside [0, 1]', () => {
  assert.equal(clamp01(0.5), 0.5);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(undefined), 0);
  assert.equal(clamp01('nonsense'), 0);
});

test('mergeWatchedPct never regresses', () => {
  assert.equal(mergeWatchedPct(0.5, 10, 100), 0.5);
  assert.equal(mergeWatchedPct(0.5, 90, 100), 0.9);
  assert.equal(mergeWatchedPct(0, 0, 0), 0);
});

test('isComplete reads the snake_case progress row', () => {
  // This is the regression test for the case mismatch bug: the helpers used
  // to destructure `watchedPct`, so a raw database row always read as 0%.
  assert.equal(isComplete({ watched_pct: 0.95, completed: 0 }), true);
  assert.equal(isComplete({ watched_pct: 0.5, completed: 0 }), false);
  assert.equal(isComplete({ watched_pct: 0, completed: 1 }), true);
  assert.equal(isComplete({}), false);
});

test('shouldOfferResume reads the snake_case progress row', () => {
  assert.equal(shouldOfferResume({ position_sec: 30, watched_pct: 0.3, completed: 0 }), true);
  // Below the 5 second threshold there is nothing to resume.
  assert.equal(shouldOfferResume({ position_sec: 2, watched_pct: 0.3, completed: 0 }), false);
  // At or above 95% watched the lesson is effectively done.
  assert.equal(shouldOfferResume({ position_sec: 30, watched_pct: 0.96, completed: 0 }), false);
  assert.equal(shouldOfferResume({ position_sec: 30, watched_pct: 0.3, completed: 1 }), false);
});

test('courseStats computes percent and averagePercent from progress rows', () => {
  const lessons = [
    { id: 1, missing: 0 },
    { id: 2, missing: 0 },
    { id: 3, missing: 0 },
    { id: 4, missing: 1 },
  ];
  const progress = new Map([
    [1, { watched_pct: 1, completed: 1 }],
    [2, { watched_pct: 0.5, completed: 0 }],
    // Lesson 3 has no progress row at all.
    // Lesson 4 is missing and is excluded from the denominator.
  ]);

  const stats = courseStats(lessons, progress);
  assert.equal(stats.total, 4);
  assert.equal(stats.counted, 3);
  assert.equal(stats.missing, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.percent, 33);
  // (1 + 0.5 + 0) / 3 = 0.5 -> 50%
  assert.equal(stats.averagePercent, 50);
});

test('courseStats handles an empty library', () => {
  const stats = courseStats([], new Map());
  assert.equal(stats.total, 0);
  assert.equal(stats.counted, 0);
  assert.equal(stats.percent, 0);
  assert.equal(stats.averagePercent, 0);
});

test('findResumeLesson picks the most recently played incomplete lesson', () => {
  const lessons = [
    { id: 1, missing: 0 },
    { id: 2, missing: 0 },
    { id: 3, missing: 1 },
  ];
  const progress = new Map([
    [1, { watched_pct: 0.2, completed: 0, last_played: '2026-01-01 10:00:00' }],
    [2, { watched_pct: 0.2, completed: 0, last_played: '2026-01-02 10:00:00' }],
    [3, { watched_pct: 0.2, completed: 0, last_played: '2026-01-03 10:00:00' }],
  ]);

  const resume = findResumeLesson(lessons, progress);
  // Lesson 3 is missing, so it is skipped.
  assert.equal(resume.id, 2);
});

test('findResumeLesson skips completed lessons', () => {
  const lessons = [{ id: 1, missing: 0 }];
  const progress = new Map([
    [1, { watched_pct: 1, completed: 1, last_played: '2026-01-01 10:00:00' }],
  ]);
  assert.equal(findResumeLesson(lessons, progress), null);
});

test('formatTime renders m:ss and h:mm:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9), '0:09');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3600), '1:00:00');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-5), '0:00');
});
