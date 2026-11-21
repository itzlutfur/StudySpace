/* Shared helpers used across pages. */

window.CS = (() => {
  /** Show a toast. `action` may be { label, onClick }. */
  function toast(message, { type = 'ok', timeout = 4000, action = null } = {}) {
    const host = document.getElementById('toast-host');
    if (!host) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span></span>`;
    el.querySelector('span').textContent = message;

    if (action) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        action.onClick();
        el.remove();
      });
      el.appendChild(btn);
    }

    host.appendChild(el);
    if (timeout) setTimeout(() => el.remove(), timeout);
    return el;
  }

  /** JSON fetch with consistent error handling. */
  async function api(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const err = new Error(data?.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /** Format seconds as m:ss or h:mm:ss. */
  function formatTime(totalSeconds) {
    const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  /** Escape text for safe insertion into innerHTML. */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** A reusable confirmation modal. Resolves true/false. */
  function confirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let backdrop = document.getElementById('confirm-modal');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'confirm-modal';
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `
          <div class="modal" role="dialog" aria-modal="true">
            <div class="modal-head"><h2></h2></div>
            <div class="modal-body"><p data-message></p><p class="muted small" data-detail></p></div>
            <div class="modal-foot">
              <div class="row-actions">
                <button class="btn" data-cancel>Cancel</button>
                <button class="btn btn-primary" data-ok></button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(backdrop);
      }

      const okBtn = backdrop.querySelector('[data-ok]');
      const cancelBtn = backdrop.querySelector('[data-cancel]');
      backdrop.querySelector('h2').textContent = title;
      backdrop.querySelector('[data-message]').textContent = message;
      backdrop.querySelector('[data-detail]').textContent = '';
      okBtn.textContent = confirmLabel;
      okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

      backdrop.hidden = false;

      const finish = (result) => {
        backdrop.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (e) => {
        if (e.key === 'Escape') finish(false);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
      okBtn.focus();
    });
  }

  /* ---------------- theme ---------------- */

  const THEME_KEY = 'coursestream.theme';

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
    }
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', async () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      try {
        await api('/api/settings/theme', { method: 'POST', body: { theme: next } });
      } catch { /* persistence is best-effort */ }
    });
  }

  /* ---------------- menus ---------------- */

  function initMenus() {
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-menu-toggle]');
      const openMenus = document.querySelectorAll('.menu:not([hidden])');

      if (toggle) {
        e.preventDefault();
        const menu = document.querySelector(`[data-menu="${toggle.dataset.menuToggle}"]`);
        if (menu) {
          const willOpen = menu.hidden;
          openMenus.forEach((m) => { m.hidden = true; });
          menu.hidden = !willOpen;
        }
        return;
      }
      if (!e.target.closest('.menu')) {
        openMenus.forEach((m) => { m.hidden = true; });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMenus();
  });

  return { toast, api, formatTime, escapeHtml, confirmModal };
})();
