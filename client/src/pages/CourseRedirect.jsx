import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { fetchCourse } from '../api/courses.js';
import { courseTargetUrl } from '../utils/courseTarget.js';

/**
 * The legacy `/courses/:id` route.
 *
 * The course detail page is gone — a course now opens straight on the player.
 * This shim keeps old bookmarks and links working by sending them to the
 * lesson the course would have opened on.
 */
export default function CourseRedirect() {
  const { id } = useParams();
  const [target, setTarget] = useState(undefined);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchCourse(id);
      const first = result.grouped?.flatMap((group) => group.lessons)[0] ?? null;
      const url = courseTargetUrl({
        resumeLessonId: result.course?.resumeLessonId ?? null,
        firstLessonId: first?.id ?? null,
      });
      setTarget(url);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="px-5 py-16 lg:px-10">
        <div className="empty-state mx-auto max-w-lg rounded-2xl border border-dashed border-hair-strong bg-card p-10 text-center">
          <div className="empty-icon text-3xl">⚠</div>
          <h3 className="mt-3 font-medium text-ink">Course not found</h3>
          <p className="mt-2 text-sm text-ink-3">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  if (target === undefined) {
    return (
      <div className="px-5 py-16 lg:px-10">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    );
  }

  // A course with no lessons has nothing to play.
  if (!target) {
    return (
      <div className="px-5 py-16 lg:px-10">
        <div className="empty-state mx-auto max-w-lg rounded-2xl border border-dashed border-hair-strong bg-card p-10 text-center">
          <div className="empty-icon text-3xl">⚠</div>
          <h3 className="mt-3 font-medium text-ink">Course not found</h3>
          <p className="mt-2 text-sm text-ink-3">This course has no lessons yet.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  // `replace` so the back button skips this URL instead of bouncing through
  // it again.
  return <Navigate to={target} replace />;
}
