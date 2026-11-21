import express from 'express';

import { listCourses, getCourse, touchCourse } from '../lib/courses.js';
import { getSetting, setSetting } from '../lib/settings.js';
import { shouldOfferResume, formatTime } from '../lib/progress.js';

const router = express.Router();

/** GET / — the course dashboard. */
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
      course,
      lesson,
      progress,
      resumeAt: formatTime(progress.position_sec),
    };
    break;
  }

  const theme = getSetting('theme', 'dark');

  res.render('dashboard', {
    title: 'CourseStream',
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      rootPath: c.root_path,
      stats: c.stats,
      lastOpenedAt: c.last_opened_at,
      resumeLessonId: c.resumeLessonId,
      lessonCount: c.lessons.length,
    })),
    continueItem,
    theme,
    sort: getSetting('sort', 'recent'),
  });
});

/** POST /api/settings/theme — persist the theme choice. */
router.post('/api/settings/theme', express.json(), (req, res) => {
  const theme = req.body?.theme === 'light' ? 'light' : 'dark';
  setSetting('theme', theme);
  res.json({ ok: true, theme });
});

export default router;
