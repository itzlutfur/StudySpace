import express from 'express';

import { listCourses } from '../lib/courses.js';
import { getSetting, setSetting } from '../lib/settings.js';
import { shouldOfferResume, formatTime } from '../lib/progress.js';

const router = express.Router();

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
      lessonCount: c.lessons.length,
    })),
    continueItem,
    sort: getSetting('sort', 'recent'),
    theme: getSetting('theme', 'dark'),
  });
});

/** POST /api/settings/theme — persist the theme choice. */
router.post('/theme', (req, res) => {
  const theme = req.body?.theme === 'light' ? 'light' : 'dark';
  setSetting('theme', theme);
  res.json({ ok: true, theme });
});

/** POST /api/settings/sort — persist the library sort order. */
router.post('/sort', (req, res) => {
  const requested = String(req.body?.sort ?? '');
  const sort = ['recent', 'name', 'progress'].includes(requested) ? requested : 'recent';
  setSetting('sort', sort);
  res.json({ ok: true, sort });
});

export default router;
