import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { fetchLesson } from '../api/lessons.js';
import {
  fetchBookmarks,
  addBookmark,
  renameBookmark,
  deleteBookmark,
  fetchNotes,
  saveNotes,
  setCompleted,
} from '../api/progress.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import Markdown from '../components/Markdown.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import useMediaProgress from '../hooks/useMediaProgress.js';
import { formatTime } from '../utils/format.js';

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

  const startPos = Number(data?.progress?.position_sec ?? 0);
  const offerResume = !!data?.offerResume && !bannerDismissed;

  // Seek to the saved position once the metadata is available.
  const seekTo = useCallback(
    (position) => {
      const media = mediaRef.current;
      if (!media) return;
      const apply = () => {
        if (position > 0 && Number.isFinite(media.duration)) {
          media.currentTime = position;
        }
      };
      if (media.readyState >= 1) apply();
      else media.addEventListener('loadedmetadata', apply, { once: true });
    },
    []
  );

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

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠</div>
        <h3>Lesson not found</h3>
        <p className="muted">{error}</p>
        <Link to="/" className="btn btn-primary">
          Back to library
        </Link>
      </div>
    );
  }

  if (!data) return <p className="muted">Loading…</p>;

  const { lesson, course, grouped, prev, next, index, total } = data;

  return (
    <div className={`player-layout ${sidebarHidden ? 'sidebar-hidden' : ''}`} id="player-layout">
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-head">
          <Link className="crumbs-back" to={`/courses/${course.id}`}>
            ‹ {course.title}
          </Link>
        </div>

        <div className="sidebar-progress" id="sidebar-progress">
          <div className="muted small" style={{ marginBottom: '.4rem' }}>
            Lesson {index + 1} of {total} · {course.stats?.percent ?? 0}% of course
          </div>
          <ProgressBar percent={course.stats?.percent ?? 0} />
        </div>

        <div className="sidebar-list">
          {grouped.map((group) => (
            <div className="sidebar-group" key={group.name || 'general'}>
              {group.name ? <div className="sidebar-group-title">{group.name}</div> : null}
              {group.lessons.map((l) => (
                <Link
                  key={l.id}
                  to={`/player/${l.id}`}
                  data-lesson-id={l.id}
                  className={`sidebar-lesson ${l.id === lesson.id ? 'active' : ''} ${
                    l.missing ? 'is-missing' : ''
                  }`}
                >
                  <span>{l.title}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="player-main">
        <div className="player-head">
          <div>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p className="muted small">
              Lesson {index + 1} of {total}
              {lesson.section ? ` · ${lesson.section}` : ''} ·{' '}
              <span id="lesson-type">{lesson.type}</span>
            </p>
          </div>
          <div className="player-nav">
            <button
              type="button"
              className="btn btn-icon sidebar-toggle"
              id="sidebar-toggle"
              aria-label="Toggle lesson list"
              aria-pressed={!sidebarHidden}
              onClick={() => setSidebarHidden((v) => !v)}
            >
              ☰
            </button>
            {prev ? (
              <Link className="btn" id="prev-btn" to={`/player/${prev.id}`}>
                ← Previous
              </Link>
            ) : (
              <button type="button" className="btn" id="prev-btn" disabled>
                ← Previous
              </button>
            )}
            <button
              type="button"
              className={`btn ${completed ? '' : 'btn-primary'}`}
              id="complete-btn"
              onClick={onToggleComplete}
            >
              {completed ? 'Completed ✓' : 'Mark complete'}
            </button>
            {next ? (
              <Link className="btn" id="next-btn" to={`/player/${next.id}`}>
                Next →
              </Link>
            ) : (
              <button type="button" className="btn" id="next-btn" disabled>
                Next →
              </button>
            )}
          </div>
        </div>

        {offerResume ? (
          <div className="resume-banner" id="resume-banner">
            <span>
              Resume at <strong>{data.resumeAt}</strong>?
            </span>
            <div className="row-actions">
              <button type="button" className="btn btn-sm" id="start-over-btn" onClick={onStartOver}>
                Start over
              </button>
              <button type="button" className="btn btn-sm btn-primary" id="resume-btn" onClick={onResume}>
                Resume
              </button>
            </div>
          </div>
        ) : null}

        {!data.exists ? (
          <div className="alert alert-warn" style={{ marginTop: '1rem' }}>
            This lesson’s file is missing from disk.
          </div>
        ) : null}

        <div className="stage" style={{ marginTop: '1rem' }}>
          {lesson.type === 'video' ? (
            <video
              id="media"
              ref={mediaRef}
              controls
              preload="metadata"
              playsInline
              src={`/player/${lesson.id}/stream`}
              data-warn={lesson.warn ? '1' : undefined}
            />
          ) : lesson.type === 'audio' ? (
            <div className="audio-wrap">
              <div className="audio-art">♪</div>
              <audio
                id="media"
                ref={mediaRef}
                controls
                preload="metadata"
                src={`/player/${lesson.id}/stream`}
              />
            </div>
          ) : lesson.type === 'document' ? (
            <iframe id="doc-frame" className="doc-frame" src={`/player/${lesson.id}/document`} />
          ) : (
            <TextLesson lessonId={lesson.id} />
          )}
        </div>

        <div className="panels">
          <section className="panel">
            <div className="panel-title">
              <span>Bookmarks</span>
              <span className="muted small" id="bookmark-count">
                {bookmarks.length}
              </span>
            </div>
            <button type="button" className="btn btn-sm" id="add-bookmark-btn" onClick={onAddBookmark}>
              + Add bookmark
            </button>
            <ul className="bookmark-list" id="bookmark-list">
              {bookmarks.length === 0 ? (
                <li className="bookmark-empty">
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
          </section>

          <section className="panel">
            <div className="panel-title">
              <span>Notes</span>
              <span className="muted small" id="notes-status">
                {notesStatus}
              </span>
            </div>
            <textarea
              id="notes"
              className="notes-area"
              value={notesBody}
              placeholder="Jot down key ideas from this lesson…"
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </section>
        </div>
      </div>
    </div>
  );
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
    <li className="bookmark-item">
      <button type="button" className="bookmark-time" onClick={() => onSeek(bookmark)}>
        {formatTime(bookmark.timestamp)}
      </button>
      {editing ? (
        <input
          className="bookmark-edit"
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
          <span className="bookmark-label">{bookmark.label || '(no label)'}</span>
          <button
            type="button"
            className="btn-icon"
            aria-label="Rename bookmark"
            onClick={() => {
              setDraft(bookmark.label ?? '');
              setEditing(true);
            }}
          >
            ✎
          </button>
        </>
      )}
      <button
        type="button"
        className="bookmark-del"
        aria-label="Delete bookmark"
        onClick={() => onDelete(bookmark)}
      >
        ×
      </button>
    </li>
  );
}

/** A text lesson: rendered as markdown, or sandboxed HTML in an iframe. */
function TextLesson({ lessonId }) {
  const [text, setText] = useState(null);
  const [failed, setFailed] = useState(false);
  const src = `/player/${lessonId}/document`;

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('Request failed');
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

  if (failed) return <div className="text-lesson">Could not load this lesson file.</div>;
  if (text === null) return <div className="text-lesson muted">Loading…</div>;

  // The file is the user's own local content; render it in a sandboxed frame
  // rather than injecting it into this document.
  if (/\.html?$/i.test(src)) {
    return <iframe className="doc-frame" sandbox="" srcDoc={text} title="Lesson document" />;
  }

  return (
    <div className="text-lesson">
      <Markdown text={text} />
    </div>
  );
}
