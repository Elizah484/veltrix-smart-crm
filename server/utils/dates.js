'use strict';

const pad = (n) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD HH:MM:SS" in UTC, for DATETIME columns */
function toSqlDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' +
    pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds())
  );
}

/** Date -> "YYYY-MM-DD" in UTC */
function toYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

const todayYmd = () => toYmd(new Date());

/** True for a real calendar date written as YYYY-MM-DD */
function isYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [y, m, d] = String(value).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return toYmd(new Date(Date.UTC(y, m - 1, d + days)));
}

/** "2026-10-13 09:30:00" -> "2026-10-13T09:30:00Z" (database times are UTC) */
function toIso(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.replace(' ', 'T') + 'Z';
  return s;
}

module.exports = { toSqlDateTime, toYmd, todayYmd, isYmd, addDaysYmd, toIso };
