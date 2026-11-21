import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { scanFolder, createCourse } from '../api/courses.js';
import { browse } from '../api/browse.js';
import { useToast } from '../components/Toaster.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import Modal from '../components/Modal.jsx';

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
  const [browseOpen, setBrowseOpen] = useState(false);
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
        if (ok) navigate(`/courses/${err.data.existingId}`);
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
      <div className="crumbs">
        <Link to="/">Library</Link>
        <span>/</span>
        <span>Add course</span>
      </div>

      <h1>Add a course</h1>

      {!scan ? (
        <section id="step-pick">
          <label className="field" htmlFor="path-input">
            <span className="field-label">Folder path</span>
            <input
              id="path-input"
              ref={pathInput}
              className="input"
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
            <div className="alert alert-error" id="scan-error">
              {scanError}
            </div>
          ) : null}

          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              id="scan-btn"
              disabled={scanning}
              onClick={() => runScan(path)}
            >
              {scanning ? 'Scanning…' : 'Scan folder'}
            </button>
            <button type="button" className="btn" id="browse-btn" onClick={() => setBrowseOpen(true)}>
              Browse…
            </button>
            <Link to="/" className="btn btn-ghost" id="back-btn">
              Cancel
            </Link>
          </div>

          <div
            className="dropzone"
            id="dropzone"
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
              toast('Browsers cannot read a dropped folder path — paste it in the field above', {
                timeout: 6000,
              });
            }}
          >
            <p>
              <strong>Drop a folder here</strong>
            </p>
            <p className="muted small">
              Browsers cannot read a dropped folder path — paste it in the field above.
            </p>
          </div>
        </section>
      ) : (
        <section id="step-review">
          <div className="panel">
            <div className="panel-title">
              <span>Ready to add</span>
              <span className="muted small" id="review-total">
                {scan.total} lesson{scan.total === 1 ? '' : 's'}
              </span>
            </div>

            <label className="field" htmlFor="title-input">
              <span className="field-label">Course title</span>
              <input
                id="title-input"
                className="input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <div className="scan-summary" id="scan-summary">
              {Object.entries(scan.counts ?? {}).map(([kind, count]) =>
                count ? (
                  <span key={kind} className="chip">
                    {count} {kind}
                  </span>
                ) : null
              )}
            </div>

            {scan.warnings?.length ? (
              <div className="alert alert-warn" id="scan-warnings">
                {scan.warnings.join(' ')}
              </div>
            ) : null}

            {scan.subfolders?.length ? (
              <div className="chip-row" id="subfolders" style={{ marginBottom: '1rem' }}>
                {scan.subfolders.map((folder) => (
                  <button
                    type="button"
                    className="chip"
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

            <div className="review-list" id="review-list">
              {groupLessons(scan.lessons).map((group) => (
                <div className="review-group" key={group.name || 'general'}>
                  <div className="review-group-title">
                    <label className="review-item" style={{ fontWeight: 600 }}>
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
                      <span className="lesson-title">{lesson.title}</span>
                      {lesson.warn ? <span title={lesson.warn}>⚠</span> : null}
                      <span className="lesson-type">{lesson.type}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              id="add-btn"
              disabled={adding}
              onClick={onAdd}
            >
              {adding ? 'Adding…' : `Add ${selected.size} lesson${selected.size === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="btn" id="back-btn" onClick={back}>
              Back
            </button>
          </div>
        </section>
      )}

      {browseOpen ? (
        <BrowseModal
          onClose={() => setBrowseOpen(false)}
          onChoose={(chosenPath) => {
            setPath(chosenPath);
            setBrowseOpen(false);
            runScan(chosenPath);
          }}
        />
      ) : null}
    </>
  );
}

/** A folder picker backed by the /api/browse endpoint. */
function BrowseModal({ onClose, onChoose }) {
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState('');

  const load = async (target) => {
    setLoading(true);
    setError('');
    try {
      const result = await browse(target);
      setCurrent(result);
    } catch (err) {
      setError(err.data?.detail ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
  }, []);

  return (
    <Modal title="Browse for a folder" onClose={onClose} size="lg">
      <div className="browse-roots" id="browse-roots">
        {(current?.roots ?? []).map((root) => (
          <button
            type="button"
            className="btn btn-sm"
            key={root.path}
            title={root.path}
            onClick={() => load(root.path)}
          >
            {root.name}
          </button>
        ))}
      </div>

      <div className="breadcrumbs" id="breadcrumbs">
        <button
          type="button"
          disabled={!current?.parent}
          onClick={() => current?.parent && load(current.parent)}
        >
          ↑ Up
        </button>
        {(current?.breadcrumbs ?? []).map((crumb, i) => (
          <span key={crumb.path}>
            <button type="button" onClick={() => load(crumb.path)}>
              {crumb.name}
            </button>
            {i < current.breadcrumbs.length - 1 ? ' / ' : ''}
          </span>
        ))}
      </div>

      <div className="browse-list" id="browse-list">
        {loading ? (
          <p className="muted small" style={{ padding: '.6rem' }}>
            Loading…
          </p>
        ) : error ? (
          <p className="muted small" style={{ padding: '.6rem' }}>
            {error}
          </p>
        ) : (current?.dirs?.length ?? 0) + (current?.files?.length ?? 0) === 0 ? (
          <p className="muted small" style={{ padding: '.6rem' }}>
            This folder is empty.
          </p>
        ) : (
          <>
            {(current?.dirs ?? []).map((dir) => (
              <div
                className="browse-row"
                key={dir.path}
                role="button"
                tabIndex={0}
                onClick={() => load(dir.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load(dir.path);
                }}
              >
                <span className="icon">📁</span>
                <span className="name">{dir.name}</span>
              </div>
            ))}
            {(current?.files ?? []).map((file) => (
              <div
                className="browse-row"
                key={file.path}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setChosen(file.path);
                  onChoose(file.path);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setChosen(file.path);
                    onChoose(file.path);
                  }
                }}
              >
                <span className="icon">🎬</span>
                <span className="name">{file.name}</span>
                <span className="tag">file</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="modal-foot">
        <span className="muted small" id="browse-current">
          {current?.path ?? ''}
        </span>
        <div className="row-actions">
          <button type="button" className="btn" id="browse-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            id="browse-choose"
            disabled={!current?.path}
            onClick={() => onChoose(chosen || current.path)}
          >
            Choose folder
          </button>
        </div>
      </div>
    </Modal>
  );
}
