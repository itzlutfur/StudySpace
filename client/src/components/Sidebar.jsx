import { NavLink } from 'react-router';

import useTheme from '../hooks/useTheme.js';
import {
  IconBook,
  IconClock,
  IconDashboard,
  IconLogo,
  IconMoon,
  IconSettings,
  IconSun,
} from './icons.jsx';

/**
 * The navigation groups, matching the reference sidebar.
 *
 * "Recently Played" has no page of its own — it points at the dashboard's
 * "Recently Opened" section, which is where the reference design puts it.
 */
const WORKSPACE = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/courses', label: 'My Courses', icon: IconBook },
  { to: '/?section=recent', label: 'Recently Played', icon: IconClock },
];

const PREFERENCES = [{ to: '/settings', label: 'Settings', icon: IconSettings }];

/** One navigation link. `end` marks a link that must match exactly. */
function NavItem({ to, label, icon: Glyph, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink'
        }`
      }
    >
      <Glyph size={18} />
      {label}
    </NavLink>
  );
}

/**
 * The persistent left sidebar: brand, navigation and the local-library
 * status panel.
 */
export default function Sidebar({ onNavigate }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
          <IconLogo size={24} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">StudySpace</h1>
          <p className="text-xs text-ink-3">Your personal library</p>
        </div>
      </div>

      <div className="mt-10">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
          Workspace
        </p>
        <nav className="space-y-1">
          {WORKSPACE.map((item) => (
            <NavItem key={item.label} {...item} onClick={onNavigate} />
          ))}
        </nav>
      </div>

      <div className="mt-9">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-4">
          Preferences
        </p>
        <nav className="space-y-1">
          {PREFERENCES.map((item) => (
            <NavItem key={item.label} {...item} onClick={onNavigate} />
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-2xl border border-hair bg-raised p-4">
        <div className="flex items-center gap-2 text-xs text-ok">
          <span className="h-2 w-2 rounded-full bg-ok" />
          Local library
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-3">
          Your courses and progress stay on your device.
        </p>

        <button
          type="button"
          id="theme-toggle"
          className="mt-3 flex w-full items-center gap-2 rounded-lg border border-hair px-3 py-2 text-xs text-ink-2 transition hover:bg-white/[0.04]"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={toggle}
        >
          <span className="theme-icon-dark">
            <IconMoon size={14} />
          </span>
          <span className="theme-icon-light">
            <IconSun size={14} />
          </span>
          {theme === 'light' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>
    </div>
  );
}
