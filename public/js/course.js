/* Course detail page: rescan, remove. */

(() => {
  const rescanBtn = document.getElementById('rescan-btn');
  const removeBtn = document.getElementById('remove-btn');
  const modal = document.getElementById('confirm-modal');

  rescanBtn?.addEventListener('click', async () => {
    rescanBtn.disabled = true;
    rescanBtn.textContent = 'Scanning…';
    try {
      const courseId = window.location.pathname.split('/').filter(Boolean).pop();
      const result = await CS.api(`/api/courses/${courseId}/rescan`, { method: 'POST' });
      const parts = [];
      if (result.added?.length) parts.push(`${result.added.length} added`);
      if (result.missing?.length) parts.push(`${result.missing.length} missing`);
      if (result.changed?.length) parts.push(`${result.changed.length} restored`);
      CS.toast(parts.length ? `Rescan complete — ${parts.join(', ')}` : 'Rescan complete — no changes');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      CS.toast(err.message, { type: 'error', timeout: 7000 });
      rescanBtn.disabled = false;
      rescanBtn.textContent = 'Rescan';
    }
  });

  removeBtn?.addEventListener('click', () => {
    const title = document.querySelector('h1')?.textContent ?? 'this course';
    const ok = window.confirm(
      `Remove "${title}" from your library?\n\nIts progress, bookmarks and notes will be deleted. The files on disk are not touched.`
    );
    if (!ok) return;

    const courseId = window.location.pathname.split('/').filter(Boolean).pop();
    CS.api(`/api/courses/${courseId}`, { method: 'DELETE' })
      .then((result) => {
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
        setTimeout(() => { window.location.href = '/'; }, 1200);
      })
      .catch((err) => CS.toast(err.message, { type: 'error' }));
  });
})();
