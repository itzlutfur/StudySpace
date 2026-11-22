import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import {
  deleteCourse,
  fetchDashboard,
  renameCourse,
  rescanCourse,
  restoreCourse,
} from '../api/courses.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import CourseCard from '../components/CourseCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import { IconBook, IconCheck, IconPlus, IconSearch, IconVideo } from '../components/icons.jsx';
import { formatRelative } from '../utils/format.js';

/** The status filter options shown above the course grid. */
const FILTERS = [
  { value: 'all', label: 'All Courses' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not-started', label: 'Not Started' },
];

/**
 * Classify a course by its progress, for the status filter.
 *
 * "Completed" means every counted lesson is done; "Not Started" means no
 * lesson has been watched at all.
 */
function statusOf(course) {
  const stats = course.stats ?? {};
  if (stats.counted > 0 && stats.completed >= stats.counted) return 'completed';
  if (!stats.completed && !stats.averagePercent) return 'not-started';
  return 'in-progress';
}

export default function MyCourses() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [openMenu, setOpenMenu] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('coursestream:library-changed', onChanged);
    return () => window.removeEventListener('coursestream:library-changed', onChanged);
  }, [load]);

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
    return courses.filter((course) => {
      if (term && !course.title.toLowerCase().includes(term)) return false;
      if (filter === 'all') return true;
      return statusOf(course) === filter;
    });
  }, [courses, query, filter]);

  const stats = data?.stats ?? {
    totalCourses: 0,
    totalLessons: 0,
    totalVideos: 0,
    completedLessons: 0,
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

  return (
    <>
      <PageHeader
        eyebrow="Workspace / My Courses"
        title="My Courses"
        actions={
          <Link
            to="/courses/add"
            className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            <IconPlus size={17} />
            <span className="hidden sm:inline">Add Folder</span>
          </Link>
        }
      />

      <div className="space-y-8 px-5 py-8 lg:px-10">
        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
            {error}
          </div>
        ) : null}

        {/* ---------------------------- summary ---------------------------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={IconBook}
            tone="blue"
            label="Total Courses"
            value={stats.totalCourses}
            caption="Imported folders"
          />
          <StatCard
            icon={IconVideo}
            tone="purple"
            label="Total Lessons"
            value={stats.totalLessons}
            caption="Videos and documents"
          />
          <StatCard
            icon={IconCheck}
            tone="emerald"
            label="Completed"
            value={stats.completedLessons}
            caption="Lessons finished"
          />
        </section>

        {/* ------------------------- search & filters ------------------------ */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your Library</h2>
            <p className="mt-1 text-sm text-ink-3">All folders you have added to StudySpace</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <IconSearch
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                id="course-search"
                type="search"
                placeholder="Search courses..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-hair-strong bg-card py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50 sm:w-64"
              />
            </div>

            <select
              id="course-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-hair-strong bg-card px-4 py-2.5 text-sm text-ink-2 outline-none transition focus:border-accent/50"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* --------------------------- course grid --------------------------- */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => (
            <div key={course.id} className="relative">
              <CourseCard
                course={{ ...course, lastOpenedLabel: formatRelative(course.lastOpenedAt) }}
                variant="library"
                onMenuToggle={() => setOpenMenu(course.id)}
              />
              <div
                className="menu absolute right-4 top-4 z-30 min-w-[170px] rounded-xl border border-hair-strong bg-raised p-1 shadow-xl"
                data-menu={course.id}
                hidden={openMenu !== course.id}
              >
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-accent-soft hover:text-ink"
                  data-action="rename"
                  data-id={course.id}
                  onClick={() => onRename(course)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 transition hover:bg-accent-soft hover:text-ink"
                  data-action="rescan"
                  data-id={course.id}
                  onClick={() => onRescan(course)}
                >
                  Rescan folder
                </button>
                <hr className="my-1 border-hair" />
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-rose-500/10"
                  data-action="remove"
                  data-id={course.id}
                  onClick={() => onRemove(course)}
                >
                  Remove course
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ---------------------------- empty ---------------------------- */}
        {!data ? (
          <p className="text-sm text-ink-3">Loading…</p>
        ) : courses.length === 0 || visible.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/10 bg-card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">
              📁
            </div>
            <h3 className="mt-4 font-medium text-ink">
              {courses.length === 0 ? 'Add another course' : 'No courses match your filters'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-3">
              {courses.length === 0
                ? 'Choose a folder from your computer. StudySpace will organize its videos, PDFs, and text files into a course.'
                : 'Try a different search term or status filter.'}
            </p>
            {courses.length === 0 ? (
              <Link
                to="/courses/add"
                className="mt-5 inline-block rounded-xl border border-hair-strong px-4 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04]"
              >
                + Add Folder
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
