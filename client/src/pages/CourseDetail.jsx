import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { fetchCourse, rescanCourse, deleteCourse, restoreCourse } from '../api/courses.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { formatTime } from '../utils/format.js';

export default function CourseDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchCourse(id);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRescan = async () => {
    setScanning(true);
    try {
      const result = await rescanCourse(id);
      const added = result.added?.length ?? 0;
      const missing = result.missing?.length ?? 0;
      const changed = result.changed?.length ?? 0;
      toast(`Rescan complete — ${added} added, ${missing} missing${changed ? `, ${changed} restored` : ''}`);
      await load();
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    } finally {
      setScanning(false);
    }
  };

  const onRemove = async () => {
    const ok = await confirm({
      title: 'Remove course?',
      message: `Remove "${data.course.title}" from your library?`,
      detail: 'This deletes its progress, bookmarks and notes. The files on disk are not touched.',
      confirmLabel: 'Remove course',
      danger: true,
    });
    if (!ok) return;

    try {
      const result = await deleteCourse(id);
      toast(`Removed "${data.course.title}"`, {
        timeout: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await restoreCourse(result.snapshot);
              toast('Course restored');
              navigate('/');
            } catch (err) {
              toast(err.message, { type: 'error', timeout: 7000 });
            }
          },
        },
      });
      navigate('/');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠</div>
        <h3>Course not found</h3>
        <p className="muted">{error}</p>
        <Link to="/" className="btn btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  if (!data) return <p className="muted">Loading…</p>;

  const { course, grouped } = data;
  const stats = course.stats ?? {};

  return (
    <>
      <div className="crumbs">
        <Link to="/">Library</Link>
        <span>/</span>
        <span>{course.title}</span>
      </div>

      <div className="course-header">
        <div>
          <h1>{course.title}</h1>
          <div className="path">{course.rootPath}</div>
        </div>
        <div className="course-header-actions">
          {course.resumeLessonId ? (
            <Link className="btn btn-primary" to={`/player/${course.resumeLessonId}?resume=1`}>
              Resume
            </Link>
          ) : null}
          <button
            type="button"
            className="btn"
            id="rescan-btn"
            disabled={scanning}
            onClick={onRescan}
          >
            {scanning ? 'Scanning…' : 'Rescan folder'}
          </button>
          <button type="button" className="btn btn-danger-ghost" id="remove-btn" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="stat-value">{stats.percent ?? 0}%</span>
          <span className="stat-label">Complete</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.completed ?? 0}</span>
          <span className="stat-label">Lessons done</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.counted ?? 0}</span>
          <span className="stat-label">Lessons</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.averagePercent ?? 0}%</span>
          <span className="stat-label">Average watched</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.missing ?? 0}</span>
          <span className="stat-label">Missing files</span>
        </div>
      </div>

      {grouped.map((group) => (
        <section className="lesson-group" key={group.name || 'general'}>
          {group.name ? <h2 className="group-title">{group.name}</h2> : null}
          <ul className="lesson-list">
            {group.lessons.map((lesson) => {
              const progress = lesson.progress;
              const done = !!progress?.completed;
              const resumeAt = Number(progress?.position_sec ?? 0);
              const showResume = resumeAt > 5 && !done;
              return (
                <li
                  className={`lesson-item ${lesson.missing ? 'is-missing' : ''}`}
                  key={lesson.id}
                >
                  <Link className="lesson-link" to={`/player/${lesson.id}`}>
                    <span className={`lesson-check ${done ? 'done' : ''}`}>✓</span>
                    <span className="lesson-title">{lesson.title}</span>
                    {lesson.warn ? <span title={lesson.warn}>⚠</span> : null}
                    {lesson.missing ? <span className="badge badge-warn">missing</span> : null}
                    {showResume ? (
                      <span className="muted small">resume {formatTime(resumeAt)}</span>
                    ) : null}
                    <span className="lesson-type">{lesson.type}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
