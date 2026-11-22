import express from 'express';
import fsp from 'node:fs/promises';

import { getCourse, getLessonWithCourse, touchCourse } from '../lib/courses.js';
import { shouldOfferResume, formatTime } from '../lib/progress.js';
import { get } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/lessons/:lessonId — everything the player screen needs.
 */
router.get('/:lessonId', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLessonWithCourse(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const course = getCourse(lesson.course_id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  touchCourse(course.id);

  const index = course.lessons.findIndex((l) => l.id === lessonId);
  const prev = index > 0 ? course.lessons[index - 1] : null;
  const next = index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1] : null;

  const progressRow = get('SELECT * FROM progress WHERE lesson_id = ?', [lessonId]) ?? null;
  const noteRow = get('SELECT body FROM notes WHERE lesson_id = ?', [lessonId]) ?? null;
  const bookmarks = get('SELECT COUNT(*) AS n FROM bookmarks WHERE lesson_id = ?', [lessonId])?.n ?? 0;

  // The duration is only known when the container carried a readable one.
  // 0 means unknown — the UI shows an em dash rather than guessing.
  const durationSec = Number(lesson.duration_sec) || 0;

  // Does the file still exist on disk?
  let exists = true;
  try {
    await fsp.access(lesson.abs_path);
  } catch {
    exists = false;
  }

  const grouped = [];
  for (const l of course.lessons) {
    const key = l.section ?? '';
    let group = grouped.find((g) => g.name === key);
    if (!group) {
      group = { name: key, lessons: [] };
      grouped.push(group);
    }
    group.lessons.push(l);
  }

  res.json({
    lesson,
    durationSec,
    course: {
      id: course.id,
      title: course.title,
      rootPath: course.root_path,
      stats: course.stats,
      lessonCount: course.lessons.length,
      resumeLessonId: course.resumeLessonId,
      totalDurationSec: course.lessons.reduce((sum, l) => sum + (Number(l.duration_sec) || 0), 0),
    },
    grouped,
    prev,
    next,
    index,
    total: course.lessons.length,
    progress: progressRow,
    notesBody: noteRow?.body ?? '',
    bookmarkCount: bookmarks,
    exists,
    offerResume: shouldOfferResume(progressRow ?? {}),
    resumeAt: formatTime(progressRow?.position_sec ?? 0),
  });
});

export default router;
