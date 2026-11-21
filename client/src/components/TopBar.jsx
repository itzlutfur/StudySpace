import { Link } from 'react-router';

import useTheme from '../hooks/useTheme.js';

/** The sticky application bar: brand, theme toggle and "Add course". */
export default function TopBar() {
  const { theme, toggle } = useTheme();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">▶</span>
        <span className="brand-name">CourseStream</span>
      </Link>
      <div className="topbar-actions">
        <button
          type="button"
          className="btn btn-ghost"
          id="theme-toggle"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={toggle}
        >
          <span className="theme-icon-dark">☾</span>
          <span className="theme-icon-light">☀</span>
        </button>
        <Link to="/courses/add" className="btn btn-primary">
          + Add Course
        </Link>
      </div>
    </header>
  );
}
