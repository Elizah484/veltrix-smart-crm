/** Charts are drawn as plain SVG, so there is no chart library to install. */
const COLORS = ['var(--s1)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s2)', 'var(--faint)'];

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** points: [{ x: '8 Oct', y: 3 }] */
export function LineChart({ points, color, format, label }) {
  const W = 640, H = 240, L = 46, R = 12, T = 12, B = 30;
  if (!points || !points.length) return <div className="chart muted">No data.</div>;
  const max = niceMax(Math.max(...points.map((p) => p.y)));
  const fmt = format || ((n) => String(Math.round(n * 100) / 100));
  const sx = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const sy = (v) => T + (H - T - B) * (1 - v / max);
  const path = points.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
  const area = path + ' L' + sx(points.length - 1).toFixed(1) + ' ' + (H - B) + ' L' + sx(0).toFixed(1) + ' ' + (H - B) + ' Z';
  const every = Math.ceil(points.length / 7);
  const stroke = color || 'var(--s1)';
  const total = points.reduce((s, p) => s + p.y, 0);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={(label || 'Trend chart') + '. Total ' + fmt(total) + ' over ' + points.length + ' periods.'}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(max * t)} y2={sy(max * t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={sy(max * t) + 4} textAnchor="end" className="chart-tip">{fmt(max * t)}</text>
          </g>
        ))}
        <path d={area} fill={stroke} opacity="0.12" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(i)} cy={sy(p.y)} r="3.4" fill={stroke}><title>{p.x}: {fmt(p.y)}</title></circle>
            {i % every === 0 && <text x={sx(i)} y={H - 10} textAnchor="middle" className="chart-tip">{p.x}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** items: [{ label, value }] drawn as horizontal bars */
export function BarList({ items, format }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = format || String;
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <div className="chart muted">No data in this period.</div>;
  return (
    <div role="list">
      {items.map((it, i) => (
        <div className="barrow" role="listitem" key={it.label}>
          <span>{it.label}</span>
          <div className="track"><div className="fill" style={{ width: (it.value / max) * 100 + '%', background: COLORS[i % COLORS.length] }} /></div>
          <b className="num">{fmt(it.value)}</b>
        </div>
      ))}
    </div>
  );
}
