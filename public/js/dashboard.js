/* Dashboard: filtering, sorting, rename, rescan, remove with undo. */

(() => {
  const grid = document.getElementById('course-grid');
  const search = document.getElementById('course-search');
  const sortSelect = document.getElementById('course-sort');
  const noMatch = document.getElementById('no-match');

  const SORT_KEY = 'coursestream.sort';

  /* ---------- filter + sort ---------- */

  function applyFilterAndSort() {
    if (!grid) return;
    const term = (search?.value ?? '').trim().toLowerCase();
    const mode = sortSelect?.value ?? 'recent';
    const cards = [...grid.querySelectorAll('.course-card')];

    let visible = 0;
    for (const card of cards) {
      const title = card.dataset.title ?? '';
      const matches = !term || title.includes(term);
      card.hidden = !matches;
      if (matches) visible += 1;
    }

    const sorted = cards.sort((a, b) => {
      if (mode === 'name') return (a.dataset.title ?? '').localeCompare(b.dataset.title ?? '');
      if (mode === 'progress') return Number(b.dataset.percent ?? 0) - Number(a.dataset.percent ?? 0);
      return String(b.dataset.last ?? '').localeCompare(String(a.dataset.last ?? ''));
    });
    sorted.forEach((c) => grid.appendChild(c));

    if (noMatch) noMatch.hidden = visible > 0;
  }

  search?.addEventListener('input', applyFilterAndSort);
  sortSelect?.addEventListener('change', () => {
    localStorage.setItem(SORT_KEY, sortSelect.value);
    applyFilterAndSort();
  });

  const storedSort = localStorage.getItem(SORT_KEY);
  if (storedSort && sortSelect) sortSelect.value = storedSort;
  applyFilterAndSort();

  /* ---------- course actions ---------- */

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'rename') {
      const card = btn.closest('.course-card');
      const current = card?.querySelector('h3')?.textContent ?? '';
      const next = window.prompt('Course title:', current);
      if (next === null) return;
      const title = next.trim();
      if (!title) return;
      try {
        await CS.api(`/api/courses/${id}`, { method: 'PATCH', body: { title } });
        CS.toast('Course renamed');
        setTimeout(() => window.location.reload(), 400);
      } catch (err) {
        CS.toast(err.message, { type: 'error' });
      }
      return;
    }

    if (action === 'rescan') {
      try {
        const result = await CS.api(`/api/courses/${id}/rescan`, { method: 'POST' });
        const parts = [];
        if (result.added?.length) parts.push(`${result.added.length} added`);
        if (result.missing?.length) parts.push(`${result.missing.length} missing`);
        if (result.changed?.length) parts.push(`${result.changed.length} restored`);
        CS.toast(parts.length ? `Rescan complete — ${parts.join(', ')}` : 'Rescan complete — no changes');
        setTimeout(() => window.location.reload(), 700);
      } catch (err) {
        CS.toast(err.message, { type: 'error', timeout: 7000 });
      }
      return;
    }

    if (action === 'remove') {
      const title = btn.dataset.title ?? 'this course';
      const ok = await CS.confirmModal({
        title: 'Remove course?',
        message: `Remove "${title}" from your library?`,
        detail: 'This deletes its progress, bookmarks and notes. The files on disk are not touched.',
        confirmLabel: 'Remove course',
        danger: true,
      });
      if (!ok) return;

      try {
        const result = await CS.api(`/api/courses/${id}`, { method: 'DELETE' });
        const card = btn.closest('.course-card');
        card?.remove();
        CS.toast(`Removed "${title}"`, {
          timeout: 6000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await CS.api('/api/courses/restore', { method: 'POST', body: { snapshot: result.snapshot } });
                CS.toast('Course restored');
                setTimeout(() => window.location.reload(), 500);
              } catch (err) {
                CS.toast(err.message, { type: 'error' });
              }
            },
          },
        });
        if (!grid?.querySelector('.course-card')) window.location.reload();
      } catch (err) {
        CS.toast(err.message, { type: 'error' });
      }
    }
  });
})();
