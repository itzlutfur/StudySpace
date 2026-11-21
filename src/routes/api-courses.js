import express from 'express';
import fs from 'node:fs/promises';

import { scanFolder, listSubfolders } from '../lib/scanner.js';
import { normalizeInputPath, resolvePath } from '../lib/paths.js';
import {
  listCourses,
  getCourse,
  createCourse,
  deleteCourse,
  restoreCourse,
  reconcileCourse,
  renameCourse,
  touchCourse,
} from '../lib/courses.js';
import { get } from '../db/index.js';

const router = express.Router();

/** Shape a scan result for JSON transport. */
function scanPayload(scan) {
  return {
    root: scan.root,
    title: scan.title,
    counts: scan.counts,
    total: scan.lessons.length,
    sections: scan.sections,
    overview: scan.overview,
    warnings: scan.warnings,
    lessons: scan.lessons.map((l) => ({
      relPath: l.relPath,
      title: l.title,
      section: l.section,
      type: l.type,
      sizeBytes: l.sizeBytes,
      warn: l.warn,
    })),
  };
}

/**
 * POST /api/courses/scan  { path }
 * Scans a folder and returns the detected lessons for review.
 */
router.post('/scan', async (req, res) => {
  const raw = req.body?.path;
  const target = resolvePath(normalizeInputPath(String(raw ?? '')));

  if (!target) {
    return res.status(400).json({ error: 'Please enter a folder path.' });
  }

  try {
    const stat = await fs.stat(target);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'That path is a file, not a folder.' });
    }
  } catch (err) {
    return res.status(400).json({
      error: 'Could not open that folder',
      detail: err.code === 'ENOENT' ? 'The folder does not exist (or the drive is disconnected).' : err.message,
    });
  }

  try {
    const scan = await scanFolder(target);
    const subfolders = await listSubfolders(target);
    res.json({ ...scanPayload(scan), subfolders });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', detail: err.message });
  }
});

/**
 * POST /api/courses  { title, path, lessons: [{relPath}, ...] }
 * Creates a course from a reviewed scan.
 */
router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const target = resolvePath(normalizeInputPath(String(body.path ?? '')));
  const title = String(body.title ?? '').trim();

  if (!target) return res.status(400).json({ error: 'Missing folder path.' });
  if (!title) return res.status(400).json({ error: 'Missing course title.' });

  const existing = get('SELECT id, title FROM courses WHERE root_path = ?', [target]);
  if (existing) {
    return res.status(409).json({
      error: 'This course is already in your library.',
      existingId: existing.id,
      existingTitle: existing.title,
    });
  }

  const requested = Array.isArray(body.lessons) ? body.lessons : [];

  // Re-scan and intersect with the user's selection, so a stale review page
  // can never insert a lesson that no longer exists on disk.
  let scan;
  try {
    scan = await scanFolder(target);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read that folder', detail: err.message });
  }

  const byRel = new Map(scan.lessons.map((l) => [l.relPath, l]));
  // Accept either a list of relative path strings or a list of lesson objects.
  const requestedPaths = requested.map((l) =>
    typeof l === 'string' ? l : l?.relPath
  );
  const selected = requestedPaths.length
    ? requestedPaths.map((rel) => byRel.get(rel)).filter(Boolean)
    : scan.lessons;

  if (!selected.length) {
    return res.status(400).json({ error: 'No lessons selected — nothing to add.' });
  }

  try {
    const courseId = createCourse({
      title,
      rootPath: target,
      lessons: selected.map((l) => ({
        relPath: l.relPath,
        absPath: l.absPath,
        title: l.title,
        section: l.section,
        type: l.type,
        sizeBytes: l.sizeBytes,
      })),
    });

    const course = getCourse(courseId);
    res.status(201).json({
      ok: true,
      course: {
        id: course.id,
        title: course.title,
        rootPath: course.root_path,
        lessonCount: course.lessons.length,
        percent: course.stats.percent,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not save the course', detail: err.message });
  }
});

/** GET /api/courses — the whole library with progress. */
router.get('/', (req, res) => {
  const courses = listCourses().map((c) => ({
    id: c.id,
    title: c.title,
    rootPath: c.root_path,
    createdAt: c.created_at,
    lastOpenedAt: c.last_opened_at,
    stats: c.stats,
    resumeLessonId: c.resumeLessonId,
    lessonCount: c.lessons.length,
  }));
  res.json({ courses });
});

/**
 * GET /api/courses/:id — one course with its lessons, grouped by section,
 * each lesson carrying its progress row.
 */
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const course = getCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  touchCourse(course.id);

  const grouped = [];
  for (const lesson of course.lessons) {
    const key = lesson.section ?? '';
    let group = grouped.find((g) => g.name === key);
    if (!group) {
      group = { name: key, lessons: [] };
      grouped.push(group);
    }
    group.lessons.push({
      ...lesson,
      progress: course.progressByLessonId.get(lesson.id) ?? null,
    });
  }

  res.json({
    course: {
      id: course.id,
      title: course.title,
      rootPath: course.root_path,
      createdAt: course.created_at,
      lastOpenedAt: course.last_opened_at,
      stats: course.stats,
      resumeLessonId: course.resumeLessonId,
      lessonCount: course.lessons.length,
    },
    grouped,
  });
});

/** DELETE /api/courses/:id — remove a course. Returns a snapshot for undo. */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const snapshot = deleteCourse(id);
  if (!snapshot) return res.status(404).json({ error: 'Course not found' });
  res.json({ ok: true, snapshot });
});

/** POST /api/courses/restore — undo a removal. */
router.post('/restore', (req, res) => {
  const snapshot = req.body?.snapshot;
  if (!snapshot?.course?.id) return res.status(400).json({ error: 'Nothing to restore.' });
  try {
    const id = restoreCourse(snapshot);
    res.json({ ok: true, courseId: id });
  } catch (err) {
    res.status(500).json({ error: 'Could not restore the course', detail: err.message });
  }
});

/** POST /api/courses/:id/rescan — re-detect lessons for an existing course. */
router.post('/:id/rescan', async (req, res) => {
  const id = Number(req.params.id);
  const course = getCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  try {
    await fs.access(course.root_path);
  } catch {
    return res.status(400).json({
      error: 'The course folder is missing or its drive is disconnected.',
      rootPath: course.root_path,
    });
  }

  try {
    const scan = await scanFolder(course.root_path);
    const result = reconcileCourse(id, scan.lessons);
    const updated = getCourse(id);
    res.json({
      ok: true,
      ...result,
      lessonCount: updated.lessons.length,
      percent: updated.stats.percent,
    });
  } catch (err) {
    res.status(500).json({ error: 'Rescan failed', detail: err.message });
  }
});

/** PATCH /api/courses/:id — rename. */
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Title cannot be empty.' });
  const course = getCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  renameCourse(id, title);
  res.json({ ok: true, title });
});

export default router;
