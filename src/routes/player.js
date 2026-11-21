import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { getLessonWithCourse } from '../lib/courses.js';
import { isInside } from '../lib/paths.js';
import { mimeFor, parseRange, classify } from '../lib/media.js';
import { get } from '../db/index.js';

const router = express.Router();

/**
 * GET /player/:lessonId/stream — serve the media file with Range support.
 *
 * Security: the client only ever supplies a lesson id. The absolute path is
 * resolved from the database and then verified to live inside the course
 * root, so a tampered row or a crafted id cannot escape the course folder.
 */
router.get('/:lessonId/stream', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLessonWithCourse(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const course = get('SELECT root_path FROM courses WHERE id = ?', [lesson.course_id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const absPath = path.resolve(lesson.abs_path);
  if (!isInside(course.root_path, absPath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let stat;
  try {
    stat = await fsp.stat(absPath);
  } catch {
    return res.status(404).json({ error: 'File is missing on disk' });
  }
  if (!stat.isFile()) return res.status(404).json({ error: 'Not a file' });

  const size = stat.size;
  const mime = mimeFor(absPath);
  const range = parseRange(req.headers.range, size);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=0');

  if (range?.invalid) {
    res.status(416);
    res.setHeader('Content-Range', `bytes */${size}`);
    return res.end();
  }

  if (!range) {
    res.setHeader('Content-Length', size);
    if (req.method === 'HEAD') return res.end();
    return pipeline(fs.createReadStream(absPath), res);
  }

  const { start, end } = range;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  res.setHeader('Content-Length', end - start + 1);
  if (req.method === 'HEAD') return res.end();
  return pipeline(fs.createReadStream(absPath, { start, end }), res);
});

/**
 * GET /player/:lessonId/document — serve a document/text lesson inline.
 */
router.get('/:lessonId/document', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const lesson = getLessonWithCourse(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const course = get('SELECT root_path FROM courses WHERE id = ?', [lesson.course_id]);
  const absPath = path.resolve(lesson.abs_path);
  if (!course || !isInside(course.root_path, absPath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const type = classify(absPath);
  if (type !== 'document' && type !== 'text') {
    return res.status(400).json({ error: 'Not a document' });
  }

  try {
    const data = await fsp.readFile(absPath);
    res.setHeader('Content-Type', mimeFor(absPath));
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.send(data);
  } catch {
    res.status(404).json({ error: 'File is missing on disk' });
  }
});

export default router;
