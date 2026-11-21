/* Add course: pick a folder -> scan -> review -> add to library. */

(() => {
  const pathInput = document.getElementById('path-input');
  const scanBtn = document.getElementById('scan-btn');
  const browseBtn = document.getElementById('browse-btn');
  const backBtn = document.getElementById('back-btn');
  const addBtn = document.getElementById('add-btn');
  const errorBox = document.getElementById('scan-error');
  const stepPick = document.getElementById('step-pick');
  const stepReview = document.getElementById('step-review');
  const titleInput = document.getElementById('title-input');
  const reviewList = document.getElementById('review-list');
  const reviewTotal = document.getElementById('review-total');
  const scanSummary = document.getElementById('scan-summary');
  const scanWarnings = document.getElementById('scan-warnings');
  const subfoldersBox = document.getElementById('subfolders');
  const subfolderList = document.getElementById('subfolder-list');
  const dropzone = document.getElementById('dropzone');

  /** The current scan result, kept so we can submit the reviewed selection. */
  let scan = null;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
  }

  /* ---------------- scan ---------------- */

  async function runScan(targetPath) {
    clearError();
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning…';

    try {
      const result = await CS.api('/api/courses/scan', {
        method: 'POST',
        body: { path: targetPath },
      });
      scan = result;
      renderReview(result);
    } catch (err) {
      scan = null;
      showError(err.data?.detail ? `${err.message} — ${err.data.detail}` : err.message);
      stepReview.hidden = true;
      stepPick.hidden = false;
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan folder';
    }
  }

  /* ---------------- review screen ---------------- */

  function renderReview(result) {
    titleInput.value = result.title ?? '';
    reviewTotal.textContent = `${result.total} lesson${result.total === 1 ? '' : 's'}`;

    const { video, audio, document, text } = result.counts ?? {};
    scanSummary.innerHTML = '';
    const chips = [
      video ? `${video} video` : null,
      audio ? `${audio} audio` : null,
      document ? `${document} document` : null,
      text ? `${text} text` : null,
    ].filter(Boolean);
    for (const chip of chips) {
      const span = document.createElement('span');
      span.textContent = chip;
      scanSummary.appendChild(span);
    }

    if (result.warnings?.length) {
      scanWarnings.textContent = result.warnings.join(' ');
      scanWarnings.hidden = false;
    } else {
      scanWarnings.hidden = true;
    }

    // Group lessons by section.
    const groups = new Map();
    for (const lesson of result.lessons) {
      const key = lesson.section ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(lesson);
    }

    reviewList.innerHTML = '';
    for (const [section, lessons] of groups) {
      const group = document.createElement('div');
      group.className = 'review-group';

      const title = document.createElement('div');
      title.className = 'review-group-title';
      title.textContent = section || 'Lessons';
      group.appendChild(title);

      for (const lesson of lessons) {
        const item = document.createElement('label');
        item.className = 'review-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.dataset.rel = lesson.relPath;

        const name = document.createElement('span');
        name.className = 'lesson-title';
        name.textContent = lesson.title;

        const type = document.createElement('span');
        type.className = 'lesson-type';
        type.textContent = lesson.type;

        item.append(cb, name, type);

        if (lesson.warn) {
          const warn = document.createElement('span');
          warn.className = 'warn small';
          warn.textContent = '⚠';
          warn.title = lesson.warn;
          item.appendChild(warn);
        }
        group.appendChild(item);
      }
      reviewList.appendChild(group);
    }

    // Offer subfolders as separate courses.
    if (result.subfolders?.length) {
      subfolderList.innerHTML = '';
      for (const sub of result.subfolders) {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.type = 'button';
        chip.textContent = sub.name;
        chip.title = sub.path;
        chip.addEventListener('click', () => {
          pathInput.value = sub.path;
          runScan(sub.path);
        });
        subfolderList.appendChild(chip);
      }
      subfoldersBox.hidden = false;
    } else {
      subfoldersBox.hidden = true;
    }

    stepPick.hidden = true;
    stepReview.hidden = false;
    stepReview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- add ---------------- */

  addBtn.addEventListener('click', async () => {
    if (!scan) return;
    const selected = [...reviewList.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.dataset.rel);
    if (!selected.length) {
      CS.toast('Select at least one lesson', { type: 'error' });
      return;
    }

    const title = titleInput.value.trim() || scan.title;
    addBtn.disabled = true;
    addBtn.textContent = 'Adding…';

    try {
      const result = await CS.api('/api/courses', {
        method: 'POST',
        body: { title, path: scan.root, lessons: selected },
      });
      CS.toast(`Added "${result.course.title}" — ${result.course.lessonCount} lessons`, { timeout: 3000 });
      setTimeout(() => { window.location.href = '/'; }, 700);
    } catch (err) {
      addBtn.disabled = false;
      addBtn.textContent = 'Add to library';
      if (err.status === 409) {
        const open = window.confirm(
          `${err.message}\n\nOpen the existing course instead?`
        );
        if (open && err.data?.existingId) {
          window.location.href = `/courses/${err.data.existingId}`;
        }
        return;
      }
      CS.toast(err.message, { type: 'error', timeout: 7000 });
    }
  });

  backBtn.addEventListener('click', () => {
    stepReview.hidden = true;
    stepPick.hidden = false;
    scan = null;
  });

  /* ---------------- inputs ---------------- */

  scanBtn.addEventListener('click', () => {
    const value = pathInput.value.trim();
    if (!value) {
      showError('Enter a folder path first.');
      pathInput.focus();
      return;
    }
    runScan(value);
  });

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      scanBtn.click();
    }
  });

  /* ---------------- drag & drop ---------------- */

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      // Browsers do not expose a dropped folder's path — guide the user instead
      // of silently failing.
      pathInput.focus();
      CS.toast('Browsers cannot read a dropped folder path — paste it in the field above', { timeout: 6000 });
    });
    dropzone.addEventListener('click', () => pathInput.focus());
  }

  /* ---------------- folder picker ---------------- */

  const modal = document.getElementById('browse-modal');
  const listEl = document.getElementById('browse-list');
  const crumbsEl = document.getElementById('breadcrumbs');
  const rootsEl = document.getElementById('browse-roots');
  const currentEl = document.getElementById('browse-current');
  let browsePath = null;

  async function loadFolder(targetPath) {
    try {
      const data = await CS.api(`/api/browse?path=${encodeURIComponent(targetPath)}`);
      browsePath = data.path;
      currentEl.textContent = data.path;

      // Roots
      rootsEl.innerHTML = '';
      for (const root of data.roots ?? []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = root.name;
        btn.title = root.path;
        btn.addEventListener('click', () => loadFolder(root.path));
        rootsEl.appendChild(btn);
      }

      // Breadcrumbs
      crumbsEl.innerHTML = '';
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.textContent = '↑ Up';
      upBtn.disabled = !data.parent;
      upBtn.addEventListener('click', () => data.parent && loadFolder(data.parent));
      crumbsEl.appendChild(upBtn);

      crumbsEl.appendChild(document.createTextNode(' '));
      for (const crumb of data.breadcrumbs ?? []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = crumb.name;
        btn.addEventListener('click', () => loadFolder(crumb.path));
        crumbsEl.append(btn);
        crumbsEl.appendChild(document.createTextNode(' / '));
      }

      // Listing
      listEl.innerHTML = '';
      if (!data.dirs?.length && !data.files?.length) {
        const empty = document.createElement('div');
        empty.className = 'browse-row muted';
        empty.textContent = 'This folder is empty.';
        listEl.appendChild(empty);
      }

      for (const dir of data.dirs ?? []) {
        const row = document.createElement('div');
        row.className = 'browse-row';
        row.innerHTML = `<span class="icon">📁</span><span class="name"></span><span class="tag">folder</span>`;
        row.querySelector('.name').textContent = dir.name;
        row.title = dir.path;
        row.addEventListener('click', () => loadFolder(dir.path));
        listEl.appendChild(row);
      }

      for (const file of data.files ?? []) {
        const row = document.createElement('div');
        row.className = 'browse-row';
        row.innerHTML = `<span class="icon">🎬</span><span class="name"></span><span class="tag">media</span>`;
        row.querySelector('.name').textContent = file.name;
        row.title = file.path;
        row.addEventListener('click', () => {
          pathInput.value = file.path;
          browseChoose();
        });
        listEl.appendChild(row);
      }
    } catch (err) {
      listEl.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'browse-row muted';
      msg.textContent = err.data?.detail ?? err.message;
      listEl.appendChild(msg);
    }
  }

  function browseChoose() {
    if (!browsePath) return;
    pathInput.value = browsePath;
    modal.hidden = true;
    runScan(browsePath);
  }

  browseBtn.addEventListener('click', () => {
    modal.hidden = false;
    loadFolder(pathInput.value.trim() || undefined);
  });
  document.getElementById('browse-close')?.addEventListener('click', () => { modal.hidden = true; });
  document.getElementById('browse-cancel')?.addEventListener('click', () => { modal.hidden = true; });
  document.getElementById('browse-choose')?.addEventListener('click', browseChoose);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) modal.hidden = true;
  });

  /* ---------------- remove modal (shared with course page) ---------------- */

  document.getElementById('confirm-ok')?.addEventListener('click', async () => {
    document.getElementById('confirm-modal').hidden = true;
  });
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('confirm-modal').hidden = true;
  });
})();
