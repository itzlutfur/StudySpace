import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="empty-state">
      <div className="empty-icon">⚠</div>
      <h3>Not found</h3>
      <p className="muted">That page does not exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to library
      </Link>
    </div>
  );
}
