import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { fetchDashboard, renameCourse, rescanCourse, deleteCourse, restoreCourse, saveSort } from '../api/courses.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { formatDate } from '../utils/format.js';

const SORT_KEY = 'coursestream.sort';
const SORTS = [
  { value: 'recent', label: 'Recently opened' },
  { value: 'name', label: 'Name' },
  { value: 'progress', label: 'Progress' },
];

/** Read the persisted sort order, falling back to the server's preference. */
function readSort(serverSort) {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    if (SORTS.some((s) => s.value === stored)) return stored;
  } catch {
    // Storage may be unavailable — fall through to the server value.
  }
  return serverSort || 'recent';
}

export default function Dashboard() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(() => readSort(null));
  const [openMenu, setOpenMenu] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      setError(null);
      setSort((current) => (current === 'recent' && result.sort ? result.sort : current));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close any open card menu when clicking elsewhere.
  useEffect(() => {
    if (openMenu === null) return;
    const onClick = (e) => {
      if (!e.target.closest('[data-menu-toggle]')) setOpenMenu(null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openMenu]);

  const courses = data?.courses ?? [];

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? courses.filter((c) => c.title.toLowerCase().includes(term))
      : [...courses];

    const sorted = filtered.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title);
      if (sort === 'progress') return (b.stats?.percent ?? 0) - (a.stats?.percent ?? 0);
      return String(b.lastOpenedAt || '').localeCompare(String(a.lastOpenedAt || ''));
    });
    return sorted;
  }, [courses, query, sort]);

  const changeSort = (value) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      // Ignore storage failures — the setting is also saved server-side.
    }
    saveSort(value).catch(() => {});
  };

  const onRename = async (course) => {
    const title = window.prompt('Course title:', course.title);
    if (title === null) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === course.title) return;
    try {
      await renameCourse(course.id, trimmed);
      toast('Course renamed');
      await load();
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  const onRescan = async (course) => {
    try {
      const result = await rescanCourse(course.id);
      const added = result.added?.length ?? 0;
      const missing = result.missing?.length ?? 0;
      const changed = result.changed?.length ?? 0;
      toast(`Rescan complete — ${added} added, ${missing} missing${changed ? `, ${changed} restored` : ''}`);
      await load();
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  const onRemove = async (course) => {
    const ok = await confirm({
      title: 'Remove course?',
      message: `Remove "${course.title}" from your library?`,
      detail: 'This deletes its progress, bookmarks and notes. The files on disk are not touched.',
      confirmLabel: 'Remove course',
      danger: true,
    });
    if (!ok) return;

    try {
      const result = await deleteCourse(course.id);
      toast(`Removed "${course.title}"`, {
        timeout: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await restoreCourse(result.snapshot);
              toast('Course restored');
              await load();
            } catch (err) {
              toast(err.message, { type: 'error', timeout: 7000 });
            }
          },
        },
      });
      await load();
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  const continueItem = data?.continueItem;

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠</div>
        <h3>Could not load your library</h3>
        <p className="muted">{error}</p>
        <button type="button" className="btn btn-primary" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {continueItem ? (
        <section className="continue-card">
          <div className="continue-main">
            <div className="continue-badge">Continue watching</div>
            <h3>{continueItem.lesson.title}</h3>
            <p className="muted small">
              {continueItem.course.title}
              {continueItem.lesson.section ? ` · ${continueItem.lesson.section}` : ''}
            </p>
            <div className="progress-line">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round((continueItem.progress?.watched_pct ?? 0) * 100)}%` }}
                />
              </div>
              <span className="muted small">Resume at {continueItem.resumeAt}</span>
            </div>
          </div>
          <Link className="btn btn-primary" to={`/player/${continueItem.lesson.id}?resume=1`}>
            Resume
          </Link>
        </section>
      ) : null}

      <div className="library-head">
        <h1>
          Your library <span className="count-pill">{courses.length}</span>
        </h1>
        <div className="library-tools">
          <input
            id="course-search"
            className="input"
            type="search"
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            id="course-sort"
            className="input"
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data ? (
        <p className="muted">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No courses yet</h3>
          <p className="muted">Point CourseStream at a folder of videos to get started.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/courses/add')}
          >
            + Add Course
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="no-match">
          <p className="muted">No courses match “{query}”.</p>
        </div>
      ) : (
        <div className="course-grid" id="course-grid">
          {visible.map((course) => (
            <article className="course-card" key={course.id}>
              <Link className="course-open" to={`/courses/${course.id}`}>
                <h3>{course.title}</h3>
                <ProgressBar percent={course.stats?.percent ?? 0} style={{ marginTop: '.5rem' }} />
                <div className="course-meta">
                  <span className="muted small">
                    {course.stats?.completed ?? 0}/{course.stats?.counted ?? 0} lessons
                  </span>
                  <span className="muted small">{course.stats?.percent ?? 0}%</span>
                </div>
                <div className="course-meta">
                  <span className="muted small">{course.lessonCount} lessons</span>
                  <span className="muted small">{formatDate(course.lastOpenedAt)}</span>
                </div>
              </Link>

              <div className="course-actions">
                {course.resumeLessonId ? (
                  <Link className="btn btn-sm" to={`/player/${course.resumeLessonId}?resume=1`}>
                    Resume
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-sm"
                  data-menu-toggle={course.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenu((cur) => (cur === course.id ? null : course.id));
                  }}
                >
                  ⋯
                </button>
                <div className="menu" data-menu={course.id} hidden={openMenu !== course.id}>
                  <button type="button" data-action="rename" data-id={course.id} onClick={() => onRename(course)}>
                    Rename
                  </button>
                  <button type="button" data-action="rescan" data-id={course.id} onClick={() => onRescan(course)}>
                    Rescan folder
                  </button>
                  <hr />
                  <button
                    type="button"
                    className="danger"
                    data-action="remove"
                    data-id={course.id}
                    onClick={() => onRemove(course)}
                  >
                    Remove course
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
