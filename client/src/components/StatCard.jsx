/**
 * A dashboard statistic tile: an accent-tinted icon, a label, a value and a
 * caption.
 *
 * `tone` picks the accent. The values are fixed strings rather than
 * interpolated class names — Tailwind only generates classes it can see in
 * the source, so the map has to be literal.
 */
const TONES = {
  blue: 'bg-accent-soft text-accent',
  purple: 'bg-plum-soft text-plum',
  emerald: 'bg-ok-soft text-ok',
  amber: 'bg-warn-soft text-warn',
};

export default function StatCard({ icon: Glyph, tone = 'blue', label, value, caption, tag }) {
  return (
    <div className="rounded-2xl border border-hair bg-card p-5">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-3 ${TONES[tone] ?? TONES.blue}`}>
          <Glyph size={21} />
        </div>
        {tag ? <span className="text-xs text-ink-4">{tag}</span> : null}
      </div>

      <p className="mt-5 text-sm text-ink-2">{label}</p>
      <h3 className="mt-1 text-2xl font-semibold text-ink">{value}</h3>
      {caption ? <p className="mt-2 text-xs text-ink-3">{caption}</p> : null}
    </div>
  );
}
