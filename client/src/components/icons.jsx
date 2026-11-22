/**
 * Inline SVG icons, matching the reference designs.
 *
 * They are inlined rather than pulled from an icon package so the app keeps
 * its dependency list small and every glyph shares one stroke style.
 */

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** A generic icon wrapper. `size` is in pixels. */
function Icon({ size = 18, children, ...rest }) {
  return (
    <svg width={size} height={size} {...base} {...rest}>
      {children}
    </svg>
  );
}

/* ------------------------------ brand ------------------------------ */

/** The StudySpace mark — a board/easel. */
export function IconLogo({ size = 24, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M12 7v14" />
      <path d="M3 18V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13" />
      <path d="M3 18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
      <path d="M3 7h18" />
    </Icon>
  );
}

/* ---------------------------- navigation --------------------------- */

/** Four tiles — the dashboard. */
export function IconDashboard({ size = 18, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  );
}

/** A book — the course library. */
export function IconBook({ size = 18, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

/** A clock — recently played. */
export function IconClock({ size = 18, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

/** A gear — settings. */
export function IconSettings({ size = 18, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.8.1l-.2.1-3.3-1.2v-.2a1.7 1.7 0 0 0-1.1-1.5h-.2L8 20.1l-.2-.1a1.7 1.7 0 0 0-1.8-.1l-.2.1-1.7-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9l-.1-.2L2 13.5v-.2a1.7 1.7 0 0 0 0-1.9v-.2l2.4-1.5.1-.2a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.8-.1l.2.1 3.3 1.2v.2a1.7 1.7 0 0 0 1.1 1.5h.2L16 5.1l.2-.1a1.7 1.7 0 0 0 1.8.1l.2.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9l.1.2L21 11.5v.2a1.7 1.7 0 0 0 0 1.9v.2z" />
    </Icon>
  );
}

/* ------------------------------ content ---------------------------- */

/** A film frame — video lessons. */
export function IconVideo({ size = 20, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </Icon>
  );
}

/** A document page — PDF and text lessons. */
export function IconDocument({ size = 20, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </Icon>
  );
}

/** A check — completed. */
export function IconCheck({ size = 16, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  );
}

/** A download arrow — the local-course pill. */
export function IconDownload({ size = 16, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  );
}

/* ------------------------------ actions ---------------------------- */

/** A pencil — edit. */
export function IconPencil({ size = 17, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </Icon>
  );
}

/** A plus — add. */
export function IconPlus({ size = 17, ...rest }) {
  return (
    <Icon size={size} {...rest} strokeWidth={2}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

/** A magnifying glass — search. */
export function IconSearch({ size = 17, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

/** A chevron pointing right. */
export function IconChevronRight({ size = 16, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

/** A chevron pointing left. */
export function IconChevronLeft({ size = 19, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

/** A chevron pointing down — collapsible sections. */
export function IconChevronDown({ size = 16, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

/** Three dots — the card menu. */
export function IconDots({ size = 19, ...rest }) {
  return (
    <Icon size={size} {...rest} fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </Icon>
  );
}

/** A play triangle — the current lesson. */
export function IconPlay({ size = 15, ...rest }) {
  return (
    <Icon size={size} {...rest} fill="currentColor" stroke="none">
      <path d="m8 5 12 7-12 7z" />
    </Icon>
  );
}

/** A folder. */
export function IconFolder({ size = 20, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </Icon>
  );
}

/** A menu — the mobile drawer toggle. */
export function IconMenu({ size = 20, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Icon>
  );
}

/** A moon — the dark theme. */
export function IconMoon({ size = 17, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  );
}

/** A sun — the light theme. */
export function IconSun({ size = 17, ...rest }) {
  return (
    <Icon size={size} {...rest}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.3 17.7-1.4 1.4" />
      <path d="m19.1 4.9-1.4 1.4" />
    </Icon>
  );
}
