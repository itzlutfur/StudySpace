import express from 'express';

import { getLesson, getLessonWithCourse, loadProgress } from '../lib/courses.js';
import { get, run, all } from '../db/index.js';
import { clamp01, mergeWatchedPct, isComplete, shouldOfferResume } from '../lib/progress.js';

const router = express.Router();

/** Ensure a progress row exists for a lesson. */
function ensureProgress(lessonId) {
  let row = get('SELECT * FROM progress WHERE lesson_id = ?', [lessonId]);
  if (!row) {
    run('INSERT INTO progress (lesson_id) VALUES (?)', [lessonId]);
    row = get('SELECT * FROM progress WHERE lesson_id = ?', [lessonId]);
  }
  return row;
}

/** GET /api/progress/:lessonId */
router.get('/:lessonId', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLesson(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const row = ensureProgress(lessonId);
  res.json({
    lessonId,
    positionSec: row.position_sec,
    durationSec: row.duration_sec,
    completed: !!row.completed,
    watchedPct: row.watched_pct,
    lastPlayed: row.last_played,
    offerResume: shouldOfferResume(row),
  });
});

/**
 * POST /api/progress/:lessonId  { position, duration }
 * Saves the playback position. `watched_pct` only ever grows.
 */
router.post('/:lessonId', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLesson(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const body = req.body ?? {};
  const position = Math.max(0, Number(body.position ?? body.positionSec ?? 0) || 0);
  const duration = Math.max(0, Number(body.duration ?? body.durationSec ?? 0) || 0);

  const existing = ensureProgress(lessonId);
  const watchedPct = mergeWatchedPct(existing.watched_pct, position, duration);
  const completed = existing.completed ? 1 : isComplete({ watchedPct, completed: 0 }) ? 1 : 0;

  run(
    `UPDATE progress
        SET position_sec = ?, duration_sec = ?, watched_pct = ?, completed = ?,
            last_played = datetime('now'), updated_at = datetime('now')
      WHERE lesson_id = ?`,
    [position, duration, watchedPct, completed, lessonId]
  );

  res.json({
    ok: true,
    lessonId,
    positionSec: position,
    durationSec: duration,
    watchedPct,
    completed: !!completed,
  });
});

/** POST /api/progress/:lessonId/complete { completed } */
router.post('/:lessonId/complete', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLesson(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const completed = req.body?.completed === false ? 0 : 1;
  ensureProgress(lessonId);
  run(
    `UPDATE progress SET completed = ?, updated_at = datetime('now'), last_played = datetime('now')
      WHERE lesson_id = ?`,
    [completed, lessonId]
  );
  res.json({ ok: true, lessonId, completed: !!completed });
});

/* --------------------------- bookmarks ----------------------------- */

/** GET /api/progress/:lessonId/bookmarks */
router.get('/:lessonId/bookmarks', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!getLesson(lessonId)) return res.status(404).json({ error: 'Lesson not found' });
  const bookmarks = all('SELECT * FROM bookmarks WHERE lesson_id = ? ORDER BY timestamp ASC', [lessonId]);
  res.json({ bookmarks });
});

/** POST /api/progress/:lessonId/bookmarks { timestamp, label } */
router.post('/:lessonId/bookmarks', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!getLesson(lessonId)) return res.status(404).json({ error: 'Lesson not found' });

  const timestamp = Math.max(0, Number(req.body?.timestamp ?? 0) || 0);
  const label = String(req.body?.label ?? '').slice(0, 500);

  const res1 = run(
    'INSERT INTO bookmarks (lesson_id, timestamp, label) VALUES (?, ?, ?)',
    [lessonId, timestamp, label]
  );
  const bookmark = get('SELECT * FROM bookmarks WHERE id = ?', [res1.lastInsertRowid]);
  res.status(201).json({ ok: true, bookmark });
});

/** DELETE /api/progress/:lessonId/bookmarks/:bookmarkId */
router.delete('/:lessonId/bookmarks/:bookmarkId', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const bookmarkId = Number(req.params.bookmarkId);
  const result = run('DELETE FROM bookmarks WHERE id = ? AND lesson_id = ?', [bookmarkId, lessonId]);
  if (!result.changes) return res.status(404).json({ error: 'Bookmark not found' });
  res.json({ ok: true });
});

/** PATCH /api/progress/:lessonId/bookmarks/:bookmarkId { label } */
router.patch('/:lessonId/bookmarks/:bookmarkId', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const bookmarkId = Number(req.params.bookmarkId);
  const label = String(req.body?.label ?? '').slice(0, 500);
  const result = run(
    'UPDATE bookmarks SET label = ? WHERE id = ? AND lesson_id = ?',
    [label, bookmarkId, lessonId]
  );
  if (!result.changes) return res.status(404).json({ error: 'Bookmark not found' });
  res.json({ ok: true, id: bookmarkId, label });
});

/* ----------------------------- notes ------------------------------- */

/** GET /api/progress/:lessonId/notes */
router.get('/:lessonId/notes', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!getLesson(lessonId)) return res.status(404).json({ error: 'Lesson not found' });
  const row = get('SELECT * FROM notes WHERE lesson_id = ?', [lessonId]);
  res.json({ body: row?.body ?? '', updatedAt: row?.updated_at ?? null });
});

/** PUT /api/progress/:lessonId/notes { body } */
router.put('/:lessonId/notes', (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!getLesson(lessonId)) return res.status(404).json({ error: 'Lesson not found' });

  const body = String(req.body?.body ?? '');
  run(
    `INSERT INTO notes (lesson_id, body, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(lesson_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    [lessonId, body]
  );
  res.json({ ok: true, saved: true });
});

export default router;
