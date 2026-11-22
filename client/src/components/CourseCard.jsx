import { Link } from 'react-router';

import { IconChevronRight, IconDots, IconPlay } from './icons.jsx';
import { courseTargetUrl } from '../utils/courseTarget.js';

/**
 * Per-course accent palettes.
 *
 * The gradient banner, the tag chip and the progress bar all share one hue
 * so a course reads as a single object. The palette is picked from the
 * course id, so a course keeps its colour between renders.
 *
 * These are literal class strings — Tailwind cannot generate classes built
 * at runtime.
 */

const PALETTES = [
  {
    banner: 'from-blue-500/30 to-indigo-600/10',
    text: 'text-blue-400',
    chip: 'text-blue-200',
    bar: 'bg-blue-500',
  },
  {
    banner: 'from-amber-500/30 to-orange-600/10',
    text: 'text-amber-400',
    chip: 'text-amber-200',
    bar: 'bg-amber-500',
  },
  {
    banner: 'from-emerald-500/30 to-teal-600/10',
    text: 'text-emerald-400',
    chip: 'text-emerald-200',
    bar: 'bg-emerald-500',
  },
  {
    banner: 'from-purple-500/30 to-fuchsia-600/10',
    text: 'text-purple-400',
    chip: 'text-purple-200',
    bar: 'bg-purple-500',
  },
  {
    banner: 'from-rose-500/30 to-pink-600/10',
    text: 'text-rose-400',
    chip: 'text-rose-200',
    bar: 'bg-rose-500',
  },
];

/** The palette for a course id. */
export function paletteFor(courseId) {
  const index = Math.abs(Number(courseId) || 0) % PALETTES.length;
  return PALETTES[index];
}

/** The glyph shown on a course banner — derived from the title. */
function glyphFor(title) {
  const text = String(title ?? '').toLowerCase();
  if (/\b(python|py|script|code|program)/.test(text)) return '🐍';
  if (/\b(react|front|web|js|javascript|ui|design)/.test(text)) return '⚛';
  if (/\b(back|server|api|database|sql|system)/.test(text)) return '◈';
  if (/\b(data|machine|ml|ai|stat)/.test(text)) return '◉';
  if (/\b(music|audio|sound)/.test(text)) return '♪';
  return '▤';
}

/**
 * A course card.
 *
 * `variant` selects between the two card shapes in the reference designs:
 * `continue` (banner + progress + a full-width Continue button, used on the
 * dashboard) and `library` (banner + summary + an "Open Course" link, used
 * on My Courses).
 */
export default function CourseCard({
  course,
  variant = 'library',
  menu,
  onMenuToggle,
}) {
  const palette = paletteFor(course.id);
  const target = courseTargetUrl(course);
  const percent = course.stats?.percent ?? 0;
  const completed = course.stats?.completed ?? 0;
  const counted = course.stats?.counted ?? 0;
  const totalDuration = course.totalDurationSec ?? 0;

  const banner = (
    <div
      className={`relative flex ${variant === 'continue' ? 'h-40' : 'h-36'} items-center justify-center overflow-hidden bg-linear-to-br ${palette.banner}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_65%)]" />
      <span className={`text-5xl ${palette.text}`}>{glyphFor(course.title)}</span>

      <span className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/80 backdrop-blur">
        {course.category || 'Course'}
      </span>

      {variant === 'continue' ? (
        <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-lg transition group-hover:opacity-100">
          <IconPlay size={17} />
        </span>
      ) : null}
    </div>
  );

  const meta = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-ink">{course.title}</h3>
          <p className="mt-1 text-xs text-ink-3">
            {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
            {totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-ink-3 transition hover:text-ink"
          aria-label={`Actions for ${course.title}`}
          data-menu-toggle={course.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuToggle?.(course);
          }}
        >
          <IconDots size={19} />
        </button>
      </div>
    </>
  );

  if (variant === 'continue') {
    return (
      <article className="course-card group overflow-hidden rounded-2xl border border-hair bg-card transition hover:border-white/10 hover:bg-card-hover">
        {target ? (
          <Link to={target} className="course-open block">
            {banner}
          </Link>
        ) : (
          banner
        )}

        <div className="p-5">
          {meta}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-ink-3">
                {completed} of {counted} lessons
              </span>
              <span className="font-medium text-ink-2">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={`h-full rounded-full ${palette.bar}`} style={{ width: `${percent}%` }} />
            </div>
          </div>

          {target ? (
            <Link
              to={target}
              className="course-open mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] py-2.5 text-sm font-medium text-ink-2 transition hover:border-accent/40 hover:bg-accent-soft hover:text-ink"
            >
              Continue Learning
              <IconChevronRight size={16} />
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="course-card group overflow-hidden rounded-2xl border border-hair bg-card transition hover:border-white/10">
      {banner}

      <div className="p-5">
        {meta}

        <div className="mt-5 flex justify-between text-xs">
          <span className="text-ink-3">
            {completed} / {counted} lessons
          </span>
          <span className={palette.text}>{percent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className={`h-full rounded-full ${palette.bar}`} style={{ width: `${percent}%` }} />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="truncate text-xs text-ink-3">{course.lastOpenedLabel}</span>
          {target ? (
            <Link
              to={target}
              className="course-open shrink-0 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
            >
              Open Course →
            </Link>
          ) : (
            <span className="shrink-0 rounded-lg bg-white/4 px-3 py-2 text-xs text-ink-4">
              No lessons
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** "2h 15m" / "18m" — a compact duration for the card meta line. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}
