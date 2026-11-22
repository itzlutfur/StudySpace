import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { scanFolder, createCourse, fetchCourse } from '../api/courses.js';
import { pickFolder } from '../api/pickFolder.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { courseTargetUrl } from '../utils/courseTarget.js';

/** Group lessons by their section, preserving the order they were detected. */
function groupLessons(lessons) {
  const groups = [];
  for (const lesson of lessons) {
    const key = lesson.section ?? '';
    let group = groups.find((g) => g.name === key);
    if (!group) {
      group = { name: key, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  return groups;
}

export default function AddCourse() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [path, setPath] = useState(() => params.get('path') ?? '');
  const [scan, setScan] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const pathInput = useRef(null);

  // Keep the title in sync with the scanned folder name until the user edits it.
  useEffect(() => {
    if (scan?.title) setTitle((current) => (current ? current : scan.title));
  }, [scan]);

  const runScan = async (target) => {
    const value = String(target ?? '').trim();
    if (!value) {
      setScanError('Please enter a folder path.');
      return;
    }
    setScanning(true);
    setScanError('');
    try {
      const result = await scanFolder(value);
      setScan(result);
      setSelected(new Set(result.lessons.map((l) => l.relPath)));
    } catch (err) {
      setScan(null);
      setScanError(err.data?.detail ? `${err.message} — ${err.data.detail}` : err.message);
    } finally {
      setScanning(false);
    }
  };

  const onAdd = async () => {
    const chosen = [...selected];
    if (!chosen.length) {
      toast('Select at least one lesson', { type: 'error' });
      return;
    }

    setAdding(true);
    try {
      const result = await createCourse({
        title: title.trim() || scan.title,
        path: scan.root,
        lessons: chosen,
      });
      toast(`Added "${result.course.title}" — ${result.course.lessonCount} lessons`, { timeout: 3000 });
      navigate('/');
    } catch (err) {
      setAdding(false);
      if (err.status === 409 && err.data?.existingId) {
        const ok = await confirm({
          title: 'Already in your library',
          message: err.message,
          detail: 'Open the existing course instead?',
          confirmLabel: 'Open course',
        });
        if (ok) {
          // Open the existing course on the player, the same way its card
          // does — the legacy `/courses/:id` URL only redirects there.
          try {
            const existing = await fetchCourse(err.data.existingId);
            const first = existing.grouped?.flatMap((group) => group.lessons)[0] ?? null;
            const target = courseTargetUrl({
              resumeLessonId: existing.course?.resumeLessonId ?? null,
              firstLessonId: first?.id ?? null,
            });
            navigate(target ?? '/');
          } catch {
            navigate('/');
          }
        }
        return;
      }
      toast(err.message, { type: 'error', timeout: 7000 });
    }
  };

  const back = () => {
    setScan(null);
    setScanError('');
    setSelected(new Set());
  };

  /**
   * Open the operating system's own folder picker. The dialog is raised by
   * the server process, because a browser cannot hand back the absolute path
   * of a picked folder. Exactly one dialog may be open at a time — the server
   * rejects a second request — so the button is disabled while one is up.
   */
  const onPickFolder = async () => {
    if (picking) return;
    setPicking(true);
    setScanError('');
    try {
      const chosen = await pickFolder();
      if (!chosen) return; // the user dismissed the dialog
      setPath(chosen);
      await runScan(chosen);
    } catch (err) {
      if (err.status === 409) {
        setScanError('A folder picker is already open — close it and try again.');
        return;
      }
      setScanError(err.data?.detail ? `${err.message} — ${err.data.detail}` : err.message);
    } finally {
      setPicking(false);
    }
  };

  const toggleLesson = (relPath) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  };

  const toggleGroup = (lessons) => {
    const allSelected = lessons.every((l) => selected.has(l.relPath));
    setSelected((current) => {
      const next = new Set(current);
      for (const lesson of lessons) {
        if (allSelected) next.delete(lesson.relPath);
        else next.add(lesson.relPath);
      }
      return next;
    });
  };

  return (
    <>
      <div className="border-b border-hair px-5 py-5 lg:px-10">
        <nav className="flex items-center gap-2 text-xs text-ink-3">
          <Link to="/" className="transition hover:text-ink">
            Library
          </Link>
          <span>/</span>
          <span className="text-ink-2">Add course</span>
        </nav>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Add a course</h1>
        <p className="mt-2 text-sm text-ink-3">
          Choose a folder from your computer and StudySpace will organize it into a course.
        </p>
      </div>

      <div className="px-5 py-8 lg:px-10">
        <div className="max-w-3xl">

          {!scan ? (
            <section id="step-pick">
              <label className="field block" htmlFor="path-input">
                <span className="field-label mb-1.5 block text-xs text-ink-3">Folder path</span>
            <input
              id="path-input"
              ref={pathInput}
                  className="w-full rounded-xl border border-hair-strong bg-card px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50"
              type="text"
              placeholder="C:\Users\you\Videos\my-course"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runScan(path);
              }}
            />
              </label>

              {scanError ? (
                <div
                  className="alert alert-error mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400"
                  id="scan-error"
                >
                  {scanError}
                </div>
              ) : null}

              <div className="row-actions mb-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
                  id="scan-btn"
                  disabled={scanning}
                  onClick={() => runScan(path)}
                >
                  {scanning ? 'Scanning…' : 'Scan folder'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-hair-strong px-4 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04] disabled:opacity-40"
                  id="browse-btn"
                  onClick={onPickFolder}
                  disabled={picking}
                >
                  {picking ? 'Waiting for picker…' : 'Choose folder…'}
                </button>
                <Link
                  to="/"
                  className="rounded-xl px-4 py-2.5 text-sm text-ink-3 transition hover:bg-white/[0.04]"
                  id="back-btn"
                >
                  Cancel
                </Link>
              </div>

              <div
                className="dropzone rounded-2xl border-2 border-dashed border-hair-strong px-6 py-10 text-center transition hover:border-accent/50 hover:bg-accent-soft"
                tabIndex={0}
                onClick={() => pathInput.current?.focus()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('dragover');
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('dragover');
                  toast('Browsers cannot read a dropped folder path — use "Choose folder…" instead', {
                    timeout: 6000,
                  });
                }}
              >
                <p className="font-medium text-ink">
                  <strong>Drop a folder here</strong>
                </p>
                <p className="muted small mt-1 text-xs text-ink-3">
                  Browsers cannot read a dropped folder path — use “Choose folder…”, or paste the path
                  above.
                </p>
              </div>
            </section>
          ) : (
            <section id="step-review">
              <div className="panel overflow-hidden rounded-2xl border border-hair bg-card p-5">
                <div className="panel-title mb-4 flex items-center justify-between gap-3">
              <span>Ready to add</span>
                  <span className="muted small text-xs text-ink-3" id="review-total">
                {scan.total} lesson{scan.total === 1 ? '' : 's'}
              </span>
                </div>

                <label className="field mb-4 block" htmlFor="title-input">
                  <span className="field-label mb-1.5 block text-xs text-ink-3">Course title</span>
              <input
                id="title-input"
                    className="w-full rounded-xl border border-hair-strong bg-surface px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent/50"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
                </label>

            <div className="scan-summary mb-3 flex flex-wrap gap-2" id="scan-summary">
              {Object.entries(scan.counts ?? {}).map(([kind, count]) =>
                count ? (
                  <span
                    key={kind}
                    className="chip rounded-full border border-hair-strong bg-surface px-3 py-1 text-xs text-ink-2"
                  >
                    {count} {kind}
                  </span>
                ) : null
              )}
            </div>

            {scan.warnings?.length ? (
              <div
                className="alert alert-warn mb-4 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn"
                id="scan-warnings"
              >
                {scan.warnings.join(' ')}
              </div>
            ) : null}

            {scan.subfolders?.length ? (
              <div className="chip-row mb-4 flex flex-wrap gap-2" id="subfolders">
                {scan.subfolders.map((folder) => (
                  <button
                    type="button"
                    className="chip rounded-full border border-hair-strong bg-surface px-3 py-1 text-xs text-ink-2 transition hover:border-accent/50 hover:text-accent"
                    key={folder.path}
                    onClick={() => {
                      setPath(folder.path);
                      runScan(folder.path);
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              className="review-list scroll-thin max-h-[420px] overflow-y-auto rounded-xl border border-hair"
              id="review-list"
            >
              {groupLessons(scan.lessons).map((group) => (
                <div className="review-group" key={group.name || 'general'}>
                  <div className="review-group-title sticky top-0 z-10 bg-surface px-4 py-2.5">
                    <label className="review-item font-semibold" style={{ fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={group.lessons.every((l) => selected.has(l.relPath))}
                        onChange={() => toggleGroup(group.lessons)}
                      />
                      {group.name || 'Lessons'}
                    </label>
                  </div>
                  {group.lessons.map((lesson) => (
                    <label className="review-item" key={lesson.relPath}>
                      <input
                        type="checkbox"
                        checked={selected.has(lesson.relPath)}
                        onChange={() => toggleLesson(lesson.relPath)}
                      />
                      <span className="lesson-title flex-1 truncate">{lesson.title}</span>
                      {lesson.warn ? <span title={lesson.warn}>⚠</span> : null}
                      <span className="lesson-type text-[10px] uppercase tracking-wide text-ink-4">
                        {lesson.type}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="row-actions mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
              id="add-btn"
              disabled={adding}
              onClick={onAdd}
            >
              {adding ? 'Adding…' : `Add ${selected.size} lesson${selected.size === 1 ? '' : 's'}`}
            </button>
            <button
              type="button"
              className="rounded-xl border border-hair-strong px-4 py-2.5 text-sm text-ink-2 transition hover:bg-white/[0.04]"
              id="back-btn"
              onClick={back}
            >
              Back
            </button>
          </div>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
