import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { fetchLesson } from '../api/lessons.js';
import {
  deleteCourse,
  fetchDashboard,
  rescanCourse,
  restoreCourse,
  savePlaybackSpeed,
} from '../api/courses.js';
import {
  addBookmark,
  deleteBookmark,
  fetchBookmarks,
  fetchNotes,
  renameBookmark,
  saveNotes,
  setCompleted,
} from '../api/progress.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import Markdown from '../components/Markdown.jsx';
import {
  IconBook,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconDocument,
  IconPencil,
  IconPlay,
  IconSearch,
  IconSettings,
  IconVideo,
} from '../components/icons.jsx';
import useMediaProgress from '../hooks/useMediaProgress.js';
import { formatClock, formatHumanDuration, formatTime } from '../utils/format.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'resources', label: 'Resources' },
  { id: 'notes', label: 'Notes' },
];

/** The icon tile for a lesson in the playlist, by status. */
function lessonIcon(lesson, isCurrent) {
  if (lesson.completed) return { Glyph: IconCheck, tone: 'bg-ok-soft text-ok' };
  if (isCurrent) return { Glyph: IconPlay, tone: 'bg-accent text-white' };
  if (lesson.type === 'video') return { Glyph: IconVideo, tone: 'bg-white/[0.04] text-ink-3' };
  if (lesson.type === 'audio') return { Glyph: IconClock, tone: 'bg-white/[0.04] text-ink-3' };
  return { Glyph: IconDocument, tone: 'bg-white/[0.04] text-ink-3' };
}

export default function Player() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [completed, setCompletedState] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [notesBody, setNotesBody] = useState('');
  const [notesStatus, setNotesStatus] = useState('Saved');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState('overview');
  const [playlistQuery, setPlaylistQuery] = useState('');
  // Playlist groups start collapsed; the user opens the ones they need.
  const [expanded, setExpanded] = useState({});
  const [speed, setSpeed] = useState(1);

  const mediaRef = useRef(null);
  const notesTimer = useRef(null);

  const wantsResume = params.get('resume') === '1';

  /* ----------------------------- loading ----------------------------- */

  const load = useCallback(async () => {
    try {
      const result = await fetchLesson(lessonId);
      setData(result);
      setCompletedState(!!result.progress?.completed);
      setNotesBody(result.notesBody ?? '');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadBookmarks = useCallback(async () => {
    try {
      const result = await fetchBookmarks(lessonId);
      setBookmarks(result.bookmarks ?? []);
    } catch {
      // Bookmarks are non-critical — a failure here should not break the page.
    }
  }, [lessonId]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // The default playback speed is a stored preference.
  useEffect(() => {
    fetchDashboard()
      .then((result) => {
        const stored = Number(result.playbackSpeed) || 1;
        setSpeed(stored);
        if (mediaRef.current) mediaRef.current.playbackRate = stored;
      })
      .catch(() => {});
  }, []);

  /* ------------------------------ media ------------------------------ */

  const onEnded = useCallback(async () => {
    try {
      await setCompleted(lessonId, true);
      setCompletedState(true);
      toast('Lesson marked complete');
    } catch {
      // The progress save already recorded the completion.
    }
  }, [lessonId, toast]);

  useMediaProgress(lessonId, mediaRef, { onEnded });

  // Apply the chosen speed to the element whenever it becomes available.
  useEffect(() => {
    const media = mediaRef.current;
    if (media) media.playbackRate = speed;
  }, [speed, data]);

  const changeSpeed = async (value) => {
    setSpeed(value);
    if (mediaRef.current) mediaRef.current.playbackRate = value;
    try {
      await savePlaybackSpeed(value);
    } catch {
      // The speed still applies to this session even if the save failed.
    }
  };

  /* -------------------------- course actions ------------------------- */

  const onRescan = async () => {
    setScanning(true);
    try {
      const result = await rescanCourse(data.course.id);
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
      const result = await deleteCourse(data.course.id);
      toast(`Removed "${data.course.title}"`, {
        timeout: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await restoreCourse(result.snapshot);
              toast('Course restored');
              // The restored lessons get new ids, so the old player URL is
              // no longer valid — send the user back to the library instead.
              window.dispatchEvent(new CustomEvent('coursestream:library-changed'));
            } catch (err) {
              toast(err.message, { type: 'error', timeout: 7000 });
            }
          },
        },
      });
      // The course this lesson belongs to is gone — leave the dead player page.
      navigate('/');
    } catch (err) {
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  const startPos = Number(data?.progress?.position_sec ?? 0);
  const offerResume = !!data?.offerResume && !bannerDismissed;

  // Seek to the saved position once the metadata is available.
  const seekTo = useCallback((position) => {
    const media = mediaRef.current;
    if (!media) return;
    const apply = () => {
      if (position > 0 && Number.isFinite(media.duration)) {
        media.currentTime = position;
      }
    };
    if (media.readyState >= 1) apply();
    else media.addEventListener('loadedmetadata', apply, { once: true });
  }, []);

  const onResume = () => {
    setBannerDismissed(true);
    seekTo(startPos);
    mediaRef.current?.play?.().catch(() => {});
  };

  const onStartOver = () => {
    setBannerDismissed(true);
    if (mediaRef.current) mediaRef.current.currentTime = 0;
  };

  /* ---------------------------- bookmarks ---------------------------- */

  const onAddBookmark = async () => {
    const timestamp = Number(mediaRef.current?.currentTime) || 0;
    try {
      await addBookmark(lessonId, timestamp, '');
      await loadBookmarks();
      toast(`Bookmark added at ${formatTime(timestamp)}`);
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  };

  const onRenameBookmark = async (bookmark, label) => {
    try {
      await renameBookmark(lessonId, bookmark.id, label);
      setBookmarks((list) =>
        list.map((b) => (b.id === bookmark.id ? { ...b, label } : b))
      );
    } catch (err) {
      toast(err.message, { type: 'error' });
      await loadBookmarks();
    }
  };

  const onDeleteBookmark = async (bookmark) => {
    try {
      await deleteBookmark(lessonId, bookmark.id);
      await loadBookmarks();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  };

  const seekToBookmark = (bookmark) => {
    seekTo(bookmark.timestamp);
    mediaRef.current?.play?.().catch(() => {});
  };

  /* ------------------------------ notes ------------------------------ */

  const onNotesChange = (value) => {
    setNotesBody(value);
    setNotesStatus('Saving…');
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      notesTimer.current = null;
      try {
        await saveNotes(lessonId, value);
        setNotesStatus('Saved ✓');
      } catch {
        setNotesStatus('Save failed');
      }
    }, 800);
  };

  useEffect(() => () => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
  }, []);

  /* ---------------------------- complete ----------------------------- */

  const onToggleComplete = async () => {
    const next = !completed;
    try {
      await setCompleted(lessonId, next);
      setCompletedState(next);
      // Keep the playlist marker in sync without a full reload.
      setData((current) =>
        current
          ? {
              ...current,
              grouped: current.grouped.map((group) => ({
                ...group,
                lessons: group.lessons.map((l) =>
                  l.id === lessonId ? { ...l, completed: next } : l
                ),
              })),
            }
          : current
      );
      toast(next ? 'Marked complete' : 'Marked incomplete');
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  };

  /* ------------------------- keyboard shortcuts ---------------------- */

  const goPrev = data?.prev?.id;
  const goNext = data?.next?.id;

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const media = mediaRef.current;
      if (!media) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          media.paused ? media.play() : media.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          media.currentTime = Math.max(0, media.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          media.currentTime = Math.min(media.duration || Infinity, media.currentTime + 10);
          break;
        case 'f':
          media.requestFullscreen?.();
          break;
        case 'm':
          media.muted = !media.muted;
          break;
        case 'n':
          if (goNext) navigate(`/player/${goNext}`);
          break;
        case 'p':
          if (goPrev) navigate(`/player/${goPrev}`);
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, navigate]);

  /* ----------------------------- render ------------------------------ */

  // Playlist search filters the lessons by title.
  // This hook must stay above the early returns below — a hook that only runs
  // on the loaded path breaks the rules of hooks. It reads `data` directly
  // rather than the destructured `grouped`, which is not in scope yet.
  const filteredGroups = useMemo(() => {
    const groups = data?.grouped ?? [];
    const term = playlistQuery.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((group) => ({
        ...group,
        lessons: group.lessons.filter((l) => l.title.toLowerCase().includes(term)),
      }))
      .filter((group) => group.lessons.length > 0);
  }, [data, playlistQuery]);

  if (error) {
    return (
      <div className="p-8">
        <div className="empty-state mx-auto max-w-lg rounded-2xl border border-dashed border-hair-strong bg-card p-8 text-center">
          <div className="empty-icon text-3xl">⚠</div>
          <h3 className="mt-3 font-medium text-ink">Lesson not found</h3>
          <p className="mt-2 text-sm text-ink-3">{error}</p>
          <Link
            to="/"
            className="mt-5 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    );
  }

  const { lesson, course, grouped, prev, next, index, total } = data;
  const coursePercent = course.stats?.percent ?? 0;
  const completedCount = course.stats?.completed ?? 0;
  const countedCount = course.stats?.counted ?? 0;
  const remaining = Math.max(0, countedCount - completedCount);
  const durationSec = Number(data.durationSec) || 0;

  const toggleSection = (name) => {
    setExpanded((current) => ({ ...current, [name]: !current[name] }));
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ------------------------- sticky header ------------------------- */}
      <header className="sticky top-0 z-50 border-b border-hair bg-surface">
        <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hair text-ink-2 transition hover:bg-white/[0.05] hover:text-ink"
              aria-label="Back to dashboard"
            >
              <IconChevronLeft size={19} />
            </Link>

            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-ink">StudySpace</h1>
              <p className="text-xs text-ink-3">Course Player</p>
            </div>

            <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{course.title}</p>
              <p className="text-xs text-ink-3">
                Lesson {index + 1} of {total}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-2 rounded-lg border border-hair px-3 py-2 text-xs text-ink-2 md:flex">
              <IconDownload size={16} />
              Local Course
            </span>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hair text-ink-2 transition hover:bg-white/[0.05] hover:text-ink"
              aria-label="Toggle lesson list"
              id="sidebar-toggle"
              aria-pressed={!sidebarHidden}
              onClick={() => setSidebarHidden((v) => !v)}
            >
              <IconChevronLeft
                size={18}
                className={`transition-transform ${sidebarHidden ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hair text-ink-2 transition hover:bg-white/[0.05] hover:text-ink"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
            >
              <IconSettings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------- main layout ---------------------------- */}
      <div className="mx-auto max-w-[1800px]">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* -------------------------- main column -------------------------- */}
          <main className="min-w-0">
            <div className="px-5 pt-6 lg:px-8">
              {/* breadcrumb */}
              <nav className="mb-5 flex items-center gap-2 text-xs text-ink-3">
                <Link to="/" className="transition hover:text-ink">
                  Dashboard
                </Link>
                <IconChevronRight size={13} />
                <Link to="/courses" className="transition hover:text-ink">
                  My Courses
                </Link>
                <IconChevronRight size={13} />
                <span className="truncate text-ink-2">{course.title}</span>
              </nav>

              {offerResume ? (
                <div className="resume-banner mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
                  <span className="text-sm text-ink-2">
                    You stopped at <strong className="text-ink">{data.resumeAt}</strong>. Pick up where
                    you left off?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-hair-strong px-3 py-1.5 text-xs text-ink-2 transition hover:bg-white/[0.05]"
                      id="start-over-btn"
                      onClick={onStartOver}
                    >
                      Start over
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
                      id="resume-btn"
                      onClick={onResume}
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ) : null}

              {!data.exists ? (
                <div className="mb-5 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
                  This lesson’s file is missing from disk.
                </div>
              ) : null}

              {/* the media stage */}
              <section className="overflow-hidden rounded-2xl border border-hair bg-black">
                <div className="relative flex aspect-video items-center justify-center bg-black">
                  {lesson.type === 'video' ? (
                    <video
                      id="media"
                      ref={mediaRef}
                      controls
                      preload="metadata"
                      playsInline
                      className="h-full w-full"
                      src={`/player/${lesson.id}/stream`}
                      data-warn={lesson.warn ? '1' : undefined}
                    />
                  ) : lesson.type === 'audio' ? (
                    <div className="flex w-full flex-col items-center px-6 py-12 text-center">
                      <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-4xl text-accent">
                        ♪
                      </div>
                      <audio
                        id="media"
                        ref={mediaRef}
                        controls
                        preload="metadata"
                        className="w-full max-w-[480px]"
                        src={`/player/${lesson.id}/stream`}
                      />
                    </div>
                  ) : lesson.type === 'document' ? (
                    <iframe
                      id="doc-frame"
                      title="Lesson document"
                      className="h-[70vh] w-full border-0 bg-white"
                      src={`/player/${lesson.id}/document`}
                    />
                  ) : (
                    <TextLesson lessonId={lesson.id} />
                  )}
                </div>
              </section>

              {/* lesson title block */}
              <section className="mt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                        {course.title}
                      </span>
                      <span
                        className={`rounded-md px-2.5 py-1 text-xs ${
                          completed
                            ? 'bg-ok-soft text-ok'
                            : 'bg-warn-soft text-warn'
                        }`}
                      >
                        {completed ? 'Completed' : 'In Progress'}
                      </span>
                      {lesson.warn ? (
                        <span className="rounded-md bg-warn-soft px-2.5 py-1 text-xs text-warn">
                          ⚠ {lesson.warn}
                        </span>
                      ) : null}
                    </div>

                    <h2
                      id="lesson-title"
                      className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
                    >
                      {lesson.title}
                    </h2>
                    <p className="mt-2 text-sm text-ink-3">
                      Lesson {index + 1} of {total}
                      {lesson.section ? ` · ${lesson.section}` : ''} ·{' '}
                      <span id="lesson-type">{lesson.type}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-xl border border-hair px-3.5 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04] hover:text-ink"
                      onClick={() => {
                        setTab('notes');
                        document.getElementById('notes')?.focus();
                      }}
                    >
                      <IconPencil size={17} />
                      Notes
                    </button>

                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        completed
                          ? 'border border-hair text-ink-2 hover:bg-white/[0.04]'
                          : 'bg-accent text-white hover:bg-accent-hover'
                      }`}
                      id="complete-btn"
                      onClick={onToggleComplete}
                    >
                      {completed ? <IconCheck size={17} /> : null}
                      {completed ? 'Completed ✓' : 'Mark Complete'}
                    </button>
                  </div>
                </div>

                {/* course progress */}
                <div className="mt-6 rounded-2xl border border-hair bg-card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">Course Progress</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {completedCount} of {countedCount} lessons completed
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-accent">{coursePercent}%</span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${coursePercent}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
                    <span>Keep learning at your own pace</span>
                    <span>
                      {remaining} lesson{remaining === 1 ? '' : 's'} remaining
                    </span>
                  </div>
                </div>
              </section>

              {/* tabs */}
              <section className="mt-8">
                <div className="flex gap-6 border-b border-hair">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`border-b-2 pb-3 text-sm font-medium transition ${
                        tab === t.id
                          ? 'border-accent text-accent'
                          : 'border-transparent text-ink-3 hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="py-6">
                  {tab === 'overview' ? (
                    <>
                      <h3 className="text-base font-semibold text-ink">About this lesson</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-2">
                        {lesson.section
                          ? `Part of “${lesson.section}” in ${course.title}.`
                          : `A lesson in ${course.title}.`}{' '}
                        Playback position and completion are saved automatically, so you can leave and
                        come back to this lesson at any time.
                      </p>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <MetaTile icon={IconClock} label="Duration" value={formatHumanDuration(durationSec)} />
                        <MetaTile icon={IconBook} label="Course" value={course.title} />
                        <MetaTile icon={IconDocument} label="File Type" value={fileTypeLabel(lesson)} />
                      </div>
                    </>
                  ) : null}

                  {tab === 'resources' ? (
                    <div className="no-match rounded-2xl border border-dashed border-hair-strong bg-card p-8 text-center">
                      <h3 className="font-medium text-ink">No extra resources</h3>
                      <p className="mt-2 text-sm text-ink-3">
                        This lesson has no downloadable files or links attached.
                      </p>
                    </div>
                  ) : null}

                  {tab === 'notes' ? (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-base font-semibold text-ink">Your notes</h3>
                          <span className="text-xs text-ink-3" id="notes-status">
                            {notesStatus}
                          </span>
                        </div>
                        <textarea
                          id="notes"
                          className="h-56 w-full resize-y rounded-xl border border-hair-strong bg-card p-3.5 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50"
                          value={notesBody}
                          placeholder="Jot down key ideas from this lesson…"
                          onChange={(e) => onNotesChange(e.target.value)}
                        />
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-base font-semibold text-ink">Bookmarks</h3>
                          <span className="text-xs text-ink-3" id="bookmark-count">
                            {bookmarks.length}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mb-3 rounded-lg border border-hair px-3 py-1.5 text-xs text-ink-2 transition hover:bg-white/[0.04]"
                          id="add-bookmark-btn"
                          onClick={onAddBookmark}
                        >
                          + Add bookmark
                        </button>
                        <ul className="bookmark-list rounded-xl border border-hair bg-card" id="bookmark-list">
                          {bookmarks.length === 0 ? (
                            <li className="bookmark-empty px-4 py-3 text-sm text-ink-3">
                              No bookmarks yet. Add one to jump back here later.
                            </li>
                          ) : (
                            bookmarks.map((bookmark) => (
                              <BookmarkItem
                                key={bookmark.id}
                                bookmark={bookmark}
                                onSeek={seekToBookmark}
                                onRename={onRenameBookmark}
                                onDelete={onDeleteBookmark}
                              />
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* prev / next */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair py-6">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-hair px-3.5 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04] disabled:opacity-40"
                  id="prev-btn"
                  disabled={!prev}
                  onClick={() => prev && navigate(`/player/${prev.id}`)}
                >
                  <IconChevronLeft size={16} />
                  Previous
                </button>

                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-hair px-3.5 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04] disabled:opacity-40"
                  id="next-btn"
                  disabled={!next}
                  onClick={() => next && navigate(`/player/${next.id}`)}
                >
                  Next
                  <IconChevronRight size={16} />
                </button>
              </div>
            </div>
          </main>

          {/* -------------------------- playlist rail -------------------------- */}
          <aside
            id="sidebar"
            className={`border-t border-hair bg-surface xl:sticky xl:top-16 xl:h-[calc(100vh-4rem)] xl:overflow-hidden xl:border-l xl:border-t-0 ${
              sidebarHidden ? 'hidden' : ''
            }`}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-hair p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink">Course Content</h2>
                    <p className="mt-1 text-xs text-ink-3">
                      {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
                      {course.totalDurationSec
                        ? ` · ${formatHumanDuration(course.totalDurationSec)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="relative mt-5">
                  <IconSearch
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
                  />
                  <input
                    type="search"
                    placeholder="Search lessons..."
                    value={playlistQuery}
                    onChange={(e) => setPlaylistQuery(e.target.value)}
                    className="w-full rounded-xl border border-hair-strong bg-card py-2.5 pl-9 pr-3 text-xs text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50"
                  />
                </div>

                <div className="sidebar-actions mt-4 flex items-center gap-2" id="sidebar-actions">
                  <button
                    type="button"
                    className="rounded-lg border border-hair px-3 py-1.5 text-xs text-ink-2 transition hover:bg-white/[0.04] disabled:opacity-40"
                    id="rescan-btn"
                    disabled={scanning}
                    onClick={onRescan}
                  >
                    {scanning ? 'Scanning…' : 'Rescan folder'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/20"
                    id="remove-btn"
                    onClick={onRemove}
                  >
                    Remove course
                  </button>
                </div>
              </div>

              <div className="sidebar-list scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {filteredGroups.length === 0 ? (
                  <p className="no-match p-4 text-center text-sm text-ink-3">
                    No lessons match “{playlistQuery}”.
                  </p>
                ) : (
                  filteredGroups.map((group) => {
                    const key = group.name || 'general';
                    const isExpanded = !!expanded[key];
                    return (
                      <div className="sidebar-group mb-5" key={key}>
                        <button
                          type="button"
                          className="mb-3 flex w-full items-center justify-between gap-3 px-2 text-left"
                          onClick={() => toggleSection(key)}
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-ink">
                              {group.name || 'Lessons'}
                            </h3>
                            <p className="mt-1 text-xs text-ink-3">
                              {group.lessons.length} lesson{group.lessons.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <IconChevronDown
                            size={16}
                            className={`shrink-0 text-ink-3 transition ${isExpanded ? '' : '-rotate-90'}`}
                          />
                        </button>

                        {isExpanded ? (
                          group.lessons.map((l) => {
                            const isCurrent = l.id === lesson.id;
                            const { Glyph, tone } = lessonIcon(l, isCurrent);
                            return (
                              <Link
                                key={l.id}
                                to={`/player/${l.id}`}
                                data-lesson-id={l.id}
                                className={`sidebar-lesson mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                                  isCurrent
                                    ? 'border border-accent-line bg-accent-soft'
                                    : 'border border-transparent hover:bg-white/[0.04]'
                                } ${l.missing ? 'is-missing opacity-50' : ''}`}
                              >
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
                                >
                                  <Glyph size={15} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate text-xs ${
                                      isCurrent
                                        ? 'font-medium text-blue-300'
                                        : l.completed
                                          ? 'text-ink-4 line-through decoration-ink-4/50'
                                          : 'text-ink-2'
                                    }`}
                                  >
                                    {l.title}
                                  </p>
                                  <p className="mt-1 text-[10px] text-ink-4">
                                    {isCurrent
                                      ? `${formatClock(l.durationSec)} · Playing`
                                      : l.completed
                                        ? `${formatClock(l.durationSec)} · Completed`
                                      : l.durationSec
                                        ? formatClock(l.durationSec)
                                        : l.type}
                                  </p>
                                </div>

                                {l.completed ? (
                                  <span className="shrink-0 text-[10px] font-medium text-ok">
                                    Done
                                  </span>
                                ) : isCurrent ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                ) : null}
                              </Link>
                            );
                          })
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-hair p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-3">Course completion</span>
                  <span className="font-medium text-ink-2">{coursePercent}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${coursePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** A metadata tile under the Overview tab. */
function MetaTile({ icon: Glyph, label, value }) {
  return (
    <div className="rounded-xl border border-hair bg-card p-4">
      <div className="flex items-center gap-2 text-ink-3">
        <Glyph size={17} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-3 truncate text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

/** A readable file-type label for the metadata tile. */
function fileTypeLabel(lesson) {
  // The lesson row comes from the database, so the column is snake_case.
  const name = String(lesson.rel_path ?? lesson.relPath ?? lesson.title ?? '');
  const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : '';
  const type =
    lesson.type === 'video' ? 'Video' : lesson.type === 'audio' ? 'Audio' : 'Document';
  return ext ? `${ext} ${type}` : type;
}

/** A single bookmark row: timestamp chip, label (editable), delete. */
function BookmarkItem({ bookmark, onSeek, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bookmark.label ?? '');

  const commit = async () => {
    setEditing(false);
    const label = draft.trim();
    if (label !== (bookmark.label ?? '')) await onRename(bookmark, label);
  };

  return (
    <li className="bookmark-item flex items-center gap-2 border-b border-hair px-3 py-2 last:border-b-0">
      <button
        type="button"
        className="bookmark-time shrink-0 rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent transition hover:underline"
        onClick={() => onSeek(bookmark)}
      >
        {formatTime(bookmark.timestamp)}
      </button>
      {editing ? (
        <input
          className="min-w-0 flex-1 rounded border border-hair-strong bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-accent/50"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(bookmark.label ?? '');
              setEditing(false);
            }
          }}
        />
      ) : (
        <>
          <span className="bookmark-label min-w-0 flex-1 truncate text-sm text-ink-2">
            {bookmark.label || '(no label)'}
          </span>
          <button
            type="button"
            className="bookmark-edit shrink-0 text-ink-3 transition hover:text-ink"
            aria-label="Rename bookmark"
            onClick={() => {
              setDraft(bookmark.label ?? '');
              setEditing(true);
            }}
          >
            <IconPencil size={14} />
          </button>
        </>
      )}
      <button
        type="button"
        className="bookmark-del shrink-0 text-ink-3 transition hover:text-rose-400"
        aria-label="Delete bookmark"
        onClick={() => onDelete(bookmark)}
      >
        ×
      </button>
    </li>
  );
}

/** A text lesson: rendered as markdown, or as formatted HTML in a frame. */
function TextLesson({ lessonId }) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState(false);
  const [isHtml, setIsHtml] = useState(false);
  const src = `/player/${lessonId}/document`;

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('Request failed');
        // The Content-Type tells us how the server classified the file. An
        // HTML file is served as text/html; markdown and plain text are not.
        setIsHtml((r.headers.get('content-type') ?? '').includes('text/html'));
        return r.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return <div className="text-lesson p-8 text-sm text-ink-3">Could not load this lesson file.</div>;
  }
  if (text === null) {
    return <div className="text-lesson p-8 text-sm text-ink-3">Loading…</div>;
  }

  if (isHtml) {
    return <HtmlLesson html={text} />;
  }

  return (
    <div className="text-lesson w-full max-h-[68vh] overflow-y-auto p-8 text-left text-sm leading-7 text-ink-2">
      <Markdown text={text} />
    </div>
  );
}

/**
 * The typographic scale an HTML lesson is rendered at.
 *
 * The file is the user's own content and may carry no styling at all, so the
 * frame injects a small stylesheet to make bare HTML readable. It is applied
 * to the iframe's document, not to the app.
 */
const HTML_LESSON_STYLES = `
  :root { color-scheme: light; }
  body {
    margin: 0;
    padding: 2.5rem 3rem;
    background: #ffffff;
    color: #18181b;
    font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.75;
    -webkit-font-smoothing: antialiased;
    overflow-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #09090b;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.015em;
    margin: 2rem 0 0.75rem;
  }
  h1 { font-size: 1.875rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  h4 { font-size: 1.125rem; }
  h5, h6 { font-size: 1rem; }
  h1:first-child, h2:first-child { margin-top: 0; }
  p { margin: 0 0 1.1rem; }
  a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
  strong, b { font-weight: 600; color: #09090b; }
  em, i { font-style: italic; }
  ul, ol { margin: 0 0 1.1rem; padding-left: 1.5rem; }
  li { margin-bottom: 0.4rem; }
  ul { list-style: disc; }
  ol { list-style: decimal; }
  blockquote {
    margin: 1.5rem 0;
    padding: 0.25rem 0 0.25rem 1.25rem;
    border-left: 3px solid #d4d4d8;
    color: #52525b;
    font-style: italic;
  }
  code {
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.875em;
  }
  pre {
    background: #18181b;
    color: #fafafa;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    margin: 0 0 1.5rem;
    line-height: 1.6;
  }
  pre code {
    background: none;
    border: 0;
    padding: 0;
    color: inherit;
    font-size: 0.85rem;
  }
  img, video, iframe { max-width: 100%; height: auto; border-radius: 0.5rem; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
  }
  th, td {
    border: 1px solid #e4e4e7;
    padding: 0.6rem 0.85rem;
    text-align: left;
  }
  th { background: #f4f4f5; font-weight: 600; }
  hr { border: 0; border-top: 1px solid #e4e4e7; margin: 2rem 0; }
  figure { margin: 0 0 1.5rem; }
  figcaption { margin-top: 0.5rem; font-size: 0.8125rem; color: #71717a; text-align: center; }
`;

/**
 * An HTML lesson, rendered as formatted markup.
 *
 * The content is placed in a sandboxed iframe rather than injected into the
 * app's own document — the file is arbitrary HTML from the user's disk, and
 * injecting it would let it reach the app's DOM and storage.
 *
 * The sandbox allows `allow-same-origin` so the frame can be styled, but not
 * `allow-scripts`, so scripts in the file never execute.
 */
function HtmlLesson({ html }) {
  const docRef = useRef(null);

  // Write the stylesheet and the content into the frame once it exists.
  //
  // `srcDoc` documents can already be complete by the time this effect runs,
  // so the style is applied immediately when possible and again on `load`.
  useEffect(() => {
    const frame = docRef.current;
    if (!frame) return undefined;

    const apply = () => {
      const doc = frame.contentDocument;
      if (!doc) return;

      // The document may have no <head>, so create what is missing.
      if (!doc.head) {
        const head = doc.createElement('head');
        doc.documentElement.prepend(head);
      }

      // Drop any stylesheet from a previous render, then add ours.
      for (const old of doc.head.querySelectorAll('style[data-studyspace]')) old.remove();
      const style = doc.createElement('style');
      style.setAttribute('data-studyspace', '1');
      style.textContent = HTML_LESSON_STYLES;
      doc.head.appendChild(style);
    };

    apply();
    frame.addEventListener('load', apply);
    return () => frame.removeEventListener('load', apply);
  }, [html]);

  return (
    <div className="html-lesson w-full">
      <iframe
        ref={docRef}
        className="doc-frame h-[68vh] w-full border-0 bg-white"
        title="Lesson document"
        sandbox="allow-same-origin"
        srcDoc={html}
      />
    </div>
  );
}
