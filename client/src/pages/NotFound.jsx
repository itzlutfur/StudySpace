import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="px-5 py-16 lg:px-10">
      <div className="empty-state mx-auto max-w-lg rounded-2xl border border-dashed border-hair-strong bg-card p-10 text-center">
        <div className="empty-icon text-3xl">⚠</div>
        <h3 className="mt-3 font-medium text-ink">Not found</h3>
        <p className="mt-2 text-sm text-ink-3">That page does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Back to library
        </Link>
      </div>
    </div>
  );
}
