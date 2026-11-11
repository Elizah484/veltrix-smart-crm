'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-case and trim. Returns null for empty input. */
function normEmail(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  return s || null;
}

/** Digits only. A Kenyan local number such as 0712 345 678 becomes 254712345678. */
function normPhone(value) {
  let d = String(value == null ? '' : value).replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 && d[0] === '0') d = '254' + d.slice(1);
  return d;
}

const isEmail = (value) => EMAIL_RE.test(String(value || '').trim());

function isPhone(value) {
  const n = normPhone(value);
  return !!n && n.length >= 9 && n.length <= 15;
}

/** Escape % _ \ so user text is matched literally inside LIKE */
const likeEscape = (s) => String(s).replace(/[\\%_]/g, '\\$&');
const likeContains = (s) => '%' + likeEscape(s) + '%';

/** Password rule: at least 10 characters with a letter and a digit */
function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < 10) return 'Use at least 10 characters.';
  if (s.length > 100) return 'Use 100 characters or fewer.';
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Include at least one letter and one number.';
  return null;
}

module.exports = { normEmail, normPhone, isEmail, isPhone, likeEscape, likeContains, passwordProblem };
