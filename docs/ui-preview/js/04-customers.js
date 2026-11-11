'use strict';
/* ---------- shared: CSV dialog ---------- */
function showCSV(name, cols, rows) {
  const csv = toCSV(cols, rows);
  openModal('<h2 id="mtitle">Export ' + esc(name) + '</h2><p class="muted">' + rows.length + ' rows. Copy the text below and paste it into a file named <span class="mono">' + esc(name) + '.csv</span>. Cells that start with a formula character are neutralised.</p><textarea id="csvbox" readonly aria-label="CSV data">' + esc(csv) + '</textarea><div class="foot"><button class="btn ghost" data-act="modal-close">Close</button><button class="btn primary" data-act="copy-csv">Copy CSV</button></div>');
  pushAudit({ action: 'export.csv', entity: 'report', summary: 'Exported ' + name + ' (' + rows.length + ' rows)' });
  saveDB();
}
acts['copy-csv'] = () => {
  const box = $('#csvbox'); box.focus(); box.select();
  const done = () => toast('CSV copied to the clipboard');
  const fallback = () => { try { document.execCommand('copy'); done(); } catch (e) { toast('Press Ctrl+C to copy the selected text.', 'warn'); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(done, fallback); else fallback();
};
const maskEmail = e => e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '';
const maskPhone = p => p ? '***' + String(p).replace(/\D/g, '').slice(-3) : '';
const staffOpts = (sel, blank) => (blank ? '<option value="">' + esc(blank) + '</option>' : '') + DB.users.filter(u => u.active || u.id === sel).map(u => '<option value="' + u.id + '"' + (u.id === sel ? ' selected' : '') + '>' + esc(u.name) + ' (' + ROLE_LABEL[u.role] + ')</option>').join('');

/* ---------- customers: list ---------- */
function filteredCustomers() {
  const st = ui.cust, q = lc(st.q), qd = normPhone(st.q);
  return visibleCustomers().filter(c => {
    if (q && !(lc(c.first + ' ' + c.last + ' ' + c.email + ' ' + c.code + ' ' + c.company).includes(q) || String(c.id) === q || (qd.length > 3 && c.phoneN.includes(qd)))) return false;
    if (st.cat && c.category !== st.cat) return false;
    if (st.status ? c.status !== st.status : c.status === 'Archived') return false;
    return inRange(c.registered, st.from, st.to);
  });
}
const custGetters = { code: c => c.id, name: c => lc(c.last + ' ' + c.first), email: c => c.email, category: c => c.category, status: c => c.status, registered: c => c.registered };
function custResults() {
  const res = sortPage(filteredCustomers(), 'cust', custGetters);
  const cols = [{ k: 'code', l: 'ID' }, { k: 'name', l: 'Customer' }, { k: 'email', l: 'Contact' }, { k: 'category', l: 'Category' }, { k: 'status', l: 'Status' }, { k: 'registered', l: 'Registered' }, { l: 'Assigned to' }];
  if (!res.total) {
    const filtering = ui.cust.q || ui.cust.cat || ui.cust.status || ui.cust.from || ui.cust.to;
    return '<div class="tablewrap"><div class="empty"><b>' + (filtering ? 'No customers match these filters' : 'No customers yet') + '</b>' + (filtering ? 'Try a different search or clear the filters.' : 'Add your first customer to begin.') + '<div><button class="btn primary" data-go="/customers/new">' + ico('plus') + 'Add customer</button></div></div></div>';
  }
  return '<div class="tablewrap"><table class="data"><thead>' + thead('cust', cols) + '</thead><tbody>' + res.rows.map(c =>
    '<tr><td class="mono">' + c.code + '</td><td><a href="#" data-go="/customers/' + c.id + '" style="color:var(--fg);font-weight:500;text-decoration:none">' + esc(cName(c)) + '</a>' + (c.company ? '<div class="muted" style="font-size:12.5px">' + esc(c.company) + '</div>' : '') + '</td><td>' + (c.email ? esc(c.email) : '<span class="muted">No email</span>') + '<div class="muted" style="font-size:12.5px">' + esc(c.phone) + '</div></td><td>' + esc(c.category) + '</td><td>' + badge(c.status) + '</td><td>' + fmtDate(c.registered) + '</td><td>' + esc(uName(c.assignedTo)) + '</td></tr>').join('') + '</tbody></table></div>' + pager('cust', res.total);
}
refresh.cust = () => { const el = $('#results'); if (el) el.innerHTML = custResults(); };
function vCustomers() {
  const st = ui.cust;
  const html = pageHead('Customers', 'Search, filter and open customer profiles.', (can('export') ? '<button class="btn" data-act="export-customers">Export CSV</button>' : '') + '<button class="btn primary" data-go="/customers/new">' + ico('plus') + 'Add customer</button>') +
    '<div class="filters" role="search" aria-label="Customer filters"><div class="f grow"><label for="c-q">Search</label><input id="c-q" type="search" value="' + esc(st.q) + '" placeholder="Name, email, phone or ID" data-input="list" data-s="cust" data-k="q"></div>' +
    '<div class="f"><label for="c-cat">Category</label><select id="c-cat" data-change="filter" data-s="cust" data-k="cat">' + opts(CATEGORIES, st.cat, 'All categories') + '</select></div>' +
    '<div class="f"><label for="c-st">Status</label><select id="c-st" data-change="filter" data-s="cust" data-k="status">' + opts(CUST_STATUS, st.status, 'Active and inactive') + '</select></div>' +
    '<div class="f"><label for="c-from">Registered from</label><input id="c-from" type="date" value="' + st.from + '" data-change="filter" data-s="cust" data-k="from"></div>' +
    '<div class="f"><label for="c-to">Registered to</label><input id="c-to" type="date" value="' + st.to + '" data-change="filter" data-s="cust" data-k="to"></div>' +
    '<button class="btn ghost" data-act="clear-cust">Clear</button></div><div id="results">' + custResults() + '</div>';
  return { html };
}
acts['clear-cust'] = () => { Object.assign(ui.cust, { q: '', cat: '', status: '', from: '', to: '', page: 1 }); render(); };
acts['export-customers'] = () => {
  if (!can('export')) return toast('You do not have permission to export.', 'bad');
  showCSV('customers', ['Customer ID', 'First name', 'Last name', 'Email', 'Phone', 'Company', 'Category', 'Status', 'Registered', 'Assigned to'],
    filteredCustomers().map(c => [c.code, c.first, c.last, c.email, c.phone, c.company, c.category, c.status, c.registered, uName(c.assignedTo)]));
};

/* ---------- customers: form ---------- */
function vCustomerForm(r) {
  const editing = r.crumbs[r.crumbs.length - 1][0] === 'Edit';
  const c = editing ? getCust(r.id) : null;
  if (editing && !c) return vNotFound();
  if (editing && !canEditCustomer(c)) return { html: pageHead('Edit customer') + '<div class="banner bad"><div>You can only edit customers assigned to you or created by you.</div></div>' };
  const u = me();
  const v = c || { first: '', last: '', email: '', phone: '', company: '', address: '', category: 'Retail', status: 'Active', registered: todayStr(), assignedTo: u.role === 'employee' ? u.id : null, notes: '', version: 1 };
  const html = pageHead(editing ? 'Edit ' + cName(c) : 'Add customer', editing ? c.code : 'Veltrix checks for duplicates before saving.') +
    '<form class="card" data-form="customer" data-id="' + (c ? c.id : '') + '" novalidate><input type="hidden" id="version" name="version" value="' + v.version + '"><div class="fgrid">' +
    field('first', 'First name', 'text', v.first, { req: true, auto: 'off' }) + field('last', 'Last name', 'text', v.last, { req: true, auto: 'off' }) +
    field('email', 'Email', 'email', v.email, { hint: 'Optional. Must be unique among active customers.', auto: 'off' }) + field('phone', 'Phone', 'tel', v.phone, { hint: 'Include the country code, for example +254 700 123 456.', auto: 'off' }) +
    field('company', 'Company', 'text', v.company, { auto: 'off' }) + field('category', 'Category', 'select', '', { options: opts(CATEGORIES, v.category) }) +
    field('status', 'Status', 'select', '', { options: opts(['Active', 'Inactive'], v.status === 'Archived' ? 'Inactive' : v.status) }) +
    field('assignedTo', 'Assigned employee', 'select', '', { options: staffOpts(v.assignedTo, 'Unassigned'), dis: u.role === 'employee' }) +
    field('registered', 'Registration date', 'date', v.registered, { max: todayStr(), req: true }) + field('address', 'Address', 'text', v.address, { auto: 'off' }) +
    field('notes', 'Notes', 'textarea', v.notes, { full: true }) + '</div><div id="dupbox" style="margin-top:16px"></div>' +
    '<div class="form-foot"><button class="btn primary" type="submit">' + (editing ? 'Save changes' : 'Save customer') + '</button><button type="button" class="btn ghost" data-act="back" data-to="/customers">Cancel</button></div></form>';
  return { html };
}
function dupBoxHTML(list, hard) {
  return '<div class="banner ' + (hard ? 'bad' : '') + '" role="alert"><div><b>' + (hard ? 'This email already belongs to an existing customer' : 'Possible duplicate found') + '</b><br><span class="muted">' +
    (hard ? 'Open the existing record instead of creating another profile.' : 'Check the record below. If this is a different person you can still save.') + '</span><div class="dupgrid">' +
    list.map(o => '<div class="card"><b>' + esc(cName(o)) + '</b> ' + badge(o.status) + '<div class="muted mono">' + o.code + '</div><div>' + esc(o.email || 'No email') + '</div><div>' + esc(o.phone) + '</div>' + (o.company ? '<div class="muted">' + esc(o.company) + '</div>' : '') + '<div style="margin-top:8px"><a href="#" data-go="/customers/' + o.id + '">Open this record</a></div></div>').join('') +
    '</div></div>' + (hard ? '' : '<div class="actions"><button type="button" class="btn primary" data-act="dup-confirm">This is a different person, save anyway</button></div>') + '</div>';
}
acts['dup-confirm'] = () => { const f = $('form[data-form="customer"]'); f.dataset.confirmed = '1'; forms.customer(f); };
forms.customer = f => {
  reloadDB();
  const id = Number(f.dataset.id) || 0, d = formData(f), errs = {};
  const u = me();
  if (!d.first) errs.first = 'Enter a first name.'; else if (d.first.length > 60) errs.first = 'Use 60 characters or fewer.';
  if (!d.last) errs.last = 'Enter a last name.'; else if (d.last.length > 60) errs.last = 'Use 60 characters or fewer.';
  if (d.email && !EMAIL_RE.test(d.email)) errs.email = 'Enter a valid email address, such as name@example.com.';
  const pn = normPhone(d.phone);
  if (d.phone && (pn.length < 9 || pn.length > 15)) errs.phone = 'Enter a phone number with 9 to 15 digits.';
  if (!d.email && !d.phone) { errs.email = 'Enter an email address or a phone number.'; errs.phone = 'Enter a phone number or an email address.'; }
  if (!d.registered || d.registered > todayStr()) errs.registered = 'Choose a registration date that is not in the future.';
  if (Object.keys(errs).length) { $('#dupbox', f).innerHTML = ''; showErrors(f, errs); return; }
  showErrors(f, {});
  const cur = id ? getCust(id) : null;
  if (id && !cur) { toast('This customer no longer exists.', 'bad'); return go('/customers'); }
  if (cur && cur.version !== Number(d.version)) {
    $('#dupbox', f).innerHTML = '<div class="banner bad" role="alert"><div><b>Someone else saved changes to this customer first</b><br><span class="muted">Your changes were not saved so nothing is overwritten. Reload to see the latest values and apply your edit again.</span></div><div class="actions"><button type="button" class="btn primary" data-act="reload-form">Reload latest</button></div></div>';
    logError('Edit conflict on customer ' + cur.code);
    return;
  }
  const dup = findDuplicates(d, id);
  if (dup.hard.length) { $('#dupbox', f).innerHTML = dupBoxHTML(dup.hard, true); logError('Customer rejected: email already in use'); return; }
  if (dup.soft.length && !f.dataset.confirmed) { $('#dupbox', f).innerHTML = dupBoxHTML(dup.soft, false); return; }
  const res = tx(() => {
    const now = new Date().toISOString();
    const assigned = u.role === 'employee' ? (cur ? cur.assignedTo : u.id) : (Number(d.assignedTo) || null);
    if (!cur) {
      const nid = nextId('customer');
      const c = { id: nid, code: 'VLX-C-' + String(nid).padStart(6, '0'), first: d.first, last: d.last, email: d.email, emailN: normEmail(d.email), phone: d.phone, phoneN: pn, company: d.company, address: d.address, category: d.category, status: d.status, registered: d.registered, assignedTo: assigned, notes: d.notes, createdAt: now, updatedAt: now, version: 1, createdBy: u.id };
      DB.customers.push(c);
      pushAudit({ action: 'customer.create', entity: 'customer', entityId: nid, summary: 'Created customer ' + c.code });
      return c;
    }
    const before = {}, after = {};
    const set = (k, val, mask) => { if (cur[k] !== val) { before[k] = mask ? mask(cur[k]) : cur[k]; after[k] = mask ? mask(val) : val; cur[k] = val; } };
    set('first', d.first); set('last', d.last); set('email', d.email, maskEmail); cur.emailN = normEmail(d.email);
    set('phone', d.phone, maskPhone); cur.phoneN = pn;
    set('company', d.company); set('address', d.address); set('category', d.category);
    if (cur.status !== 'Archived') set('status', d.status);
    set('assignedTo', assigned); set('notes', d.notes); set('registered', d.registered);
    cur.version++; cur.updatedAt = now;
    pushAudit({ action: 'customer.update', entity: 'customer', entityId: cur.id, summary: 'Updated ' + cur.code + (Object.keys(after).length ? ' (' + Object.keys(after).join(', ') + ')' : ' (no field changes)'), before, after });
    return cur;
  });
  if (!res.ok) { toast('The customer could not be saved. No changes were made.', 'bad'); return; }
  toast(cur ? 'Customer updated' : 'Customer created');
  go('/customers/' + res.result.id);
};
acts['reload-form'] = () => { reloadDB(); render(); };

/* ---------- customers: detail ---------- */
function vCustomerDetail(r) {
  const c = getCust(r.id);
  if (!c || (me().role === 'employee' && !visIds().has(c.id))) return vNotFound();
  const inters = DB.interactions.filter(i => i.customerId === c.id).sort((a, b) => a.at < b.at ? 1 : -1);
  const orders = DB.orders.filter(o => o.customerId === c.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const hist = DB.audit.filter(a => a.entity === 'customer' && a.entityId === c.id).sort((a, b) => a.at < b.at ? 1 : -1);
  const ltv = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
  const tab = ui.custTab;
  let body;
  if (tab === 'timeline') body = inters.length ? '<ol class="timeline">' + inters.map(i =>
    '<li class="' + (i.type === 'Complaint' ? 'complaint' : '') + '"><div class="t"><a href="#" data-go="/interactions/' + i.id + '" style="color:var(--fg);font-weight:500;text-decoration:none">' + esc(i.subject) + '</a>' + badge(i.type) + badge(isOverdue(i) ? 'Overdue' : i.status) + '<span class="when">' + fmtDT(i.at) + ' · ' + esc(uName(i.userId)) + '</span></div><p>' + esc(i.notes) + (i.outcome ? ' <b style="color:var(--fg)">Outcome:</b> ' + esc(i.outcome) + '.' : '') + (i.followUp ? ' Follow-up ' + (i.followUpDone ? 'done' : 'due ' + fmtDate(i.followUp)) + '.' : '') + '</p></li>').join('') + '</ol>'
    : '<div class="empty sm"><b>No interactions yet</b>Record the first call, email or meeting with this customer.</div>';
  else if (tab === 'orders') body = orders.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Payment</th><th class="r">Total</th></tr></thead><tbody>' + orders.map(o => '<tr><td><a href="#" data-go="/orders/' + o.id + '" class="mono">' + o.code + '</a></td><td>' + fmtDate(o.date) + '</td><td>' + badge(o.status) + '</td><td>' + badge(o.payment) + '</td><td class="r num">' + fmtMoney(o.total) + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty sm"><b>No orders yet</b>Create an order for this customer.</div>';
  else body = hist.length ? '<ul class="list">' + hist.map(h => '<li><div>' + esc(h.summary) + '<div class="sub">' + esc(uName(h.userId)) + (h.after ? ' · ' + Object.keys(h.after).map(k => esc(k) + ': ' + esc(h.before && h.before[k] !== undefined && h.before[k] !== '' ? h.before[k] : '(empty)') + ' → ' + esc(h.after[k] === '' ? '(empty)' : h.after[k])).join('; ') : '') + '</div></div><span class="sub" style="white-space:nowrap">' + fmtDT(h.at) + '</span></li>').join('') + '</ul>' : '<div class="empty sm">No recorded changes.</div>';
  const canE = canEditCustomer(c);
  const html = pageHead(cName(c), '<span class="mono">' + c.code + '</span> &nbsp;' + badge(c.status) + ' ' + badge(c.category),
    (canE && c.status !== 'Archived' ? '<button class="btn" data-go="/customers/' + c.id + '/edit">Edit</button>' : '') +
    (c.status !== 'Archived' ? '<button class="btn" data-go="/interactions/new?customer=' + c.id + '">Add interaction</button><button class="btn primary" data-go="/orders/new?customer=' + c.id + '">Create order</button>' : '') +
    (can('customers.archive') ? (c.status === 'Archived' ? '<button class="btn" data-act="restore-cust" data-id="' + c.id + '">Restore</button>' : '<button class="btn danger" data-act="archive-cust" data-id="' + c.id + '">Archive</button>') : '')) +
    (c.status === 'Archived' ? '<div class="banner"><div>This customer is archived' + (c.mergedInto ? ' and was merged into ' + esc(cName(getCust(c.mergedInto))) : '') + '. History is kept, but new orders and edits are blocked.</div></div>' : '') +
    '<div class="detail-grid"><div class="card"><header><h2>Profile</h2></header><dl class="dl"><dt>Email</dt><dd>' + esc(c.email || '—') + '</dd><dt>Phone</dt><dd>' + esc(c.phone || '—') + '</dd><dt>Company</dt><dd>' + esc(c.company || '—') + '</dd><dt>Address</dt><dd>' + esc(c.address || '—') + '</dd><dt>Registered</dt><dd>' + fmtDate(c.registered) + '</dd><dt>Assigned to</dt><dd>' + esc(uName(c.assignedTo)) + '</dd><dt>Orders</dt><dd>' + orders.length + ' (lifetime value ' + fmtMoney(ltv) + ')</dd><dt>Last updated</dt><dd>' + fmtDT(c.updatedAt) + '</dd><dt>Notes</dt><dd>' + esc(c.notes || '—') + '</dd></dl></div>' +
    '<div class="card"><div class="tabs" role="tablist">' + [['timeline', 'Interaction timeline (' + inters.length + ')'], ['orders', 'Orders (' + orders.length + ')'], ['history', 'Change history (' + hist.length + ')']].map(t => '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="cust-tab" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + body + '</div></div>';
  return { html };
}
acts['cust-tab'] = el => { ui.custTab = el.dataset.t; render(); };
acts['archive-cust'] = el => {
  const c = getCust(Number(el.dataset.id));
  confirmDialog({ title: 'Archive ' + cName(c) + '?', body: 'The profile, orders and interactions are kept. The customer disappears from default lists and cannot receive new orders until restored.', confirm: 'Archive customer', danger: true, onConfirm: () => {
    if (!can('customers.archive')) return toast('You do not have permission to archive customers.', 'bad');
    const r = tx(() => { const x = getCust(c.id); const was = x.status; x.status = 'Archived'; x.version++; x.updatedAt = new Date().toISOString(); pushAudit({ action: 'customer.archive', entity: 'customer', entityId: x.id, summary: 'Archived ' + x.code, before: { status: was }, after: { status: 'Archived' } }); });
    toast(r.ok ? 'Customer archived' : 'Could not archive. No changes were made.', r.ok ? '' : 'bad'); render();
  } });
};
acts['restore-cust'] = el => {
  const r = tx(() => {
    const x = getCust(Number(el.dataset.id));
    const clash = x.emailN && DB.customers.find(o => o.id !== x.id && o.status !== 'Archived' && o.emailN === x.emailN);
    if (clash) throw new Error('Email now belongs to ' + clash.code);
    x.status = 'Active'; x.version++; x.updatedAt = new Date().toISOString();
    pushAudit({ action: 'customer.restore', entity: 'customer', entityId: x.id, summary: 'Restored ' + x.code, before: { status: 'Archived' }, after: { status: 'Active' } });
  });
  toast(r.ok ? 'Customer restored' : 'Could not restore: ' + r.error.message, r.ok ? '' : 'bad'); render();
};

/* ---------- merge (explicit, authorised) ---------- */
function mergeCustomers(keepId, dropId) {
  return tx(() => {
    const keep = getCust(keepId), drop = getCust(dropId);
    if (!keep || !drop || keep.id === drop.id) throw new Error('Invalid merge');
    let oc = 0, ic = 0;
    DB.orders.forEach(o => { if (o.customerId === drop.id) { o.customerId = keep.id; oc++; } });
    DB.interactions.forEach(i => { if (i.customerId === drop.id) { i.customerId = keep.id; ic++; } });
    drop.status = 'Archived'; drop.mergedInto = keep.id; drop.version++; drop.updatedAt = new Date().toISOString();
    DB.dupReviews.push(pairKey(keep.id, drop.id));
    pushAudit({ action: 'customer.merge', entity: 'customer', entityId: keep.id, summary: 'Merged ' + drop.code + ' into ' + keep.code + ' (' + oc + ' orders, ' + ic + ' interactions moved)', before: { archived: drop.code }, after: { keptRecord: keep.code } });
    return { oc, ic };
  });
}
