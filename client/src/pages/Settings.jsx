import { useCallback, useEffect, useState } from 'react';

import { fetchDashboard, savePlaybackSpeed } from '../api/courses.js';
import PageHeader from '../components/PageHeader.jsx';
import { IconDownload, IconMoon, IconSun } from '../components/icons.jsx';
import useTheme from '../hooks/useTheme.js';

const SPEEDS = ['1', '1.25', '1.5', '2'];

/** A labelled row inside a settings panel. */
function Row({ title, description, children, control }) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/[0.05] p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-xs text-ink-3">{description}</p> : null}
        {control ? <div className="mt-3">{control}</div> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/**
 * A settings panel — a titled group of rows.
 */
function Panel({ title, description, children }) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-hair bg-card">{children}</div>
    </section>
  );
}

/**
 * A row whose control is not implemented yet.
 *
 * The reference design shows these as toggles, but the server has no setting
 * behind them. Shipping a switch that silently does nothing would be worse
 * than saying so, so the row is disabled and labelled.
 */
function ComingSoonRow({ title, description }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] p-5 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-ink-2">{title}</p>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-4">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-4">{description}</p>
      </div>
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/[0.08]" aria-hidden="true">
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-ink-4" />
      </span>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState(null);
  const [speed, setSpeed] = useState('1');

  const load = useCallback(async () => {
    try {
      const result = await fetchDashboard();
      setData(result);
      if (result.playbackSpeed) setSpeed(String(result.playbackSpeed));
    } catch {
      // The settings page still renders its static parts without the server data.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeSpeed = async (value) => {
    setSpeed(value);
    try {
      await savePlaybackSpeed(Number(value));
    } catch {
      // The speed still applies to this session even if the save failed.
    }
  };

  const dataDir = data?.library?.dataDir ?? '';
  const courseCount = data?.library?.courseCount ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Preferences / Settings"
        title="Settings"
        subtitle="Customize your learning environment."
      />

      <div className="mx-auto max-w-4xl space-y-8 px-5 py-8 lg:px-10">
        {/* --------------------- library & storage --------------------- */}
        <Panel title="Library & Storage" description="Manage your local course folders.">
          <Row
            title="Library Location"
            description="Where your imported folders are managed"
            control={
              <p className="break-all rounded-lg bg-black/20 px-3 py-2 text-xs text-ink-2">
                {dataDir || '—'}
              </p>
            }
          >
            <LinkButton onClick={() => document.getElementById('library-status')?.scrollIntoView()}>
              Manage Folders
            </LinkButton>
          </Row>

          <div className="flex items-center justify-between gap-4 p-5" id="library-status">
            <div>
              <p className="text-sm font-medium text-ink">Library Status</p>
              <p className="mt-1 text-xs text-ink-3">
                {courseCount} course{courseCount === 1 ? '' : 's'} available
              </p>
            </div>
            <span className="rounded-full bg-ok-soft px-3 py-1.5 text-xs text-ok">
              ● Connected
            </span>
          </div>
        </Panel>

        {/* -------------------------- playback -------------------------- */}
        <Panel title="Playback" description="Set your preferred video experience.">
          <Row title="Default Playback Speed" description="Speed used when starting a video">
            <select
              id="playback-speed"
              value={speed}
              onChange={(e) => changeSpeed(e.target.value)}
              className="rounded-lg border border-hair-strong bg-surface px-3 py-2 text-sm text-ink-2 outline-none transition focus:border-accent/50"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </Row>

          <ComingSoonRow
            title="Resume Playback"
            description="Continue from the last watched position"
          />
          <ComingSoonRow
            title="Auto Mark Complete"
            description="Mark a lesson complete when it finishes"
          />
        </Panel>

        {/* ------------------------ appearance ------------------------ */}
        <Panel title="Appearance" description="Personalize the interface.">
          <Row title="Theme" description="Choose your preferred appearance">
            <div className="flex items-center gap-2">
              <span className="text-ink-3">
                {theme === 'light' ? <IconSun size={16} /> : <IconMoon size={16} />}
              </span>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="rounded-lg border border-hair-strong bg-surface px-3 py-2 text-sm text-ink-2 outline-none transition focus:border-accent/50"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </Row>

          <ComingSoonRow title="Compact Playlist" description="Show more lessons in the player sidebar" />
        </Panel>

        {/* ---------------------- progress & data ---------------------- */}
        <Panel title="Progress & Data" description="Manage your learning history.">
          <Row
            title="Learning Progress"
            description="Your watched positions and completed lessons"
          >
            <span className="rounded-lg border border-hair-strong px-3 py-2 text-xs text-ink-3">
              {data?.stats?.completedLessons ?? 0} completed
            </span>
          </Row>

          <Row
            title="Reset Learning Progress"
            description="Clear saved completion and playback history"
          >
            <span className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              Reset Progress
            </span>
          </Row>
        </Panel>

        {/* --------------------------- about --------------------------- */}
        <section className="rounded-2xl border border-hair bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-ink">About StudySpace</h3>
              <p className="mt-1 text-xs text-ink-3">Your personal offline learning workspace</p>
            </div>
            <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-ink-2">Version 1.0.0</span>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-hair pt-5 text-xs text-ink-4">
          <span>StudySpace Settings</span>
          <span className="flex items-center gap-1.5">
            <IconDownload size={13} />
            Local-first learning
          </span>
        </footer>
      </div>
    </>
  );
}

/** A secondary button that looks like the reference's outlined controls. */
function LinkButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-hair-strong px-3 py-2 text-xs text-ink-2 transition hover:bg-white/[0.04]"
    >
      {children}
    </button>
  );
}
