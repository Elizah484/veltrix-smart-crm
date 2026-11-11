const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let currency = 'KES';
export const setCurrency = (c) => { currency = c || 'KES'; };

export function money(n) {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2 }).format(v).replace(/ /g, ' ');
  } catch (e) {
    return currency + ' ' + v.toFixed(2);
  }
}

/** 'YYYY-MM-DD' -> '14 Oct 2026' without any time zone shifting */
export function fmtDate(ymd) {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd));
  if (!m) return String(ymd);
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

/** ISO timestamp (UTC) -> local '14 Oct 2026, 09:30' */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function ago(iso) {
  if (!iso) return '';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + ' min ago';
  if (secs < 86400) return Math.floor(secs / 3600) + ' h ago';
  if (secs < 86400 * 7) return Math.floor(secs / 86400) + ' d ago';
  return fmtDate(new Date(iso).toISOString().slice(0, 10));
}

/** ISO -> value for <input type="datetime-local"> in local time */
export function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');

export const todayLocalYmd = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const fullName = (c) => (c ? c.firstName + ' ' + c.lastName : '');
