import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="empty">
      <b>Page not found</b>
      The address you opened does not exist, or the record was removed.
      <div><Link className="btn primary" to="/dashboard">Back to the dashboard</Link></div>
    </div>
  );
}

export function Unauthorized() {
  return (
    <div className="empty">
      <b>You do not have access to that page</b>
      Your role does not include this area. If you think this is a mistake, ask an administrator to review your role.
      <div><Link className="btn primary" to="/dashboard">Back to the dashboard</Link></div>
    </div>
  );
}
