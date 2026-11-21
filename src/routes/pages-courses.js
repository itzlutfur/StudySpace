import express from 'express';

import { getCourse, touchCourse } from '../lib/courses.js';
import { getSetting } from '../lib/settings.js';

const router = express.Router();

/** GET /courses/add — the add-course flow. */
router.get('/add', (req, res) => {
  res.render('add-course', {
    title: 'Add a course',
    initialPath: String(req.query.path ?? ''),
    theme: getSetting('theme', 'dark'),
  });
});

/** GET /courses/:id — course detail with the lesson list. */
router.get('/:id', (req, res) => {
  const course = getCourse(Number(req.params.id));
  if (!course) {
    return res.status(404).render('error', {
      title: 'Course not found',
      message: 'That course is not in your library.',
      theme: getSetting('theme', 'dark'),
    });
  }
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

  res.render('course', {
    title: course.title,
    course,
    grouped,
    theme: getSetting('theme', 'dark'),
  });
});

export default router;
