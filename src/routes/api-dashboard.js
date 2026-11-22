import express from 'express';

import { listCourses } from '../lib/courses.js';
import { getSetting, setSetting } from '../lib/settings.js';
import { shouldOfferResume, formatTime, isComplete } from '../lib/progress.js';
import { all } from '../db/index.js';
import config from '../config.js';

const router = express.Router();

/**
 * Aggregate library statistics for the dashboard stat tiles.
 *
 * Counts come from the courses already loaded, so no extra query is needed.
 * Durations are only known where the container carried a readable duration,
 * so the total is a lower bound — which is why the UI renders it as a
 * best-effort figure rather than an exact one.
 */
function libraryStats(courses) {
  let totalLessons = 0;
  let totalVideos = 0;
  let completedLessons = 0;
  let totalDurationSec = 0;

  for (const course of courses) {
    totalLessons += course.lessons.length;
    completedLessons += course.stats.completed;

    for (const lesson of course.lessons) {
      if (lesson.type === 'video') totalVideos += 1;
      const duration = Number(lesson.duration_sec) || 0;
      if (duration > 0) totalDurationSec += duration;
    }
  }

  return {
    totalCourses: courses.length,
    totalLessons,
    totalVideos,
    completedLessons,
    totalDurationSec: Math.round(totalDurationSec),
  };
}

/**
 * The most recently played lessons across every course.
 *
 * Progress rows carry `last_played`; lessons without one have never been
 * opened and are not interesting here.
 */
function recentLessons(limit = 8) {
  return all(
    `SELECT p.lesson_id, p.last_played, p.position_sec, p.completed, p.watched_pct,
            l.title, l.type, l.course_id, c.title AS course_title
       FROM progress p
       JOIN lessons l ON l.id = p.lesson_id
       JOIN courses c ON c.id = l.course_id
      WHERE p.last_played IS NOT NULL
      ORDER BY p.last_played DESC
      LIMIT ?`,
    [limit]
  ).map((row) => ({
    lessonId: row.lesson_id,
    title: row.title,
    type: row.type,
    courseId: row.course_id,
    courseTitle: row.course_title,
    lastPlayed: row.last_played,
    positionSec: Number(row.position_sec) || 0,
    completed: isComplete(row),
  }));
}

/** GET /api/dashboard — the library, the continue-watching card and preferences. */
router.get('/', (req, res) => {
  const courses = listCourses();

  // The "continue watching" card: the most recently opened course that has an
  // unfinished lesson.
  let continueItem = null;
  for (const course of courses) {
    if (!course.resumeLessonId) continue;
    const lesson = course.lessons.find((l) => l.id === course.resumeLessonId);
    if (!lesson) continue;
    const progress = course.progressByLessonId.get(lesson.id);
    if (!shouldOfferResume(progress ?? {})) continue;
    continueItem = {
      course: {
        id: course.id,
        title: course.title,
        rootPath: course.root_path,
      },
      lesson: {
        id: lesson.id,
        title: lesson.title,
        section: lesson.section ?? '',
        type: lesson.type,
        durationSec: Number(lesson.duration_sec) || 0,
      },
      progress,
      resumeAt: formatTime(progress.position_sec),
    };
    break;
  }

  res.json({
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      rootPath: c.root_path,
      createdAt: c.created_at,
      lastOpenedAt: c.last_opened_at,
      stats: c.stats,
      resumeLessonId: c.resumeLessonId,
      firstLessonId: c.lessons[0]?.id ?? null,
      lessonCount: c.lessons.length,
      totalDurationSec: c.lessons.reduce((sum, l) => sum + (Number(l.duration_sec) || 0), 0),
    })),
    continueItem,
    stats: libraryStats(courses),
    recent: recentLessons(),
    library: {
      dataDir: config.appDataDir(),
      courseCount: courses.length,
    },
    sort: getSetting('sort', 'recent'),
    theme: getSetting('theme', 'dark'),
    playbackSpeed: getSetting('playbackSpeed', '1'),
  });
});

/** POST /api/dashboard/theme — persist the theme choice. */
router.post('/theme', (req, res) => {
  const theme = req.body?.theme === 'light' ? 'light' : 'dark';
  setSetting('theme', theme);
  res.json({ ok: true, theme });
});

/** POST /api/dashboard/sort — persist the library sort order. */
router.post('/sort', (req, res) => {
  const requested = String(req.body?.sort ?? '');
  const sort = ['recent', 'name', 'progress'].includes(requested) ? requested : 'recent';
  setSetting('sort', sort);
  res.json({ ok: true, sort });
});

/** POST /api/dashboard/playback-speed — persist the default playback speed. */
router.post('/playback-speed', (req, res) => {
  const requested = Number(req.body?.speed);
  const speed = [1, 1.25, 1.5, 2].includes(requested) ? requested : 1;
  setSetting('playbackSpeed', String(speed));
  res.json({ ok: true, speed });
});

export default router;
