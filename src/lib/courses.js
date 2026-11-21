import { all, get, run, transaction } from '../db/index.js';
import { courseStats, findResumeLesson, isComplete } from './progress.js';

/** Load every course with its lessons and progress, plus computed stats. */
export function listCourses() {
  const courses = all('SELECT * FROM courses ORDER BY COALESCE(last_opened_at, created_at) DESC');
  return courses.map((course) => hydrate(course));
}

export function getCourse(id) {
  const course = get('SELECT * FROM courses WHERE id = ?', [id]);
  if (!course) return null;
  return hydrate(course);
}

export function getLesson(lessonId) {
  return get('SELECT * FROM lessons WHERE id = ?', [lessonId]);
}

export function getLessonWithCourse(lessonId) {
  return get(
    `SELECT l.*, c.title AS course_title, c.root_path AS course_root, c.id AS course_id
       FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE l.id = ?`,
    [lessonId]
  );
}

/** Attach lessons + progress + stats to a course row. */
function hydrate(course) {
  const lessons = all(
    'SELECT * FROM lessons WHERE course_id = ? ORDER BY position ASC, id ASC',
    [course.id]
  );
  const progressByLessonId = loadProgress(lessons.map((l) => l.id));

  const stats = courseStats(lessons, progressByLessonId);
  const resumeLesson = findResumeLesson(lessons, progressByLessonId);

  return {
    ...course,
    lessons,
    progressByLessonId,
    stats,
    resumeLessonId: resumeLesson?.id ?? null,
  };
}

/** Fetch progress rows for the given lessons, keyed by lesson id. */
export function loadProgress(lessonIds) {
  const map = new Map();
  if (!lessonIds.length) return map;
  const placeholders = lessonIds.map(() => '?').join(',');
  const rows = all(
    `SELECT * FROM progress WHERE lesson_id IN (${placeholders})`,
    lessonIds
  );
  for (const row of rows) map.set(row.lesson_id, row);
  return map;
}

/** Create a course and its lessons from a reviewed scan. */
export function createCourse({ title, rootPath, lessons }) {
  return transaction(() => {
    const res = run(
      'INSERT INTO courses (title, root_path) VALUES (?, ?)',
      [title, rootPath]
    );
    const courseId = res.lastInsertRowid;

    let position = 0;
    for (const lesson of lessons) {
      run(
        `INSERT INTO lessons (course_id, rel_path, abs_path, title, section, type, position, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          lesson.relPath,
          lesson.absPath,
          lesson.title,
          lesson.section ?? '',
          lesson.type,
          position++,
          lesson.sizeBytes ?? null,
        ]
      );
    }
    return courseId;
  });
}

/**
 * Reconcile a course's lessons against a fresh scan.
 * Existing lessons keep their progress (keyed by rel_path). Removed files are
 * marked missing rather than deleted. New files are inserted.
 */
export function reconcileCourse(courseId, scannedLessons) {
  return transaction(() => {
    const existing = all('SELECT * FROM lessons WHERE course_id = ?', [courseId]);
    const existingByRel = new Map(existing.map((l) => [l.rel_path, l]));
    const scannedByRel = new Map(scannedLessons.map((l) => [l.relPath, l]));

    const added = [];
    const changed = [];
    const missing = [];

    // Mark lessons whose files are gone as missing; clear the flag for those found.
    for (const lesson of existing) {
      const found = scannedByRel.get(lesson.rel_path);
      if (!found) {
        if (!lesson.missing) {
          run('UPDATE lessons SET missing = 1 WHERE id = ?', [lesson.id]);
          missing.push(lesson.rel_path);
        }
      } else {
        if (lesson.missing) {
          run('UPDATE lessons SET missing = 0 WHERE id = ?', [lesson.id]);
          changed.push(lesson.rel_path);
        }
        // Refresh mutable metadata (title/section/size) in case the file changed.
        run(
          'UPDATE lessons SET title = ?, section = ?, size_bytes = ?, abs_path = ? WHERE id = ?',
          [found.title, found.section ?? '', found.sizeBytes ?? null, found.absPath, lesson.id]
        );
      }
    }

    // Insert newly detected files.
    let position = existing.length;
    for (const scanned of scannedLessons) {
      if (existingByRel.has(scanned.relPath)) continue;
      run(
        `INSERT INTO lessons (course_id, rel_path, abs_path, title, section, type, position, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          scanned.relPath,
          scanned.absPath,
          scanned.title,
          scanned.section ?? '',
          scanned.type,
          position++,
          scanned.sizeBytes ?? null,
        ]
      );
      added.push(scanned.relPath);
    }

    return { added, changed, missing };
  });
}

/** Delete a course and everything hanging off it. Returns a snapshot for undo. */
export function deleteCourse(courseId) {
  const course = get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) return null;

  const lessons = all('SELECT * FROM lessons WHERE course_id = ?', [courseId]);
  const lessonIds = lessons.map((l) => l.id);

  const snapshot = {
    course,
    lessons,
    progress: lessonIds.length ? all(`SELECT * FROM progress WHERE lesson_id IN (${lessonIds.map(() => '?').join(',')})`, lessonIds) : [],
    bookmarks: lessonIds.length ? all(`SELECT * FROM bookmarks WHERE lesson_id IN (${lessonIds.map(() => '?').join(',')})`, lessonIds) : [],
    notes: lessonIds.length ? all(`SELECT * FROM notes WHERE lesson_id IN (${lessonIds.map(() => '?').join(',')})`, lessonIds) : [],
  };

  run('DELETE FROM courses WHERE id = ?', [courseId]);

  return snapshot;
}

/** Re-insert a previously deleted course (undo). */
export function restoreCourse(snapshot) {
  return transaction(() => {
    const res = run(
      'INSERT INTO courses (id, title, root_path, created_at, updated_at, last_opened_at, archived) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        snapshot.course.id,
        snapshot.course.title,
        snapshot.course.root_path,
        snapshot.course.created_at,
        snapshot.course.updated_at,
        snapshot.course.last_opened_at,
        snapshot.course.archived ?? 0,
      ]
    );
    const courseId = res.lastInsertRowid;

    const idMap = new Map();
    for (const lesson of snapshot.lessons) {
      const ins = run(
        `INSERT INTO lessons (id, course_id, rel_path, abs_path, title, section, type, position, size_bytes, missing)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lesson.id,
          courseId,
          lesson.rel_path,
          lesson.abs_path,
          lesson.title,
          lesson.section,
          lesson.type,
          lesson.position,
          lesson.size_bytes,
          lesson.missing,
        ]
      );
      idMap.set(lesson.id, ins.lastInsertRowid);
    }

    for (const p of snapshot.progress) {
      run(
        `INSERT INTO progress (lesson_id, position_sec, duration_sec, completed, watched_pct, last_played, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idMap.get(p.lesson_id) ?? p.lesson_id,
          p.position_sec,
          p.duration_sec,
          p.completed,
          p.watched_pct,
          p.last_played,
          p.updated_at,
        ]
      );
    }
    for (const b of snapshot.bookmarks) {
      run(
        'INSERT INTO bookmarks (id, lesson_id, timestamp, label, created_at) VALUES (?, ?, ?, ?, ?)',
        [b.id, idMap.get(b.lesson_id) ?? b.lesson_id, b.timestamp, b.label, b.created_at]
      );
    }
    for (const n of snapshot.notes) {
      run(
        'INSERT INTO notes (lesson_id, body, updated_at) VALUES (?, ?, ?)',
        [idMap.get(n.lesson_id) ?? n.lesson_id, n.body, n.updated_at]
      );
    }

    return courseId;
  });
}

/** Mark a course as opened (for "continue watching" ordering). */
export function touchCourse(courseId) {
  run("UPDATE courses SET last_opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [courseId]);
}

export function renameCourse(courseId, title) {
  run("UPDATE courses SET title = ?, updated_at = datetime('now') WHERE id = ?", [title, courseId]);
}

export default {
  listCourses,
  getCourse,
  getLesson,
  getLessonWithCourse,
  loadProgress,
  createCourse,
  reconcileCourse,
  deleteCourse,
  restoreCourse,
  touchCourse,
  renameCourse,
};
