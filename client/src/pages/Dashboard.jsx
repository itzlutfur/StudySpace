import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  fetchDashboard,
  renameCourse,
  rescanCourse,
  deleteCourse,
  restoreCourse,
  saveSort,
} from '../api/courses.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import CourseCard from '../components/CourseCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import {
  IconBook,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconDocument,
  IconPlus,
  IconSearch,
  IconVideo,
} from '../components/icons.jsx';
import { formatRelative } from '../utils/format.js';
import { courseTargetUrl } from '../utils/courseTarget.js';

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

/** The icon tile for a recent item, keyed by lesson type. */
function recentIcon(type) {
  if (type === 'video') return { Glyph: IconVideo, tone: 'bg-blue-400/10 text-blue-400' };
  if (type === 'audio') return { Glyph: IconClock, tone: 'bg-purple-400/10 text-purple-400' };
  if (type === 'document') return { Glyph: IconDocument, tone: 'bg-red-400/10 text-red-400' };
  return { Glyph: IconDocument, tone: 'bg-amber-400/10 text-amber-400' };
}

export default function Dashboard() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params] = useSearchParams();

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

  // The player can restore a removed course while this page is already
  // mounted, so reload when it says the library changed.
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener('coursestream:library-changed', onChanged);
    return () => window.removeEventListener('coursestream:library-changed', onChanged);
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

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title);
      if (sort === 'progress') return (b.stats?.percent ?? 0) - (a.stats?.percent ?? 0);
      return String(b.lastOpenedAt || '').localeCompare(String(a.lastOpenedAt || ''));
    });
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

  const stats = data?.stats ?? {
    totalCourses: 0,
    totalLessons: 0,
    totalVideos: 0,
    completedLessons: 0,
    totalDurationSec: 0,
  };

  const learningHours = Math.round((stats.totalDurationSec / 3600) * 10) / 10;
  const recent = data?.recent ?? [];
  const showRecent = params.get('section') === 'recent';

  // Courses with something in progress — the "Continue Learning" grid.
  const continueCourses = useMemo(
    () =>
      courses
        .filter((c) => c.resumeLessonId)
        .sort((a, b) => String(b.lastOpenedAt || '').localeCompare(String(a.lastOpenedAt || '')))
        .slice(0, 3),
    [courses]
  );

  if (error) {
    return (
      <div className="p-8">
        <div className="empty-state mx-auto max-w-lg rounded-2xl border border-dashed border-hair-strong bg-card p-8 text-center">
          <div className="empty-icon text-3xl">⚠</div>
          <h3 className="mt-3 font-medium text-ink">Could not load your library</h3>
          <p className="muted mt-2 text-sm text-ink-3">{error}</p>
          <button
            type="button"
            className="mt-5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            onClick={load}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace / Dashboard"
        title="Welcome back 👋"
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <IconSearch
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <input
                id="course-search"
                type="search"
                placeholder="Search your library..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-hair-strong bg-card py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50"
              />
            </div>
            <Link
              to="/courses/add"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              <IconPlus size={17} />
              <span className="hidden sm:inline">Add Folder</span>
            </Link>
          </>
        }
      />

      <div className="space-y-9 px-5 py-8 lg:px-10">
        {/* ---------------------------- stats ---------------------------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={IconBook}
            tone="blue"
            tag="Library"
            label="Total Courses"
            value={stats.totalCourses}
            caption="Across your folders"
          />
          <StatCard
            icon={IconVideo}
            tone="purple"
            tag="Content"
            label="Total Videos"
            value={stats.totalVideos}
            caption="Available in your library"
          />
          <StatCard
            icon={IconCheck}
            tone="emerald"
            tag="Progress"
            label="Completed Lessons"
            value={stats.completedLessons}
            caption="Keep up the momentum"
          />
          <StatCard
            icon={IconClock}
            tone="amber"
            tag="Activity"
            label="Learning Time"
            value={`${learningHours}h`}
            caption="Total time spent learning"
          />
        </section>

        {/* ---------------------- continue learning ---------------------- */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Continue Learning</h2>
              <p className="mt-1 text-sm text-ink-3">Pick up where you left off</p>
            </div>
            <Link
              to="/courses"
              className="flex items-center gap-1 text-sm text-accent transition hover:text-accent-hover"
            >
              View all
              <IconChevronRight size={15} />
            </Link>
          </div>

          {continueCourses.length === 0 ? (
            <div className="no-match rounded-2xl border border-hair bg-card p-8 text-center">
              <p className="text-sm text-ink-3">
                Nothing in progress yet. Open a course and your position will show up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {continueCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  variant="continue"
                  onMenuToggle={() => setOpenMenu(course.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------ recently opened ------------------------ */}
        <section id="recent">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recently Opened</h2>
              <p className="mt-1 text-sm text-ink-3">Your latest learning activity</p>
            </div>
            <Link to="/?section=recent" className="text-sm text-accent transition hover:text-accent-hover">
              View history
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-hair bg-card">
            {recent.length === 0 ? (
              <div className="no-match p-8 text-center text-sm text-ink-3">
                {showRecent
                  ? 'Nothing has been played yet.'
                  : 'Lessons you open will show up here.'}
              </div>
            ) : (
              recent.map((item, index) => {
                const { Glyph, tone } = recentIcon(item.type);
                return (
                  <div
                    key={item.lessonId}
                    className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] ${
                      index < recent.length - 1 ? 'border-b border-white/[0.05]' : ''
                    }`}
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                      <Glyph size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-ink">{item.title}</h3>
                      <p className="mt-1 truncate text-xs text-ink-3">{item.courseTitle}</p>
                    </div>

                    <span className="hidden text-xs text-ink-3 sm:block">
                      {formatRelative(item.lastPlayed)}
                    </span>

                    <Link
                      to={`/player/${item.lessonId}`}
                      className="text-ink-3 transition hover:text-ink"
                      aria-label={`Open ${item.title}`}
                    >
                      <IconChevronRight size={18} />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ---------------------------- library ---------------------------- */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your Library</h2>
              <p className="mt-1 text-sm text-ink-3">All folders you have added to StudySpace</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                id="course-sort"
                value={sort}
                onChange={(e) => changeSort(e.target.value)}
                className="rounded-xl border border-hair-strong bg-card px-4 py-2.5 text-sm text-ink-2 outline-none transition focus:border-accent/50"
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
            <p className="text-sm text-ink-3">Loading…</p>
          ) : courses.length === 0 ? (
            <div className="empty-state rounded-2xl border border-dashed border-hair-strong bg-card p-10 text-center">
              <div className="empty-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">
                📁
              </div>
              <h3 className="mt-4 font-medium text-ink">Add another course</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-3">
                Choose a folder from your computer. StudySpace will organize its videos, PDFs, and
                text files into a course.
              </p>
              <button
                type="button"
                className="mt-5 rounded-xl border border-hair-strong px-4 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04]"
                onClick={() => navigate('/courses/add')}
              >
                + Add Folder
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="no-match rounded-2xl border border-hair bg-card p-8 text-center">
              <p className="text-sm text-ink-3">No courses match “{query}”.</p>
            </div>
          ) : (
            <div className="course-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" id="course-grid">
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
            </div>
          )}
        </section>

        {/* ---------------------------- footer ---------------------------- */}
        <footer className="flex flex-col gap-2 border-t border-hair pt-6 text-xs text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>StudySpace · Your personal learning environment</p>
          <p>Local library · {stats.totalCourses} courses</p>
        </footer>
      </div>
    </>
  );
}
