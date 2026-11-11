import { Link } from 'react-router-dom';

export default function EmptyState({ title, message, actionLabel, to, small }) {
  return (
    <div className={'empty' + (small ? ' sm' : '')}>
      <b>{title}</b>
      {message}
      {actionLabel && to && <div><Link className="btn primary" to={to}>{actionLabel}</Link></div>}
    </div>
  );
}
