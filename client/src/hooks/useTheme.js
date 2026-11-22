import { useCallback, useEffect, useState } from 'react';

import { saveTheme } from '../api/courses.js';

const STORAGE_KEY = 'coursestream.theme';

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * The colour theme. The stored preference wins over the server default, and
 * the choice is persisted both locally and server-side.
 */
export default function useTheme() {
  const [theme, setThemeState] = useState(() => readStoredTheme() || 'dark');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  /** Set an explicit theme, persisting it locally and server-side. */
  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark';
    setThemeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage may be unavailable (private mode) — the theme still applies.
    }
    saveTheme(value).catch(() => {
      // Persisting server-side is best-effort.
    });
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage may be unavailable (private mode) — the theme still applies.
      }
      saveTheme(next).catch(() => {
        // Persisting server-side is best-effort.
      });
      return next;
    });
  }, []);

  return { theme, toggle, setTheme };
}

/** Apply a theme that came from the server (used when nothing is stored). */
export function useServerTheme(serverTheme) {
  const stored = readStoredTheme();
  const [theme, setTheme] = useState(stored || serverTheme || 'dark');

  useEffect(() => {
    if (!stored && serverTheme) setTheme(serverTheme);
  }, [stored, serverTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
