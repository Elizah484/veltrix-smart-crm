'use strict';
/* ---------- ui state, registries, list helpers ---------- */
const PAGE = 8;
const ui = {
  collapsed: false, drawer: false,
  cust: { q: '', cat: '', status: '', from: '', to: '', sort: 'registered', dir: 'desc', page: 1 },
  inter: { q: '', type: '', status: '', from: '', to: '', sort: 'at', dir: 'desc', page: 1 },
  ord: { q: '', status: '', pay: '', from: '', to: '', sort: 'date', dir: 'desc', page: 1 },
  audit: { q: '', user: '', action: '', from: '', to: '', sort: 'at', dir: 'desc', page: 1 },
  notif: { unread: false },
  followTab: 'overdue', dashDays: 30, custTab: 'timeline',
  report: { type: 'customers', from: '', to: '' }
};
const acts = {}, forms = {}, refresh = {};
let current = '/dashboard';
const navStack = ['/dashboard'];

function thead(s, cols) {
  const st = ui[s];
  return '<tr>' + cols.map(c => c.k
    ? '<th class="' + (c.cls || '') + '" aria-sort="' + (st.sort === c.k ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"><button data-act="sort" data-s="' + s + '" data-k="' + c.k + '">' + esc(c.l) + (st.sort === c.k ? ico(st.dir === 'asc' ? 'sortup' : 'sortdown') : '') + '</button></th>'
    : '<th class="' + (c.cls || '') + '">' + esc(c.l) + '</th>').join('') + '</tr>';
}
function pager(s, total) {
  const st = ui[s];
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (st.page > pages) st.page = pages;
  const from = total ? (st.page - 1) * PAGE + 1 : 0, to = Math.min(total, st.page * PAGE);
  return '<div class="pager"><span>Showing ' + from + '–' + to + ' of ' + total + '</span><span class="btns"><button class="btn sm" data-act="page" data-s="' + s + '" data-d="-1"' + (st.page <= 1 ? ' disabled' : '') + '>Previous</button><span style="align-self:center">Page ' + st.page + ' of ' + pages + '</span><button class="btn sm" data-act="page" data-s="' + s + '" data-d="1"' + (st.page >= pages ? ' disabled' : '') + '>Next</button></span></div>';
}
function sortPage(rows, s, getters) {
  const st = ui[s], g = getters[st.sort] || (() => 0), dir = st.dir === 'asc' ? 1 : -1;
  const sorted = rows.slice().sort((a, b) => { const x = g(a), y = g(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (st.page > pages) st.page = pages;
  return { total, rows: sorted.slice((st.page - 1) * PAGE, st.page * PAGE) };
}
const inRange = (val, from, to) => { const v = String(val).slice(0, 10); return (!from || v >= from) && (!to || v <= to); };
const opts = (list, sel, all) => (all ? '<option value="">' + esc(all) + '</option>' : '') + list.map(x => { const v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(sel) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
function field(id, label, type, value, o) {
  o = o || {};
  const req = o.req ? ' <i aria-hidden="true">*</i>' : '';
  let ctl;
  if (type === 'select') ctl = '<select id="' + id + '" name="' + id + '"' + (o.dis ? ' disabled' : '') + '>' + o.options + '</select>';
  else if (type === 'textarea') ctl = '<textarea id="' + id + '" name="' + id + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + esc(value) + '</textarea>';
  else ctl = '<input id="' + id + '" name="' + id + '" type="' + type + '" value="' + esc(value) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' max="' + o.max + '"' : '') + (o.min ? ' min="' + o.min + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.req ? ' required' : '') + '>';
  return '<div class="field' + (o.full ? ' full' : '') + '"><label for="' + id + '">' + esc(label) + req + '</label>' + ctl + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '<span class="err" id="' + id + '-err" role="alert"></span></div>';
}
function showErrors(form, errs) {
  $$('.err', form).forEach(e => e.textContent = '');
  $$('[aria-invalid]', form).forEach(e => e.removeAttribute('aria-invalid'));
  let first = null;
  Object.keys(errs).forEach(k => {
    const e = $('#' + k + '-err', form), i = $('#' + k, form);
    if (e) e.textContent = errs[k];
    if (i) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', k + '-err'); if (!first) first = i; }
  });
  if (first) first.focus();
}
const formData = f => { const o = {}; $$('input, select, textarea', f).forEach(e => { if (e.name) o[e.name] = e.value.trim(); }); return o; };
const custLink = c => c ? '<a href="#" data-go="/customers/' + c.id + '">' + esc(cName(c)) + '</a>' : '<span class="muted">Unknown</span>';

/* ---------- session ---------- */
const SESSION_MS = 30 * 60000;
function startSession(uid) {
  session = { uid, exp: Date.now() + SESSION_MS };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
}
function restoreSession() {
  try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); if (s && s.exp > Date.now() && DB.users.some(u => u.id === s.uid && u.active)) session = s; } catch (e) { /* ignore */ }
}
function endSession(msg) {
  session = null; loginMsg = msg || '';
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}
function touch() {
  if (!session) return;
  session.exp = Date.now() + SESSION_MS;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
}
function checkSession() {
  if (!session) return true;
  const u = me();
  if (session.exp < Date.now() || !u || !u.active) { endSession('Your session expired. Please sign in again.'); render(); return false; }
  return true;
}

/* ---------- router ---------- */
function resolve(path) {
  const parts = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(parts[1] || ''));
  const seg = parts[0].split('/').filter(Boolean);
  const a = seg[0], b = seg[1], c = seg[2];
  const R = (nav, perm, crumbs, view) => ({ nav, perm, crumbs, view, q, id: Number(b) || 0 });
  if (!a || a === 'dashboard') return R('dashboard', null, [['Dashboard']], vDashboard);
  if (a === 'customers') {
    if (!b) return R('customers', null, [['Customers']], vCustomers);
    if (b === 'new') return R('customers', null, [['Customers', '/customers'], ['Add customer']], vCustomerForm);
    const cu = getCust(Number(b));
    if (c === 'edit') return R('customers', null, [['Customers', '/customers'], [cu ? cu.code : 'Customer', '/customers/' + b], ['Edit']], vCustomerForm);
    return R('customers', null, [['Customers', '/customers'], [cu ? cu.code : 'Customer']], vCustomerDetail);
  }
  if (a === 'interactions') {
    if (!b) return R('interactions', null, [['Interactions']], vInteractions);
    if (b === 'new') return R('interactions', null, [['Interactions', '/interactions'], ['Add interaction']], vInteractionForm);
    if (c === 'edit') return R('interactions', null, [['Interactions', '/interactions'], ['Interaction #' + b, '/interactions/' + b], ['Edit']], vInteractionForm);
    return R('interactions', null, [['Interactions', '/interactions'], ['Interaction #' + b]], vInteractionDetail);
  }
  if (a === 'orders') {
    if (!b) return R('orders', null, [['Orders']], vOrders);
    if (b === 'new') return R('orders', null, [['Orders', '/orders'], ['Create order']], vOrderForm);
    const o = getOrder(Number(b));
    return R('orders', null, [['Orders', '/orders'], [o ? o.code : 'Order']], vOrderDetail);
  }
  if (a === 'followups') return R('followups', null, [['Follow-ups']], vFollowups);
  if (a === 'reports') return R('reports', 'reports', [['Reports']], vReports);
  if (a === 'audit') return R('audit', 'audit', [['Audit logs']], vAudit);
  if (a === 'users') return R('users', 'users', [['User management']], vUsers);
  if (a === 'settings') return R('settings', 'settings', [['Settings']], vSettings);
  if (a === 'notifications') return R('', null, [['Notifications']], vNotifications);
  if (a === 'profile') return R('', null, [['My profile']], vProfile);
  return R('', null, [['Page not found']], vNotFound);
}
function go(path) {
  if (!checkSession()) return;
  if (navStack[navStack.length - 1] !== path) navStack.push(path);
  current = path; ui.drawer = false;
  render();
  window.scrollTo(0, 0);
}
function goBack(fallback) {
  if (navStack.length > 1) { navStack.pop(); current = navStack[navStack.length - 1]; render(); }
  else go(fallback || '/dashboard');
}
function replacePath(path) { navStack[navStack.length - 1] = path; current = path; render(); }

const NAV = [
  ['dashboard', '/dashboard', 'Dashboard', null], ['customers', '/customers', 'Customers', null], ['interactions', '/interactions', 'Interactions', null],
  ['orders', '/orders', 'Orders', null], ['followups', '/followups', 'Follow-ups', null], ['reports', '/reports', 'Reports', 'reports'],
  ['audit', '/audit', 'Audit Logs', 'audit'], ['users', '/users', 'User Management', 'users'], ['settings', '/settings', 'Settings', 'settings']
];
const myNotifs = () => { const u = me(); return DB.notifications.filter(n => n.userId === u.id).sort((a, b) => a.at < b.at ? 1 : -1); };

function shell(r, inner) {
  const u = me();
  const overdue = visibleInteractions().filter(i => isOverdue(i) && (u.role !== 'employee' || (i.assignee || i.userId) === u.id)).length;
  const unread = myNotifs().filter(n => !n.read).length;
  const nav = NAV.filter(n => !n[3] || can(n[3])).map(n =>
    '<a href="#" data-go="' + n[1] + '"' + (r.nav === n[0] ? ' aria-current="page"' : '') + ' title="' + n[2] + '">' + ico(n[0]) + '<span class="l">' + n[2] + '</span>' + (n[0] === 'followups' && overdue ? '<span class="badge-n" aria-label="' + overdue + ' overdue">' + overdue + '</span>' : '') + '</a>').join('');
  const crumbs = ['<a href="#" data-go="/dashboard">Home</a>'].concat(r.crumbs.map((c, i) => i === r.crumbs.length - 1 ? '<b>' + esc(c[0]) + '</b>' : '<a href="#" data-go="' + c[1] + '">' + esc(c[0]) + '</a>')).join(' / ');
  const nl = myNotifs().slice(0, 6).map(n => '<a href="#" data-act="open-notif" data-id="' + n.id + '"' + (n.read ? '' : ' style="background:var(--surface-2)"') + '>' + esc(n.text) + '<small>' + fmtDT(n.at) + '</small></a>').join('') || '<div class="row muted">No notifications yet.</div>';
  return '<div class="shell' + (ui.collapsed ? ' collapsed' : '') + (ui.drawer ? ' drawer' : '') + '">' +
    '<aside class="sidebar" aria-label="Main"><a class="logo" href="#" data-go="/dashboard" aria-label="Veltrix home">' + logoSVG() + '<b>VELTRIX</b></a><nav class="nav" aria-label="Primary">' + nav + '</nav>' +
    '<div class="side-foot"><div class="demo-tag">Demo workspace · fictional data</div><button class="btn ghost sm desk-only" data-act="collapse" aria-label="Collapse sidebar">' + ico('panel') + '<span>Collapse</span></button></div></aside>' +
    '<div class="main"><header class="topbar"><button class="icon-btn mobile-only" data-act="drawer" aria-label="Open menu">' + ico('menu') + '</button><nav class="crumbs" aria-label="Breadcrumb">' + crumbs + '</nav>' +
    '<div class="gsearch" role="search">' + ico('search') + '<label class="sr" for="gsearch">Search customers, orders and interactions</label><input id="gsearch" type="search" placeholder="Search customers, orders, interactions" data-input="gsearch" autocomplete="off"><div class="drop" id="gres" hidden></div></div>' +
    '<div class="menu"><button class="icon-btn" data-act="menu" data-m="nmenu" aria-label="Notifications' + (unread ? ', ' + unread + ' unread' : '') + '">' + ico('bell') + (unread ? '<span class="dot-n">' + unread + '</span>' : '') + '</button><div class="drop" id="nmenu" hidden><div class="hd">Notifications</div>' + nl + '<a href="#" data-go="/notifications" style="text-align:center;color:var(--accent)">View all</a></div></div>' +
    '<div class="menu"><button class="userbtn" data-act="menu" data-m="umenu" aria-label="Account menu"><span class="avatar">' + esc(initials(u.name)) + '</span><span class="desk-only" style="text-align:left;line-height:1.2"><span style="display:block;font-weight:500">' + esc(u.name) + '</span><small class="muted">' + ROLE_LABEL[u.role] + '</small></span></button><div class="drop" id="umenu" hidden><div class="row"><b>' + esc(u.name) + '</b><small>' + esc(u.email) + '</small></div><a href="#" data-go="/profile">My profile</a><a href="#" data-act="logout">Sign out</a></div></div>' +
    '</header><main class="page" id="view" tabindex="-1">' + inner + '</main></div></div>';
}
function logoSVG() {
  return '<svg viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="8" fill="#15223c" stroke="#22314f"/><path d="M9 10l8 15 8-15" fill="none" stroke="#26d0c0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="25" r="2.2" fill="#3987e5"/></svg>';
}

function render() {
  const app = $('#app');
  if (!me()) { app.innerHTML = loginHTML(); return; }
  const r = resolve(current);
  let out;
  if (r.perm && !can(r.perm)) out = vUnauthorized(r);
  else out = r.view(r);
  app.innerHTML = shell(r, out.html);
  if (out.mount) out.mount();
  drawAllCharts();
  const v = $('#view'); if (v && !ui.keepFocus) v.focus({ preventScroll: true });
}
function pageHead(title, sub, actionsHTML) {
  return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actionsHTML ? '<div class="actions">' + actionsHTML + '</div>' : '') + '</div>';
}
const vUnauthorized = () => ({ html: '<div class="empty"><b>You do not have access to this page</b>Your role (' + ROLE_LABEL[me().role] + ') cannot open it. Ask an administrator if you need access.<div><button class="btn primary" data-go="/dashboard">Back to dashboard</button></div></div>' });
const vNotFound = () => ({ html: '<div class="empty"><b>Page not found</b>The page you opened does not exist or was moved.<div><button class="btn primary" data-go="/dashboard">Go to dashboard</button></div></div>' });

/* ---------- login ---------- */
let attempts = { n: 0, until: 0 };
function loginHTML() {
  const demo = DB.users.filter(u => u.active).map(u => '<button type="button" data-act="demo-login" data-e="' + esc(u.email) + '"><span><b>' + ROLE_LABEL[u.role] + '</b><br><small class="muted">' + esc(u.email) + '</small></span><span class="muted">Use</span></button>').join('');
  return '<div class="login"><section class="hero"><div class="logo" style="padding:0">' + logoSVG() + '<b>VELTRIX</b></div><h1>One reliable record for every customer</h1>' +
    '<ul><li>' + ico('check') + '<span>Duplicate checks before every save, so one customer stays one profile.</span></li><li>' + ico('check') + '<span>Orders, interactions and follow-ups tied to the right customer.</span></li><li>' + ico('check') + '<span>An audit trail showing who changed what, and when.</span></li></ul></section>' +
    '<section class="panel"><div class="box"><div><h2 style="font-size:22px">Sign in</h2><p class="muted" style="margin-top:4px">Use your Veltrix staff account.</p></div>' +
    (loginMsg ? '<div class="banner bad" role="alert" style="margin:0"><div>' + esc(loginMsg) + '</div></div>' : '') +
    '<form data-form="login" novalidate class="stack" style="gap:14px">' + field('email', 'Email', 'email', '', { req: true, auto: 'username' }) + field('password', 'Password', 'password', '', { req: true, auto: 'current-password' }) + '<button class="btn primary" type="submit">Sign in</button></form>' +
    '<div class="demo-accts"><span class="hint">Demo accounts. Password for all: <code class="mono">' + DEMO_PASSWORD + '</code></span>' + demo + '</div></div></section></div>';
}
forms.login = async f => {
  const d = formData(f);
  const errs = {};
  if (!d.email) errs.email = 'Enter your email address.';
  else if (!EMAIL_RE.test(d.email)) errs.email = 'Enter a valid email address.';
  if (!d.password) errs.password = 'Enter your password.';
  if (Object.keys(errs).length) { showErrors(f, errs); return; }
  if (attempts.until > Date.now()) { loginMsg = 'Too many failed attempts. Try again in ' + Math.ceil((attempts.until - Date.now()) / 1000) + ' seconds.'; render(); return; }
  const u = DB.users.find(x => lc(x.email) === lc(d.email));
  const h = u ? await sha(d.password, u.salt) : '';
  if (!u || h !== u.pwHash) {
    attempts.n++;
    pushAudit({ userId: null, action: 'auth.login_failed', entity: 'auth', summary: 'Failed sign-in attempt' });
    saveDB();
    if (attempts.n >= 5) { attempts = { n: 0, until: Date.now() + 30000 }; loginMsg = 'Too many failed attempts. Sign-in is paused for 30 seconds.'; }
    else loginMsg = 'The email or password is not correct.';
    render(); return;
  }
  if (!u.active) { loginMsg = 'This account has been deactivated. Contact an administrator.'; render(); return; }
  attempts = { n: 0, until: 0 };
  u.lastLogin = new Date().toISOString();
  startSession(u.id);
  pushAudit({ userId: u.id, action: 'auth.login', entity: 'auth', summary: 'Signed in' });
  syncReminders(); saveDB();
  loginMsg = ''; current = '/dashboard'; navStack.length = 0; navStack.push('/dashboard');
  render();
};

/* ---------- global event delegation ---------- */
function closeMenus() { $$('.menu .drop').forEach(d => d.hidden = true); const g = $('#gres'); if (g) g.hidden = true; }
document.addEventListener('click', e => {
  touch();
  const el = e.target.closest('[data-go],[data-act]');
  if (!el) { if (!e.target.closest('.menu') && !e.target.closest('.gsearch')) closeMenus(); return; }
  if (el.dataset.go) { e.preventDefault(); closeMenus(); go(el.dataset.go); return; }
  const fn = acts[el.dataset.act];
  if (fn) { if (el.tagName === 'A') e.preventDefault(); fn(el, e); }
});
document.addEventListener('submit', e => {
  const h = forms[e.target.dataset.form];
  if (h) { e.preventDefault(); h(e.target); }
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const k = el.dataset.input;
  if (k === 'gsearch') return gsearch(el.value);
  if (k === 'list') { ui[el.dataset.s][el.dataset.k] = el.value; ui[el.dataset.s].page = 1; return debRefresh(el.dataset.s); }
  if (k === 'order-calc') return orderCalc();
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const k = el.dataset.change;
  if (k === 'filter') { ui[el.dataset.s][el.dataset.k] = el.value; ui[el.dataset.s].page = 1; refresh[el.dataset.s](); }
  else if (k === 'assign') assignFollowUp(Number(el.dataset.id), Number(el.value) || null);
  else if (k === 'role') changeRole(Number(el.dataset.id), el.value);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal-root .modal')) closeModal(); closeMenus(); }
  if (e.key === 'Enter' && e.target.id === 'gsearch') { const a = $('#gres a'); if (a) { e.preventDefault(); a.click(); } }
  if (e.key === 'Tab' && $('#modal-root .modal')) {
    const f = $$('#modal-root .modal button, #modal-root .modal input, #modal-root .modal select, #modal-root .modal textarea').filter(x => !x.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
const debTimers = {};
function debRefresh(s) { clearTimeout(debTimers[s]); debTimers[s] = setTimeout(() => refresh[s] && refresh[s](), 160); }

acts.sort = el => { const st = ui[el.dataset.s], k = el.dataset.k; if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'asc'; } st.page = 1; refresh[el.dataset.s](); };
acts.page = el => { ui[el.dataset.s].page += Number(el.dataset.d); refresh[el.dataset.s](); };
acts.collapse = () => { ui.collapsed = !ui.collapsed; render(); };
acts.drawer = () => { ui.drawer = !ui.drawer; render(); };
acts.menu = el => { const t = $('#' + el.dataset.m), was = t.hidden; closeMenus(); t.hidden = !was; };
acts['modal-close'] = () => closeModal();
acts['modal-bg'] = (el, e) => { if (e.target === el) closeModal(); };
acts['modal-confirm'] = () => { const cb = confirmCb; confirmCb = null; closeModal(); if (cb) cb(); };
acts['demo-login'] = el => { $('#email').value = el.dataset.e; $('#password').value = DEMO_PASSWORD; $('#password').focus(); };
acts.logout = () => { pushAudit({ action: 'auth.logout', entity: 'auth', summary: 'Signed out' }); saveDB(); endSession(''); render(); };
acts['open-notif'] = el => { const n = DB.notifications.find(x => x.id === Number(el.dataset.id)); if (n) { n.read = true; saveDB(); closeMenus(); go(n.link || '/notifications'); } };
acts['back'] = el => goBack(el.dataset.to);

function gsearch(q) {
  const box = $('#gres'); q = lc(q);
  if (q.length < 2) { box.hidden = true; return; }
  const qd = normPhone(q);
  const cs = visibleCustomers().filter(c => lc(c.first + ' ' + c.last + ' ' + c.email + ' ' + c.code + ' ' + c.company).includes(q) || (qd.length > 3 && c.phoneN.includes(qd))).slice(0, 5);
  const os = visibleOrders().filter(o => lc(o.code).includes(q) || lc(cName(getCust(o.customerId))).includes(q)).slice(0, 4);
  const is = visibleInteractions().filter(i => lc(i.subject).includes(q)).slice(0, 3);
  let h = '';
  if (cs.length) h += '<div class="hd">Customers</div>' + cs.map(c => '<a href="#" data-go="/customers/' + c.id + '">' + esc(cName(c)) + '<small>' + esc(c.code + ' · ' + c.email) + '</small></a>').join('');
  if (os.length) h += '<div class="hd">Orders</div>' + os.map(o => '<a href="#" data-go="/orders/' + o.id + '">' + esc(o.code) + '<small>' + esc(cName(getCust(o.customerId))) + ' · ' + o.status + '</small></a>').join('');
  if (is.length) h += '<div class="hd">Interactions</div>' + is.map(i => '<a href="#" data-go="/interactions/' + i.id + '">' + esc(i.subject) + '<small>' + esc(cName(getCust(i.customerId))) + '</small></a>').join('');
  box.innerHTML = h || '<div class="row muted">No matches for "' + esc(q) + '".</div>';
  box.hidden = false;
}

/* ---------- dashboard ---------- */
function vDashboard() {
  const u = me(), days = ui.dashDays;
  const custs = visibleCustomers(), orders = visibleOrders(), inters = visibleInteractions();
  const startP = ymd(addDays(new Date(), -(days - 1)));
  const live = o => o.status !== 'Cancelled';
  const sumBy = f => orders.filter(f).reduce((s, o) => s + o.total, 0);
  const paid = sumBy(o => live(o) && o.payment === 'Paid');
  const unpaid = sumBy(o => live(o) && (o.payment === 'Unpaid' || o.payment === 'Partially paid'));
  const mine = i => u.role !== 'employee' || (i.assignee || i.userId) === u.id;
  const pend = inters.filter(i => i.followUp && !i.followUpDone && mine(i));
  const overdue = pend.filter(isOverdue).sort((a, b) => a.followUp < b.followUp ? -1 : 1);
  const upcoming = pend.filter(i => !isOverdue(i)).sort((a, b) => a.followUp < b.followUp ? -1 : 1);
  const dups = can('dup.merge') ? dupPairs() : [];
  const kp = [
    ['Registered customers', custs.filter(c => c.status !== 'Archived').length, DB.customers.filter(c => c.status === 'Archived').length + ' archived', '/customers', ''],
    ['New customers', custs.filter(c => c.registered >= startP).length, 'Last ' + days + ' days', '/customers', ''],
    ['Total orders', orders.length, 'All time', '/orders', ''],
    ['Pending orders', orders.filter(o => o.status === 'Pending').length, 'Waiting for confirmation', '/orders', ''],
    ['Completed orders', orders.filter(o => o.status === 'Delivered').length, 'Delivered', '/orders', ''],
    ['Cancelled orders', orders.filter(o => o.status === 'Cancelled').length, 'All time', '/orders', ''],
    ['Paid total', fmtMoney(paid), 'Excludes cancelled orders', '/orders', ''],
    ['Unpaid total', fmtMoney(unpaid), 'Unpaid and part-paid', '/orders', ''],
    ['Overdue follow-ups', overdue.length, upcoming.length + ' upcoming', '/followups', overdue.length ? 'alert' : '']
  ];
  if (can('dup.merge')) kp.push(['Duplicates to review', dups.length, 'Possible matches', '/reports?type=quality', dups.length ? 'alert' : '']);
  const kpi = kp.map(k => '<a class="kpi ' + k[4] + '" href="#" data-go="' + k[3] + '"><span class="k">' + k[0] + '</span><span class="v">' + k[1] + '</span><span class="s">' + k[2] + '</span></a>').join('');
  const regS = bucketSeries(custs, c => c.registered, () => 1, days);
  const ordS = bucketSeries(orders, o => o.date, () => 1, days);
  const saleS = bucketSeries(orders.filter(live), o => o.date, o => o.total, days);
  const SC = { Pending: 'var(--s4)', Confirmed: 'var(--s1)', Processing: 'var(--s6)', Shipped: 'var(--s3)', Delivered: 'var(--good)', Cancelled: 'var(--crit)' };
  const stRows = ORDER_STATUS.map(s => ({ label: s, v: orders.filter(o => o.status === s).length, color: SC[s] }));
  const inP = inters.filter(i => i.at.slice(0, 10) >= startP);
  const tyRows = INTERACTION_TYPES.map(t => ({ label: t, v: inP.filter(i => i.type === t).length, color: 'var(--s1)' }));
  const recent = inters.slice().sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 5);
  const act = (can('audit') ? DB.audit : DB.audit.filter(a => a.userId === u.id)).slice().sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 6);
  const li = i => '<li><div><a href="#" data-go="/interactions/' + i.id + '">' + esc(i.subject) + '</a><div class="sub">' + esc(cName(getCust(i.customerId))) + '</div></div><span class="sub" style="white-space:nowrap">' + (i.followUp ? fmtDate(i.followUp) : fmtDT(i.at)) + '</span></li>';
  const empty = !DB.customers.length ? '<div class="banner info"><div><b>Your workspace is empty.</b><br><span class="muted">Add your first customer to start recording interactions and orders, or load the fictional sample data from Settings.</span></div><div class="actions"><button class="btn primary" data-go="/customers/new">' + ico('plus') + 'Add customer</button></div></div>' : '';
  const html = pageHead('Dashboard', u.role === 'employee' ? 'Your customers, follow-ups and orders.' : 'Figures calculated from the records in this workspace.',
    '<div class="seg" role="group" aria-label="Period">' + [7, 30, 90].map(d => '<button data-act="dash-days" data-d="' + d + '" aria-pressed="' + (d === days) + '">' + d + ' days</button>').join('') + '</div>') +
    empty + '<div class="kpis">' + kpi + '</div>' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card"><header><div><h2>Customer registrations</h2><p>New customers per ' + (days > 31 ? 'week' : 'day') + '</p></div></header>' + chartHTML('reg', { type: 'bar', points: regS, label: 'Customer registrations over the last ' + days + ' days', color: 'var(--s1)' }) + '</div>' +
    '<div class="card"><header><div><h2>Orders over time</h2><p>Orders placed per ' + (days > 31 ? 'week' : 'day') + '</p></div></header>' + chartHTML('ord', { type: 'line', points: ordS, label: 'Orders over the last ' + days + ' days', color: 'var(--s3)' }) + '</div>' +
    '<div class="card"><header><div><h2>Sales totals</h2><p>Order value per ' + (days > 31 ? 'week' : 'day') + ', cancelled orders excluded</p></div></header>' + chartHTML('sales', { type: 'line', area: true, money: true, points: saleS, label: 'Sales totals over the last ' + days + ' days', color: 'var(--s1)' }) + '</div>' +
    '<div class="card"><header><div><h2>Orders by status</h2><p>All time</p></div></header>' + barRows(stRows, orders.length) + '</div>' +
    '<div class="card"><header><div><h2>Interaction categories</h2><p>Last ' + days + ' days</p></div></header>' + barRows(tyRows, inP.length) + '</div></div>' +
    '<div class="grid g3"><div class="card"><header><h2>Recent interactions</h2><button class="btn sm ghost" data-go="/interactions">View all</button></header><ul class="list">' + (recent.map(li).join('') || '<li class="muted">No interactions recorded yet.</li>') + '</ul></div>' +
    '<div class="card"><header><h2>Upcoming follow-ups</h2><button class="btn sm ghost" data-go="/followups">View all</button></header><ul class="list">' + (upcoming.slice(0, 5).map(li).join('') || '<li class="muted">Nothing scheduled.</li>') + '</ul></div>' +
    '<div class="card"><header><h2>Overdue follow-ups</h2></header><ul class="list">' + (overdue.slice(0, 5).map(li).join('') || '<li class="muted">No overdue follow-ups.</li>') + '</ul></div>' +
    '<div class="card"><header><h2>' + (can('audit') ? 'Recent system activity' : 'Your recent activity') + '</h2>' + (can('audit') ? '<button class="btn sm ghost" data-go="/audit">Audit logs</button>' : '') + '</header><ul class="list">' + (act.map(a => '<li><div>' + esc(a.summary) + '<div class="sub">' + esc(uName(a.userId)) + '</div></div><span class="sub" style="white-space:nowrap">' + fmtDT(a.at) + '</span></li>').join('') || '<li class="muted">No activity yet.</li>') + '</ul></div>' +
    (can('dup.merge') ? '<div class="card"><header><h2>Possible duplicates</h2><button class="btn sm ghost" data-go="/reports?type=quality">Review</button></header><ul class="list">' + (dups.slice(0, 4).map(d => '<li><div>' + esc(cName(d.a)) + ' &amp; ' + esc(cName(d.b)) + '<div class="sub">' + esc(d.why) + '</div></div></li>').join('') || '<li class="muted">No records need review.</li>') + '</ul></div>' : '') +
    '</div>';
  return { html };
}
acts['dash-days'] = el => { ui.dashDays = Number(el.dataset.d); render(); };
