/** A progress track with an accent fill. `percent` is 0–100. */
export default function ProgressBar({ percent = 0, className = '' }) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className={`progress-track ${className}`}>
      <div className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}
