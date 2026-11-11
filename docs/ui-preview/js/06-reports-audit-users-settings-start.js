'use strict';
/* ---------- reports ---------- */
const REPORTS = [['customers', 'Customer directory'], ['registrations', 'Customer registrations'], ['orders', 'Order report'], ['sales', 'Sales summary'], ['status', 'Order status report'], ['interactions', 'Customer interaction report'], ['followups', 'Follow-up report'], ['quality', 'Data quality and duplicate review']];
function reportData(type) {
  const { from, to } = ui.report;
  const cust = id => cName(getCust(id));
  if (type === 'customers') return { cols: ['Customer ID', 'Name', 'Email', 'Phone', 'Company', 'Category', 'Status', 'Registered', 'Assigned to'], rows: DB.customers.filter(c => inRange(c.registered, from, to)).map(c => [c.code, cName(c), c.email, c.phone, c.company, c.category, c.status, c.registered, uName(c.assignedTo)]) };
  if (type === 'registrations') {
    const m = {}; DB.customers.filter(c => inRange(c.registered, from, to)).forEach(c => { const k = c.registered.slice(0, 7); m[k] = (m[k] || 0) + 1; });
    return { cols: ['Month', 'New customers'], rows: Object.keys(m).sort().map(k => [k, m[k]]) };
  }
  if (type === 'orders') return { cols: ['Order', 'Customer', 'Date', 'Status', 'Payment', 'Subtotal', 'Discount', 'Total'], rows: DB.orders.filter(o => inRange(o.date, from, to)).map(o => [o.code, cust(o.customerId), o.date.slice(0, 10), o.status, o.payment, money2(o.subtotal), money2(o.discount), money2(o.total)]) };
  if (type === 'sales') {
    const m = {};
    DB.orders.filter(o => o.status !== 'Cancelled' && inRange(o.date, from, to)).forEach(o => {
      const k = o.date.slice(0, 7), x = m[k] || (m[k] = { n: 0, gross: 0, disc: 0, net: 0, paid: 0, out: 0 });
      x.n++; x.gross += o.subtotal; x.disc += o.discount; x.net += o.total;
      if (o.payment === 'Paid') x.paid += o.total; else if (o.payment !== 'Refunded') x.out += o.total;
    });
    return { cols: ['Month', 'Orders', 'Gross', 'Discounts', 'Net sales', 'Paid', 'Outstanding'], rows: Object.keys(m).sort().map(k => [k, m[k].n, money2(m[k].gross), money2(m[k].disc), money2(m[k].net), money2(m[k].paid), money2(m[k].out)]), note: 'Cancelled orders are excluded. Amounts are in ' + DB.settings.currency + '.' };
  }
  if (type === 'status') return { cols: ['Order status', 'Orders', 'Value'], rows: ORDER_STATUS.map(s => { const l = DB.orders.filter(o => o.status === s && inRange(o.date, from, to)); return [s, l.length, money2(l.reduce((a, o) => a + o.total, 0))]; }) };
  if (type === 'interactions') return { cols: ['Type', 'Total', 'Open', 'In progress', 'Completed'], rows: INTERACTION_TYPES.map(t => { const l = DB.interactions.filter(i => i.type === t && inRange(i.at, from, to)); return [t, l.length, l.filter(i => i.status === 'Open').length, l.filter(i => i.status === 'In progress').length, l.filter(i => i.status === 'Completed').length]; }) };
  if (type === 'followups') return { cols: ['Due', 'Customer', 'Subject', 'Owner', 'State'], rows: DB.interactions.filter(i => i.followUp && inRange(i.followUp, from, to)).sort((a, b) => a.followUp < b.followUp ? -1 : 1).map(i => [i.followUp, cust(i.customerId), i.subject, uName(i.assignee || i.userId), i.followUpDone ? 'Done' : isOverdue(i) ? 'Overdue' : 'Open']) };
  const act = DB.customers.filter(c => c.status !== 'Archived');
  const rows = dupPairs().map(d => ['Possible duplicate', d.a.code + ' and ' + d.b.code, d.why]);
  act.filter(c => !c.email).forEach(c => rows.push(['Missing email', c.code, cName(c)]));
  act.filter(c => !c.phone).forEach(c => rows.push(['Missing phone', c.code, cName(c)]));
  act.filter(c => !DB.interactions.some(i => i.customerId === c.id)).forEach(c => rows.push(['No interactions', c.code, cName(c)]));
  return { cols: ['Issue', 'Record', 'Detail'], rows };
}
function vReports(r) {
  if (r.q.type && r.q.type !== ui.report.lastQ) { ui.report.type = r.q.type; ui.report.lastQ = r.q.type; }
  if (ui.report.type === 'sales' && !can('reports.sales')) ui.report.type = 'customers';
  const type = ui.report.type, list = REPORTS.filter(x => x[0] !== 'sales' || can('reports.sales'));
  const d = reportData(type), shown = d.rows.slice(0, 200);
  let body;
  if (type === 'quality') {
    const pairs = dupPairs();
    body = '<div class="card" style="margin-bottom:16px"><header><div><h2>Possible duplicates</h2><p>Review each pair. Nothing is merged or deleted unless you confirm it.</p></div></header>' + (pairs.length ? '<div class="stack">' + pairs.map(p => '<div class="card" style="background:var(--bg)"><b>' + esc(p.why) + '</b><div class="dupgrid">' + [p.a, p.b].map(o => '<div class="card"><b><a href="#" data-go="/customers/' + o.id + '">' + esc(cName(o)) + '</a></b> ' + badge(o.status) + '<div class="muted mono">' + o.code + '</div><div>' + esc(o.email || 'No email') + '</div><div>' + esc(o.phone) + '</div><div class="muted">Registered ' + fmtDate(o.registered) + ' · ' + DB.orders.filter(x => x.customerId === o.id).length + ' orders</div></div>').join('') + '</div><div class="actions" style="margin-top:12px"><button class="btn" data-act="dup-keep" data-key="' + p.key + '">Keep both</button><button class="btn danger" data-act="dup-merge" data-a="' + p.a.id + '" data-b="' + p.b.id + '">Merge records</button></div></div>').join('') + '</div>' : '<div class="empty sm"><b>No duplicates need review</b>New customers are checked when they are saved.</div>') + '</div>';
    const gaps = d.rows.filter(x => x[0] !== 'Possible duplicate');
    body += '<div class="card"><header><div><h2>Data gaps</h2><p>' + gaps.length + ' items</p></div></header>' + tableHTML(['Issue', 'Record', 'Detail'], gaps.slice(0, 100)) + '</div>';
  } else body = (shown.length ? tableHTML(d.cols, shown) : '<div class="tablewrap"><div class="empty"><b>No records for this report</b>Change the date range or record more activity.</div></div>') + (d.rows.length > 200 ? '<p class="hint" style="margin-top:8px">Showing the first 200 of ' + d.rows.length + ' rows. The export contains all of them.</p>' : '') + (d.note ? '<p class="hint" style="margin-top:8px">' + esc(d.note) + '</p>' : '');
  return { html: pageHead('Reports', 'Preview a report, then export it as CSV.', can('export') ? '<button class="btn primary" data-act="export-report">Export CSV</button>' : '') +
    '<div class="filters"><div class="f grow"><label for="r-t">Report</label><select id="r-t" data-act-change="report">' + opts(list, type) + '</select></div><div class="f"><label for="r-f">From</label><input id="r-f" type="date" value="' + ui.report.from + '" data-rep="from"></div><div class="f"><label for="r-to">To</label><input id="r-to" type="date" value="' + ui.report.to + '" data-rep="to"></div></div>' + body };
}
function tableHTML(cols, rows) {
  const numeric = c => /^(Orders|Total|Gross|Discounts|Net sales|Paid|Outstanding|Value|Subtotal|Discount|New customers|Open|In progress|Completed)$/.test(c);
  return '<div class="tablewrap"><table class="data"><thead><tr>' + cols.map(c => '<th class="' + (numeric(c) ? 'r' : '') + '">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map((v, i) => '<td class="' + (numeric(cols[i]) ? 'r num' : '') + '">' + esc(v === '' ? '—' : v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
document.addEventListener('change', e => {
  if (e.target.id === 'r-t') { ui.report.type = e.target.value; render(); }
  else if (e.target.dataset && e.target.dataset.rep) { ui.report[e.target.dataset.rep] = e.target.value; render(); }
});
document.addEventListener('input', e => { if (e.target.id === 'discountPct') orderCalc(); });
acts['export-report'] = () => {
  if (!can('export')) return toast('You do not have permission to export.', 'bad');
  const type = ui.report.type; if (type === 'sales' && !can('reports.sales')) return toast('Only administrators can export sales summaries.', 'bad');
  const d = reportData(type), name = (REPORTS.find(x => x[0] === type) || [type, type])[1].toLowerCase().replace(/[^a-z]+/g, '-');
  showCSV(name, d.cols, d.rows);
};
acts['dup-keep'] = el => { if (!can('dup.merge')) return; tx(() => { DB.dupReviews.push(el.dataset.key); pushAudit({ action: 'duplicate.dismiss', entity: 'customer', summary: 'Marked pair ' + el.dataset.key + ' as different people' }); }); toast('Both records kept'); render(); };
acts['dup-merge'] = el => {
  if (!can('dup.merge')) return toast('Only a manager or administrator can merge customers.', 'bad');
  const a = getCust(Number(el.dataset.a)), b = getCust(Number(el.dataset.b));
  const keep = a.id < b.id ? a : b, drop = keep === a ? b : a;
  confirmDialog({ title: 'Merge these customers?', body: '<p>Keep <b>' + esc(cName(keep)) + '</b> (' + keep.code + ', the older record) and move all orders and interactions from <b>' + esc(cName(drop)) + '</b> (' + drop.code + ') onto it.</p><p>The second profile is archived, not deleted, and the merge is written to the audit log.</p>', confirm: 'Merge records', danger: true, onConfirm: () => {
    const r = mergeCustomers(keep.id, drop.id);
    toast(r.ok ? 'Merged. ' + r.result.oc + ' orders and ' + r.result.ic + ' interactions moved.' : 'The merge failed and nothing was changed.', r.ok ? '' : 'bad'); render();
  } });
};

/* ---------- audit logs ---------- */
function filteredAudit() {
  const st = ui.audit, q = lc(st.q);
  return DB.audit.filter(a => {
    if (q && !lc(a.summary + ' ' + a.entity + ' ' + (a.entityId || '') + ' ' + a.rid).includes(q)) return false;
    if (st.user && String(a.userId) !== st.user) return false;
    if (st.action && a.action !== st.action) return false;
    return inRange(a.at, st.from, st.to);
  });
}
const auditGetters = { at: a => a.at, user: a => lc(uName(a.userId)), action: a => a.action };
function auditResults() {
  const res = sortPage(filteredAudit(), 'audit', auditGetters);
  if (!res.total) return '<div class="tablewrap"><div class="empty"><b>No audit entries match</b>Adjust the filters, or perform an action to create entries.</div></div>';
  const cols = [{ k: 'at', l: 'Time' }, { k: 'user', l: 'User' }, { k: 'action', l: 'Action' }, { l: 'Record' }, { l: 'Summary' }, { l: 'Request' }];
  const det = a => a.after ? '<details><summary style="cursor:pointer;color:var(--accent)">Changes</summary><div class="mono" style="margin-top:6px">' + Object.keys(a.after).map(k => esc(k) + ': ' + esc(a.before && a.before[k] !== undefined && a.before[k] !== '' ? a.before[k] : '(empty)') + ' → ' + esc(a.after[k] === '' ? '(empty)' : a.after[k])).join('<br>') + '</div></details>' : '';
  return '<div class="tablewrap"><table class="data"><thead>' + thead('audit', cols) + '</thead><tbody>' + res.rows.map(a => '<tr><td style="white-space:nowrap">' + fmtDT(a.at) + '</td><td>' + esc(a.userId ? uName(a.userId) : 'Not signed in') + '</td><td class="mono">' + esc(a.action) + '</td><td class="mono">' + esc(a.entity ? a.entity + (a.entityId ? ' #' + a.entityId : '') : '—') + '</td><td>' + esc(a.summary) + det(a) + '</td><td class="mono muted">' + esc(a.rid) + '</td></tr>').join('') + '</tbody></table></div>' + pager('audit', res.total);
}
refresh.audit = () => { const el = $('#results'); if (el) el.innerHTML = auditResults(); };
function vAudit() {
  const st = ui.audit, actions = Array.from(new Set(DB.audit.map(a => a.action))).sort();
  return { html: pageHead('Audit logs', 'Append-only record of important actions. Entries cannot be edited or deleted by anyone in the application.') +
    '<div class="filters" role="search"><div class="f grow"><label for="a-q">Search</label><input id="a-q" type="search" value="' + esc(st.q) + '" placeholder="Summary, record or request ID" data-input="list" data-s="audit" data-k="q"></div>' +
    '<div class="f"><label for="a-u">User</label><select id="a-u" data-change="filter" data-s="audit" data-k="user">' + opts(DB.users.map(u => [String(u.id), u.name]), st.user, 'All users') + '</select></div>' +
    '<div class="f"><label for="a-a">Action</label><select id="a-a" data-change="filter" data-s="audit" data-k="action">' + opts(actions, st.action, 'All actions') + '</select></div>' +
    '<div class="f"><label for="a-f">From</label><input id="a-f" type="date" value="' + st.from + '" data-change="filter" data-s="audit" data-k="from"></div>' +
    '<div class="f"><label for="a-to">To</label><input id="a-to" type="date" value="' + st.to + '" data-change="filter" data-s="audit" data-k="to"></div></div><div id="results">' + auditResults() + '</div>' };
}

/* ---------- users ---------- */
function vUsers() {
  const u = me();
  return { html: pageHead('User management', 'Create accounts, set roles and deactivate people who have left.', '<button class="btn primary" data-act="add-user">' + ico('plus') + 'Add user</button>') +
    '<div class="tablewrap"><table class="data"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>' + DB.users.map(x =>
      '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.email) + '</td><td><label class="sr" for="role' + x.id + '">Role for ' + esc(x.name) + '</label><select id="role' + x.id + '" data-change="role" data-id="' + x.id + '" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px 6px"' + (x.id === u.id ? ' disabled' : '') + '>' + opts(Object.keys(ROLE_LABEL).map(k => [k, ROLE_LABEL[k]]), x.role) + '</select></td><td>' + badge(x.active ? 'Active' : 'Inactive') + '</td><td>' + (x.lastLogin ? fmtDT(x.lastLogin) : '<span class="muted">Never</span>') + '</td><td class="r">' + (x.id === u.id ? '<span class="muted">You</span>' : '<button class="btn sm ' + (x.active ? 'danger' : '') + '" data-act="toggle-user" data-id="' + x.id + '">' + (x.active ? 'Deactivate' : 'Activate') + '</button>') + '</td></tr>').join('') + '</tbody></table></div>' };
}
acts['add-user'] = () => openModal('<h2 id="mtitle">Add user</h2><form data-form="user-add" novalidate class="stack" style="gap:12px">' + field('uname', 'Full name', 'text', '', { req: true }) + field('uemail', 'Email', 'email', '', { req: true }) + field('urole', 'Role', 'select', '', { options: opts(Object.keys(ROLE_LABEL).map(k => [k, ROLE_LABEL[k]]), 'employee') }) + field('upass', 'Temporary password', 'password', '', { req: true, hint: 'At least 10 characters with a letter and a number.', auto: 'new-password' }) + '<div class="foot"><button type="button" class="btn ghost" data-act="modal-close">Cancel</button><button class="btn primary" type="submit">Create user</button></div></form>');
forms['user-add'] = async f => {
  const d = formData(f), errs = {};
  if (!d.uname) errs.uname = 'Enter the full name.';
  if (!EMAIL_RE.test(d.uemail)) errs.uemail = 'Enter a valid email address.';
  else if (DB.users.some(x => lc(x.email) === lc(d.uemail))) errs.uemail = 'A user with this email already exists.';
  if (d.upass.length < 10 || !/[A-Za-z]/.test(d.upass) || !/\d/.test(d.upass)) errs.upass = 'Use at least 10 characters with a letter and a number.';
  if (Object.keys(errs).length) return showErrors(f, errs);
  const salt = rid(), hash = await sha(d.upass, salt);
  const r = tx(() => { const id = nextId('user'); DB.users.push({ id, name: d.uname, email: d.uemail, role: d.urole, active: true, salt, pwHash: hash, createdAt: new Date().toISOString(), lastLogin: null }); pushAudit({ action: 'user.create', entity: 'user', entityId: id, summary: 'Created ' + ROLE_LABEL[d.urole].toLowerCase() + ' account for ' + d.uname }); });
  closeModal(); toast(r.ok ? 'User created' : 'The user could not be created.', r.ok ? '' : 'bad'); render();
};
function activeAdmins() { return DB.users.filter(x => x.role === 'admin' && x.active).length; }
function changeRole(id, role) {
  const x = DB.users.find(v => v.id === id);
  if (x.role === 'admin' && role !== 'admin' && activeAdmins() <= 1) { toast('At least one active administrator is required.', 'bad'); return render(); }
  const r = tx(() => { const was = x.role; x.role = role; pushAudit({ action: 'user.update', entity: 'user', entityId: id, summary: 'Changed role for ' + x.name, before: { role: was }, after: { role } }); });
  toast(r.ok ? 'Role updated' : 'Could not update the role.', r.ok ? '' : 'bad'); render();
}
acts['toggle-user'] = el => {
  const x = DB.users.find(v => v.id === Number(el.dataset.id));
  const run = () => {
    if (x.active && x.role === 'admin' && activeAdmins() <= 1) return toast('The last active administrator cannot be deactivated.', 'bad');
    const r = tx(() => { x.active = !x.active; pushAudit({ action: 'user.update', entity: 'user', entityId: x.id, summary: (x.active ? 'Activated ' : 'Deactivated ') + x.name, before: { active: !x.active }, after: { active: x.active } }); });
    toast(r.ok ? (x.active ? 'User activated' : 'User deactivated') : 'Could not update the user.', r.ok ? '' : 'bad'); render();
  };
  if (x.active) confirmDialog({ title: 'Deactivate ' + x.name + '?', body: 'They will be signed out and cannot sign in again until reactivated. Their history stays in the system.', confirm: 'Deactivate', danger: true, onConfirm: run }); else run();
};

/* ---------- settings ---------- */
function vSettings() {
  const s = DB.settings;
  let size = 0; try { size = Math.round(JSON.stringify(DB).length / 1024); } catch (e) { size = 0; }
  const count = [['Customers', DB.customers.length], ['Interactions', DB.interactions.length], ['Orders', DB.orders.length], ['Audit entries', DB.audit.length], ['Users', DB.users.length]];
  return { html: pageHead('Settings', 'Preferences, system health and data maintenance.') +
    '<div class="grid g2" style="align-items:start"><form class="card" data-form="settings" novalidate><header><h2>Preferences</h2></header><div class="stack" style="gap:14px">' + field('company', 'Business name', 'text', s.company, { req: true }) +
    field('currency', 'Currency', 'select', '', { options: opts(['KES', 'USD', 'EUR', 'GBP'], s.currency) }) + field('reminderDays', 'Remind me about follow-ups this many days ahead', 'number', s.reminderDays, { min: '1', max: '14', step: '1' }) + '<div><button class="btn primary" type="submit">Save settings</button></div></div></form>' +
    '<div class="card"><header><h2>System health</h2></header><dl class="dl">' + count.map(c => '<dt>' + c[0] + '</dt><dd class="num">' + c[1] + '</dd>').join('') + '<dt>Stored data</dt><dd class="num">' + size + ' KB in this browser</dd><dt>Possible duplicates</dt><dd class="num">' + dupPairs().length + '</dd><dt>Overdue follow-ups</dt><dd class="num">' + DB.interactions.filter(isOverdue).length + '</dd></dl></div>' +
    '<div class="card"><header><div><h2>Recent errors</h2><p>Rejected or rolled-back operations. No personal data is shown.</p></div></header>' + (DB.errors.length ? '<ul class="list">' + DB.errors.slice(0, 8).map(e => '<li><div>' + esc(e.msg) + '</div><span class="sub" style="white-space:nowrap">' + fmtDT(e.at) + '</span></li>').join('') + '</ul>' : '<div class="empty sm">No errors recorded.</div>') + '</div>' +
    '<div class="card"><header><div><h2>Data maintenance</h2><p>This preview keeps its data in your browser only. The full build stores it in MySQL and ships backup and restore scripts.</p></div></header><div class="actions">' +
    (DB.customers.length ? '<button class="btn danger" data-act="clear-data">Clear business data</button>' : '<button class="btn primary" data-act="load-sample">Load sample data</button>') + '</div><p class="hint" style="margin-top:10px">Clearing keeps user accounts and the audit log, so you can see how every screen behaves when the database is empty.</p></div></div>' };
}
forms.settings = f => {
  const d = formData(f), errs = {};
  if (!d.company) errs.company = 'Enter the business name.';
  const days = Number(d.reminderDays);
  if (!Number.isInteger(days) || days < 1 || days > 14) errs.reminderDays = 'Enter a whole number from 1 to 14.';
  if (Object.keys(errs).length) return showErrors(f, errs);
  const r = tx(() => { const before = Object.assign({}, DB.settings); Object.assign(DB.settings, { company: d.company, currency: d.currency, reminderDays: days }); pushAudit({ action: 'settings.update', entity: 'settings', summary: 'Updated system preferences', before: { currency: before.currency, reminderDays: before.reminderDays }, after: { currency: d.currency, reminderDays: days } }); syncReminders(); });
  toast(r.ok ? 'Settings saved' : 'Could not save settings.', r.ok ? '' : 'bad'); render();
};
acts['clear-data'] = () => confirmDialog({ title: 'Clear all business data?', body: 'Customers, interactions, orders and notifications will be removed from this browser. Users and the audit log stay.', confirm: 'Clear data', danger: true, onConfirm: () => {
  const r = tx(() => { const n = DB.customers.length; DB.customers = []; DB.interactions = []; DB.orders = []; DB.notifications = []; DB.dupReviews = []; DB.orderKeys = {}; DB.sampleLoaded = false; pushAudit({ action: 'data.clear', entity: 'system', summary: 'Cleared business data (' + n + ' customers)' }); });
  toast(r.ok ? 'Business data cleared' : 'Could not clear data.', r.ok ? '' : 'bad'); render();
} });
acts['load-sample'] = () => {
  const r = tx(() => { seedBusiness(); pushAudit({ action: 'data.sample', entity: 'system', summary: 'Loaded fictional sample data' }); });
  toast(r.ok ? 'Sample data loaded' : 'Could not load sample data.', r.ok ? '' : 'bad'); render();
};

/* ---------- profile and notifications ---------- */
function vProfile() {
  const u = me();
  return { html: pageHead('My profile', 'Your account details and password.') +
    '<div class="grid g2" style="align-items:start"><div class="card"><header><h2>Account</h2></header><dl class="dl"><dt>Name</dt><dd>' + esc(u.name) + '</dd><dt>Email</dt><dd>' + esc(u.email) + '</dd><dt>Role</dt><dd>' + ROLE_LABEL[u.role] + '</dd><dt>Last sign-in</dt><dd>' + (u.lastLogin ? fmtDT(u.lastLogin) : '—') + '</dd><dt>Session</dt><dd>Signs out after 30 minutes without activity</dd></dl></div>' +
    '<form class="card" data-form="password" novalidate><header><h2>Change password</h2></header><div class="stack" style="gap:14px">' + field('cur', 'Current password', 'password', '', { req: true, auto: 'current-password' }) + field('np', 'New password', 'password', '', { req: true, auto: 'new-password', hint: 'At least 10 characters with a letter and a number.' }) + field('np2', 'Confirm new password', 'password', '', { req: true, auto: 'new-password' }) + '<div><button class="btn primary" type="submit">Update password</button></div></div></form></div>' };
}
forms.password = async f => {
  const d = formData(f), u = me(), errs = {};
  if (await sha(d.cur, u.salt) !== u.pwHash) errs.cur = 'The current password is not correct.';
  if (d.np.length < 10 || !/[A-Za-z]/.test(d.np) || !/\d/.test(d.np)) errs.np = 'Use at least 10 characters with a letter and a number.';
  else if (d.np === d.cur) errs.np = 'Choose a password different from the current one.';
  if (d.np2 !== d.np) errs.np2 = 'The passwords do not match.';
  if (Object.keys(errs).length) return showErrors(f, errs);
  const salt = rid(), hash = await sha(d.np, salt);
  const r = tx(() => { u.salt = salt; u.pwHash = hash; pushAudit({ action: 'auth.password_change', entity: 'user', entityId: u.id, summary: 'Changed own password' }); });
  toast(r.ok ? 'Password updated' : 'Could not update the password.', r.ok ? '' : 'bad'); f.reset();
};
function vNotifications() {
  const all = myNotifs(), list = ui.notif.unread ? all.filter(n => !n.read) : all;
  return { html: pageHead('Notifications', 'Follow-ups, complaints and order changes that need your attention.', '<div class="seg" role="group" aria-label="Filter"><button data-act="notif-filter" data-v="" aria-pressed="' + !ui.notif.unread + '">All</button><button data-act="notif-filter" data-v="1" aria-pressed="' + ui.notif.unread + '">Unread</button></div><button class="btn" data-act="read-all">Mark all as read</button>') +
    (list.length ? '<div class="card"><ul class="list">' + list.map(n => '<li><div><a href="#" data-act="open-notif" data-id="' + n.id + '"' + (n.read ? ' style="font-weight:400;color:var(--muted)"' : '') + '>' + esc(n.text) + '</a><div class="sub">' + esc(n.type) + ' · ' + fmtDT(n.at) + '</div></div>' + (n.read ? '' : '<button class="btn sm" data-act="read-one" data-id="' + n.id + '">Mark read</button>') + '</li>').join('') + '</ul></div>' : '<div class="empty"><b>' + (ui.notif.unread ? 'You are all caught up' : 'No notifications yet') + '</b>Reminders appear here when follow-ups are due.</div>') };
}
acts['notif-filter'] = el => { ui.notif.unread = !!el.dataset.v; render(); };
acts['read-all'] = () => { myNotifs().forEach(n => n.read = true); saveDB(); render(); };
acts['read-one'] = el => { const n = DB.notifications.find(x => x.id === Number(el.dataset.id)); if (n) { n.read = true; saveDB(); render(); } };

/* ---------- boot ---------- */
async function boot() {
  DB = loadDB();
  if (!DB) { await freshDB(); saveDB(); }
  restoreSession();
  if (session) { syncReminders(); saveDB(); }
  render();
  setInterval(checkSession, 30000);
  window.addEventListener('resize', debounce(drawAllCharts, 150));
}
boot().catch(err => { $('#app').innerHTML = '<div class="empty"><b>Veltrix could not start</b>' + esc(err && err.message) + '</div>'; });
