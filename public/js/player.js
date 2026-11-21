/* Player: resume, autosave progress, bookmarks, notes, shortcuts. */

(() => {
  const layout = document.getElementById('player-layout');
  if (!layout) return;

  const lessonId = Number(layout.dataset.lessonId);
  const media = document.getElementById('media');
  const resumeBanner = document.getElementById('resume-banner');
  const resumeBtn = document.getElementById('resume-btn');
  const startOverBtn = document.getElementById('start-over-btn');
  const completeBtn = document.getElementById('complete-btn');
  const bookmarkList = document.getElementById('bookmark-list');
  const bookmarkCount = document.getElementById('bookmark-count');
  const addBookmarkBtn = document.getElementById('add-bookmark-btn');
  const notes = document.getElementById('notes');
  const notesStatus = document.getElementById('notes-status');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  const startPos = Number(layout.dataset.position) || 0;
  const offerResume = layout.dataset.offerResume === '1';
  const wantsResume = new URLSearchParams(window.location.search).get('resume') === '1';

  /* ---------------- resume ---------------- */

  function applyResume() {
    if (!media || !offerResume || !wantsResume) return;
    const seek = () => {
      if (startPos > 0 && Number.isFinite(media.duration)) {
        media.currentTime = startPos;
      }
    };
    if (media.readyState >= 1) seek();
    else media.addEventListener('loadedmetadata', seek, { once: true });
  }

  if (resumeBanner && offerResume) {
    resumeBtn?.addEventListener('click', async () => {
      resumeBanner.hidden = true;
      applyResume();
      try {
        await media?.play();
      } catch { /* autoplay may be blocked */ }
    });
    startOverBtn?.addEventListener('click', () => {
      resumeBanner.hidden = true;
      if (media) media.currentTime = 0;
    });
  } else {
    applyResume();
  }

  /* ---------------- progress autosave ---------------- */

  const SAVE_INTERVAL_MS = 5000;
  let lastSaved = 0;
  let saveTimer = null;

  async function saveProgress() {
    if (!media || !Number.isFinite(media.currentTime)) return;
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    lastSaved = media.currentTime;
    try {
      await CS.api(`/api/progress/${lessonId}`, {
        method: 'POST',
        body: { position: media.currentTime, duration },
      });
    } catch { /* transient — retried on the next tick */ }
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (Math.abs((media?.currentTime ?? 0) - lastSaved) < 1) return;
      await saveProgress();
    }, SAVE_INTERVAL_MS);
  }

  if (media) {
    media.addEventListener('timeupdate', scheduleSave);
    media.addEventListener('pause', saveProgress);
    media.addEventListener('ended', async () => {
      await saveProgress();
      await CS.api(`/api/progress/${lessonId}/complete`, {
        method: 'POST',
        body: { completed: true },
      });
      CS.toast('Lesson marked complete');
      updateCompleteButton(true);
    });

    // Flush the position when the tab is closed — survives a hard kill.
    window.addEventListener('pagehide', () => {
      if (!media || !Number.isFinite(media.currentTime)) return;
      const payload = JSON.stringify({
        position: media.currentTime,
        duration: Number.isFinite(media.duration) ? media.duration : 0,
      });
      navigator.sendBeacon?.(
        `/api/progress/${lessonId}`,
        new Blob([payload], { type: 'application/json' })
      );
    });
  }

  /* ---------------- complete toggle ---------------- */

  function updateCompleteButton(isComplete) {
    if (!completeBtn) return;
    completeBtn.textContent = isComplete ? 'Completed ✓' : 'Mark complete';
    completeBtn.classList.toggle('btn-primary', !isComplete);
  }

  completeBtn?.addEventListener('click', async () => {
    const nowComplete = !completeBtn.classList.contains('btn-primary');
    try {
      await CS.api(`/api/progress/${lessonId}/complete`, {
        method: 'POST',
        body: { completed: nowComplete },
      });
      updateCompleteButton(nowComplete);
      CS.toast(nowComplete ? 'Marked complete' : 'Marked incomplete');
    } catch (err) {
      CS.toast(err.message, { type: 'error' });
    }
  });

  /* ---------------- bookmarks ---------------- */

  function currentTime() {
    return media && Number.isFinite(media.currentTime) ? media.currentTime : 0;
  }

  async function loadBookmarks() {
    try {
      const data = await CS.api(`/api/progress/${lessonId}/bookmarks`);
      renderBookmarks(data.bookmarks ?? []);
    } catch { /* non-critical */ }
  }

  function renderBookmarks(bookmarks) {
    bookmarkList.innerHTML = '';
    if (bookmarkCount) bookmarkCount.textContent = bookmarks.length;

    if (!bookmarks.length) {
      const empty = document.createElement('li');
      empty.className = 'bookmark-empty';
      empty.textContent = 'No bookmarks yet. Add one to jump back here later.';
      bookmarkList.appendChild(empty);
      return;
    }

    for (const bm of bookmarks) {
      const item = document.createElement('li');
      item.className = 'bookmark-item';

      const time = document.createElement('button');
      time.className = 'bookmark-time';
      time.textContent = CS.formatTime(bm.timestamp);
      time.title = 'Jump to this point';
      time.addEventListener('click', () => {
        if (media) {
          media.currentTime = bm.timestamp;
          media.play().catch(() => {});
        }
      });

      const label = document.createElement('span');
      label.className = 'bookmark-label';
      label.textContent = bm.label || '(no label)';

      const edit = document.createElement('button');
      edit.className = 'bookmark-edit';
      edit.value = bm.label ?? '';
      edit.placeholder = 'Add a label…';
      edit.hidden = true;

      const rename = document.createElement('button');
      rename.className = 'bookmark-time';
      rename.textContent = '✎';
      rename.title = 'Rename bookmark';
      rename.addEventListener('click', () => {
        const showing = !edit.hidden;
        edit.hidden = showing;
        label.hidden = !showing;
        rename.textContent = showing ? '✎' : '✓';
        if (!showing) edit.focus();
      });

      const save = async () => {
        edit.hidden = true;
        label.hidden = false;
        rename.textContent = '✎';
        try {
          await CS.api(`/api/progress/${lessonId}/bookmarks/${bm.id}`, {
            method: 'PATCH',
            body: { label: edit.value },
          });
          label.textContent = edit.value || '(no label)';
        } catch (err) {
          CS.toast(err.message, { type: 'error' });
        }
      };
      edit.addEventListener('blur', save);
      edit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          edit.value = bm.label ?? '';
          edit.hidden = true;
          label.hidden = false;
          rename.textContent = '✎';
        }
      });

      const del = document.createElement('button');
      del.className = 'bookmark-del';
      del.textContent = '×';
      del.title = 'Delete bookmark';
      del.addEventListener('click', async () => {
        try {
          await CS.api(`/api/progress/${lessonId}/bookmarks/${bm.id}`, { method: 'DELETE' });
          loadBookmarks();
        } catch (err) {
          CS.toast(err.message, { type: 'error' });
        }
      });

      item.append(time, label, edit, rename, del);
      bookmarkList.appendChild(item);
    }
  }

  addBookmarkBtn?.addEventListener('click', async () => {
    const timestamp = currentTime();
    try {
      await CS.api(`/api/progress/${lessonId}/bookmarks`, {
        method: 'POST',
        body: { timestamp, label: '' },
      });
      loadBookmarks();
      CS.toast(`Bookmark added at ${CS.formatTime(timestamp)}`);
    } catch (err) {
      CS.toast(err.message, { type: 'error' });
    }
  });

  /* ---------------- notes ---------------- */

  let notesTimer = null;
  notes?.addEventListener('input', () => {
    notesStatus.textContent = 'Saving…';
    if (notesTimer) clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      try {
        await CS.api(`/api/progress/${lessonId}/notes`, {
          method: 'PUT',
          body: { body: notes.value },
        });
        notesStatus.textContent = 'Saved ✓';
      } catch {
        notesStatus.textContent = 'Save failed';
      }
    }, 800);
  });

  /* ---------------- text lessons ---------------- */

  const textLesson = document.getElementById('text-lesson');
  if (textLesson) {
    fetch(textLesson.dataset.src)
      .then((r) => r.text())
      .then((text) => {
        const isHtml = /\.html?$/i.test(textLesson.dataset.src);
        if (isHtml) {
          // The file is the user's own local content; render it in a sandboxed
          // frame rather than injecting it into this document.
          const frame = document.createElement('iframe');
          frame.className = 'doc-frame';
          frame.setAttribute('sandbox', '');
          frame.srcdoc = text;
          textLesson.replaceWith(frame);
          return;
        }
        textLesson.innerHTML = renderMarkdown(text);
      })
      .catch(() => {
        textLesson.textContent = 'Could not load this lesson file.';
      });
  }

  /** Minimal markdown renderer — headings, bold, italic, code, lists, links. */
  function renderMarkdown(md) {
    const escape = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const blocks = escape(md)
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return '';

        const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
        if (heading) {
          const level = Math.min(6, heading[1].length + 1);
          return `<h${level}>${inline(heading[2])}</h${level}>`;
        }

        if (/^```/.test(trimmed)) {
          const body = trimmed.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
          return `<pre><code>${body}</code></pre>`;
        }

        const lines = trimmed.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
          return `<ul>${items}</ul>`;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          const items = lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
          return `<ol>${items}</ol>`;
        }

        return `<p>${inline(trimmed).replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    return blocks;
  }

  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noreferrer noopener">$1</a>');
  }

  /* ---------------- keyboard shortcuts ---------------- */

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
        document.getElementById('next-btn')?.click();
        break;
      case 'p':
        document.getElementById('prev-btn')?.click();
        break;
      default:
        break;
    }
  });

  /* ---------------- sidebar ---------------- */

  sidebarToggle?.addEventListener('click', () => {
    layout.classList.toggle('sidebar-hidden');
  });

  /* ---------------- init ---------------- */

  loadBookmarks();

  CS.api(`/api/progress/${lessonId}`)
    .then((data) => {
      if (data.completed) updateCompleteButton(true);
    })
    .catch(() => {});
})();
