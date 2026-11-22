/** A progress track with an accent fill. `percent` is 0–100. */
export default function ProgressBar({ percent = 0, className = '', tone = 'accent' }) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));
  const fill = tone === 'accent' ? 'bg-accent' : 'bg-ok';
  return (
    <div className={`progress-track h-1.5 overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div className={`progress-fill h-full rounded-full ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}
