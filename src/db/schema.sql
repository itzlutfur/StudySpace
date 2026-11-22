-- StudySpace schema
-- Lessons are keyed by their path RELATIVE to the course root so that moving
-- or renaming the course folder on disk does not destroy progress.

CREATE TABLE IF NOT EXISTS courses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT    NOT NULL,
  root_path      TEXT    NOT NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  archived       INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_root ON courses(root_path);

CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rel_path   TEXT    NOT NULL,
  abs_path   TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  section    TEXT    NOT NULL DEFAULT '',
  type       TEXT    NOT NULL,
  position   INTEGER NOT NULL,
  size_bytes INTEGER,
  -- Media duration in seconds, when it could be read from the container.
  -- 0 means "unknown" — the UI renders an em dash rather than a guess.
  duration_sec REAL  NOT NULL DEFAULT 0,
  missing    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (course_id, rel_path)
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, position);

CREATE TABLE IF NOT EXISTS progress (
  lesson_id    INTEGER PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  position_sec REAL    NOT NULL DEFAULT 0,
  duration_sec REAL    NOT NULL DEFAULT 0,
  completed    INTEGER NOT NULL DEFAULT 0,
  watched_pct  REAL    NOT NULL DEFAULT 0,
  last_played  TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  timestamp  REAL    NOT NULL,
  label      TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_lesson ON bookmarks(lesson_id, timestamp);

CREATE TABLE IF NOT EXISTS notes (
  lesson_id  INTEGER PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  body       TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
