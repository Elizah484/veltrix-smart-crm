'use strict';
/* ---------- session and permissions ---------- */
let session = null;
let loginMsg = '';
const me = () => session ? DB.users.find(u => u.id === session.uid) || null : null;
const can = p => { const u = me(); return !!u && PERM[u.role].indexOf(p) >= 0; };
const uName = id => { const u = DB.users.find(x => x.id === id); return u ? u.name : '—'; };
const getCust = id => DB.customers.find(c => c.id === id);
const cName = c => c ? c.first + ' ' + c.last : 'Unknown customer';
const getOrder = id => DB.orders.find(o => o.id === id);
const getInter = id => DB.interactions.find(i => i.id === id);

function visibleCustomers() {
  const u = me();
  if (!u || u.role !== 'employee') return DB.customers;
  return DB.customers.filter(c => !c.assignedTo || c.assignedTo === u.id || c.createdBy === u.id);
}
const visIds = () => new Set(visibleCustomers().map(c => c.id));
const visibleOrders = () => { const s = visIds(); return DB.orders.filter(o => s.has(o.customerId)); };
const visibleInteractions = () => { const s = visIds(); return DB.interactions.filter(i => s.has(i.customerId)); };
function canEditCustomer(c) {
  const u = me();
  if (!u) return false;
  if (u.role !== 'employee') return true;
  return !c.assignedTo || c.assignedTo === u.id || c.createdBy === u.id;
}
function canEditInteraction(i) {
  const u = me();
  if (!u) return false;
  return u.role !== 'employee' || i.userId === u.id;
}
function allowedNext(o) {
  const u = me();
  const list = NEXT[o.status] || [];
  if (can('orders.any')) return list.filter(s => s !== 'Cancelled' || can('orders.cancel'));
  return list.filter(s => s === 'Confirmed' || s === 'Processing');
}

/* ---------- audit, notifications, errors, transactions ---------- */
function pushAudit(e) {
  const u = e.userId !== undefined ? e.userId : (me() ? me().id : null);
  DB.audit.push({
    id: nextId('audit'), at: e.at || new Date().toISOString(), userId: u, action: e.action, entity: e.entity || '', entityId: e.entityId || null,
    summary: e.summary || '', before: e.before || null, after: e.after || null, rid: e.rid || rid()
  });
}
function notify(userIds, type, text, link, key) {
  userIds.forEach(uid => {
    if (key && DB.notifications.some(n => n.userId === uid && n.key === key)) return;
    DB.notifications.push({ id: nextId('notif'), userId: uid, type, text, link: link || '', at: new Date().toISOString(), read: false, key: key || '' });
  });
}
const managersAndAdmins = () => DB.users.filter(u => u.active && u.role !== 'employee').map(u => u.id);
function logError(msg) {
  DB.errors.unshift({ at: new Date().toISOString(), msg: String(msg).replace(/[\r\n]+/g, ' ').slice(0, 160) });
  DB.errors = DB.errors.slice(0, 25);
  try { saveDB(); } catch (e) { /* ignore */ }
}
function tx(fn) {
  const snap = JSON.stringify(DB);
  try {
    const result = fn();
    saveDB(true);
    return { ok: true, result };
  } catch (err) {
    DB = JSON.parse(snap);
    logError('Operation rolled back: ' + err.message);
    return { ok: false, error: err };
  }
}
function isOverdue(i) { return !!i.followUp && !i.followUpDone && i.followUp < todayStr(); }
function syncReminders() {
  const t = todayStr();
  const soon = ymd(addDays(new Date(), DB.settings.reminderDays));
  DB.interactions.forEach(i => {
    if (!i.followUp || i.followUpDone) return;
    const c = getCust(i.customerId);
    const who = i.assignee || i.userId;
    if (i.followUp < t) notify([who], 'followup', 'Overdue follow-up: ' + i.subject + ' (' + cName(c) + ')', '/interactions/' + i.id, 'ov-' + i.id);
    else if (i.followUp <= soon) notify([who], 'followup', 'Follow-up due ' + fmtDate(i.followUp) + ': ' + i.subject + ' (' + cName(c) + ')', '/interactions/' + i.id, 'up-' + i.id);
  });
}

/* ---------- duplicates ---------- */
const pairKey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
function dupReason(a, b) {
  if (a.emailN && a.emailN === b.emailN) return 'Same email';
  const sl = lc(a.last) === lc(b.last), sf = lc(a.first) === lc(b.first);
  if (sf && sl) return 'Same name';
  if (a.phoneN && a.phoneN === b.phoneN && (sl || sf)) return 'Same phone and ' + (sl ? 'last' : 'first') + ' name';
  return '';
}
function dupPairs() {
  const act = DB.customers.filter(c => c.status !== 'Archived');
  const out = [];
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], key = pairKey(a.id, b.id);
    if (DB.dupReviews.indexOf(key) >= 0) continue;
    const why = dupReason(a, b);
    if (why) out.push({ a, b, why, key });
  }
  return out;
}
function findDuplicates(data, excludeId) {
  const probe = { first: data.first, last: data.last, emailN: normEmail(data.email), phoneN: normPhone(data.phone) };
  const hard = [], soft = [];
  DB.customers.forEach(o => {
    if (o.id === excludeId || o.mergedInto) return;
    if (probe.emailN && o.emailN === probe.emailN && o.status !== 'Archived') { hard.push(o); return; }
    if (o.status !== 'Archived' && dupReason(probe, o)) soft.push(o);
  });
  return { hard, soft };
}

/* ---------- order maths (integer cents) ---------- */
function calcTotals(items, pct) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit, 0);
  const discount = Math.round(subtotal * (pct || 0) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

/* ---------- time series ---------- */
function bucketSeries(items, getDate, getVal, days) {
  const step = days > 31 ? 7 : 1;
  const n = Math.ceil(days / step);
  const start = addDays(new Date(new Date().setHours(0, 0, 0, 0)), -(n * step - 1));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i * step);
    pts.push({ x: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), y: 0 });
  }
  items.forEach(it => {
    const raw = getDate(it);
    const d = raw.length > 10 ? new Date(raw) : parseYmd(raw);
    const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000 / step);
    if (idx >= 0 && idx < n) pts[idx].y += getVal(it);
  });
  return pts;
}

/* ---------- ui helpers: toast, modal, badge, icons ---------- */
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 7000 : 4200);
}
let modalReturn = null;
function closeModal() {
  $('#modal-root').innerHTML = '';
  if (modalReturn && document.contains(modalReturn)) modalReturn.focus();
  modalReturn = null;
}
function openModal(html, onMount) {
  modalReturn = document.activeElement;
  const root = $('#modal-root');
  root.innerHTML = '<div class="overlay" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">' + html + '</div></div>';
  const first = $('.modal input, .modal select, .modal textarea, .modal button.primary, .modal button', root);
  if (first) first.focus();
  if (onMount) onMount($('.modal', root));
}
let confirmCb = null;
function confirmDialog(o) {
  confirmCb = o.onConfirm;
  openModal('<h2 id="mtitle">' + esc(o.title) + '</h2><div class="muted">' + o.body + '</div><div class="foot"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-act="modal-confirm">' + esc(o.confirm || 'Confirm') + '</button></div>');
}
function badge(t) {
  const k = String(t).toLowerCase().replace(/\s+/g, '-');
  return '<span class="badge b-' + esc(k) + '"><i></i>' + esc(t) + '</span>';
}
const ICONS = {
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  interactions: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  orders: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0',
  followups: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  reports: 'M18 20V10 M12 20V4 M6 20v-6',
  audit: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  users: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  settings: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  plus: 'M12 5v14 M5 12h14',
  check: 'M20 6L9 17l-5-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  panel: 'M3 4h18v16H3z M9 4v16',
  sortup: 'M12 19V5 M5 12l7-7 7 7',
  sortdown: 'M12 5v14 M19 12l-7 7-7-7'
};
const ico = n => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>';

/* ---------- charts (SVG drawn at container width) ---------- */
const chartCfg = {};
function niceMax(v) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10;
  return nice * p;
}
function chartHTML(id, cfg) {
  chartCfg[id] = cfg;
  return '<div class="chart" data-chart="' + id + '"></div>';
}
function drawChart(el) {
  const cfg = chartCfg[el.dataset.chart];
  if (!cfg) return;
  const W = Math.max(280, el.clientWidth), H = 220;
  const m = { l: cfg.money ? 54 : 38, r: 14, t: 16, b: 28 };
  const pts = cfg.points, n = pts.length;
  const maxV = Math.max.apply(null, [0].concat(pts.map(p => p.y)));
  const top = niceMax(maxV), iw = W - m.l - m.r, ih = H - m.t - m.b;
  const color = cfg.color || 'var(--s1)';
  const fmtV = v => cfg.money ? fmtCompact(v) : String(Math.round(v * 10) / 10);
  const fmtFull = v => cfg.money ? fmtMoney(v) : String(v);
  const x = i => cfg.type === 'bar' ? m.l + (i + 0.5) * iw / n : m.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => m.t + ih - (v / top) * ih;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.label) + '">';
  for (let k = 0; k <= 4; k++) {
    const v = top * k / 4, yy = y(v);
    s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + (k === 0 ? 'var(--line)' : 'var(--line-soft)') + '" stroke-width="1"/>';
    s += '<text x="' + (m.l - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" style="fill:var(--faint)">' + fmtV(v) + '</text>';
  }
  const want = Math.min(n, W < 420 ? 4 : 6);
  const shown = new Set();
  for (let k = 0; k < want; k++) shown.add(Math.round(k * (n - 1) / Math.max(1, want - 1)));
  shown.forEach(i => { s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" style="fill:var(--muted)">' + esc(pts[i].x) + '</text>'; });
  if (cfg.type === 'bar') {
    const bw = Math.max(3, Math.min(26, iw / n * 0.62));
    pts.forEach((p, i) => {
      const h = Math.max(0, (p.y / top) * ih);
      if (p.y > 0) s += '<path d="M' + (x(i) - bw / 2) + ',' + (m.t + ih) + 'V' + (m.t + ih - h + 4) + 'a4,4 0 0 1 4,-4h' + (bw - 8) + 'a4,4 0 0 1 4,4V' + (m.t + ih) + 'z" fill="' + color + '"><title>' + esc(p.x) + ': ' + fmtFull(p.y) + '</title></path>';
    });
  } else {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i) + ',' + y(p.y)).join('');
    if (cfg.area) s += '<path d="' + d + 'L' + x(n - 1) + ',' + (m.t + ih) + 'L' + x(0) + ',' + (m.t + ih) + 'Z" fill="' + color + '" opacity="0.16"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach((p, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(p.y) + '" r="9" fill="transparent"><title>' + esc(p.x) + ': ' + fmtFull(p.y) + '</title></circle>'; });
    const last = pts[n - 1];
    s += '<circle cx="' + x(n - 1) + '" cy="' + y(last.y) + '" r="4" fill="' + color + '" stroke="var(--surface)" stroke-width="2"/>';
  }
  if (maxV === 0) s += '<text x="' + (W / 2) + '" y="' + (m.t + ih / 2) + '" text-anchor="middle" font-size="13" style="fill:var(--muted)">No data in this period</text>';
  s += '</svg>';
  el.innerHTML = s;
}
const drawAllCharts = () => $$('.chart[data-chart]').forEach(drawChart);

function barRows(rows, total) {
  const max = Math.max(1, ...rows.map(r => r.v));
  if (!rows.some(r => r.v > 0)) return '<div class="empty sm">Nothing recorded yet.</div>';
  return rows.map(r => '<div class="barrow"><span>' + esc(r.label) + '</span><span class="track"><span class="fill" style="display:block;width:' + (r.v / max * 100) + '%;background:' + r.color + '"></span></span><span class="num">' + r.v + (total ? ' <span class="muted">· ' + Math.round(r.v / total * 100) + '%</span>' : '') + '</span></div>').join('');
}
