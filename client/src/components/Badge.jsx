import { slug } from '../utils/format';

export default function Badge({ value, label }) {
  if (!value) return <span className="muted">—</span>;
  return <span className={'badge b-' + slug(value)}><i />{label || value}</span>;
}
