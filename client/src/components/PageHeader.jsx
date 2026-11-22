/**
 * The page header: a breadcrumb-style eyebrow, the page title, and a slot
 * for actions on the right.
 */
export default function PageHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <header className="flex flex-col gap-4 border-b border-hair px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-ink-3">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-ink-3">{subtitle}</p> : null}
      </div>
      {actions || children ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
