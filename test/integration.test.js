import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the database at a throwaway directory before the app modules load.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coursestream-test-'));
process.env.COURSESTREAM_DATA_DIR = dataDir;

const { initDb, closeDb, get, all, run } = await import('../src/db/index.js');
const { createCourse, getCourse, deleteCourse, restoreCourse, renameCourse } = await import(
  '../src/lib/courses.js'
);

before(async () => {
  await initDb();
});

after(() => {
  closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** A tiny course with two lessons. Each course needs its own root path. */
let courseCounter = 0;
function makeCourse(title = 'Test Course') {
  const root = path.join(dataDir, `course-root-${courseCounter++}`);
  return createCourse({
    title,
    rootPath: root,
    lessons: [
      { relPath: '01 - Intro.mp4', absPath: path.join(root, '01 - Intro.mp4'), title: 'Intro', section: '', type: 'video', sizeBytes: 100 },
      { relPath: '02 - Next.mp4', absPath: path.join(root, '02 - Next.mp4'), title: 'Next', section: '', type: 'video', sizeBytes: 200 },
    ],
  });
}

test('a created course round-trips with its lessons and stats', () => {
  const id = makeCourse('Round Trip');
  const course = getCourse(id);

  assert.equal(course.title, 'Round Trip');
  assert.equal(course.lessons.length, 2);
  assert.equal(course.stats.total, 2);
  assert.equal(course.stats.counted, 2);
  assert.equal(course.stats.percent, 0);
  assert.equal(course.resumeLessonId, null);
});

test('saving progress updates the course statistics', () => {
  const id = makeCourse('With Progress');
  const course = getCourse(id);
  const lessonId = course.lessons[0].id;

  get('SELECT * FROM progress WHERE lesson_id = ?', [lessonId]);
  all('SELECT * FROM lessons WHERE course_id = ?', [id]);

  // Insert progress the way the progress route does.
  run(
    `INSERT INTO progress (lesson_id, position_sec, duration_sec, completed, watched_pct, last_played)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [lessonId, 42, 100, 1, 1]
  );

  const updated = getCourse(id);
  assert.equal(updated.stats.completed, 1);
  assert.equal(updated.stats.percent, 50);
  assert.equal(updated.stats.averagePercent, 50);
  // The completed lesson is no longer offered as a resume candidate.
  assert.equal(updated.resumeLessonId, null);
});

test('a course can be renamed', () => {
  const id = makeCourse('Before');
  renameCourse(id, 'After');
  assert.equal(getCourse(id).title, 'After');
});

test('deleting a course returns a snapshot that restores it', () => {
  const id = makeCourse('Deletable');
  const before = getCourse(id);
  const lessonId = before.lessons[0].id;

  run('INSERT INTO progress (lesson_id, position_sec, duration_sec, watched_pct) VALUES (?, ?, ?, ?)', [
    lessonId, 10, 100, 0.1,
  ]);

  const snapshot = deleteCourse(id);
  assert.ok(snapshot);
  assert.equal(snapshot.course.id, id);
  assert.equal(snapshot.lessons.length, 2);
  assert.equal(snapshot.progress.length, 1);
  assert.equal(getCourse(id), null);

  const restoredId = restoreCourse(snapshot);
  assert.equal(restoredId, id);
  const restored = getCourse(id);
  assert.equal(restored.title, 'Deletable');
  assert.equal(restored.lessons.length, 2);
  // Progress survives the round trip. The average is over both counted
  // lessons: (10 + 0) / 2 = 5%.
  assert.equal(restored.stats.averagePercent, 5);
});

test('deleting an unknown course returns null', () => {
  assert.equal(deleteCourse(999999), null);
});
