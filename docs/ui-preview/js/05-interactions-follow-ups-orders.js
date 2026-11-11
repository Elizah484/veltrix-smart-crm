'use strict';
/* ---------- interactions: list ---------- */
function filteredInteractions() {
  const st = ui.inter, q = lc(st.q);
  return visibleInteractions().filter(i => {
    if (q && !lc(i.subject + ' ' + i.notes + ' ' + cName(getCust(i.customerId))).includes(q)) return false;
    if (st.type && i.type !== st.type) return false;
    if (st.status && i.status !== st.status) return false;
    return inRange(i.at, st.from, st.to);
  });
}
const interGetters = { at: i => i.at, customer: i => lc(cName(getCust(i.customerId))), type: i => i.type, subject: i => lc(i.subject), status: i => i.status, followUp: i => i.followUp || '9999' };
function interResults() {
  const res = sortPage(filteredInteractions(), 'inter', interGetters);
  if (!res.total) return '<div class="tablewrap"><div class="empty"><b>No interactions found</b>Record a call, email or meeting from a customer profile, or adjust the filters.</div></div>';
  const cols = [{ k: 'at', l: 'Date' }, { k: 'customer', l: 'Customer' }, { k: 'type', l: 'Type' }, { k: 'subject', l: 'Subject' }, { l: 'Employee' }, { k: 'status', l: 'Status' }, { k: 'followUp', l: 'Follow-up' }];
  return '<div class="tablewrap"><table class="data"><thead>' + thead('inter', cols) + '</thead><tbody>' + res.rows.map(i =>
    '<tr><td>' + fmtDT(i.at) + '</td><td>' + custLink(getCust(i.customerId)) + '</td><td>' + esc(i.type) + '</td><td><a href="#" data-go="/interactions/' + i.id + '" style="color:var(--fg);font-weight:500;text-decoration:none">' + esc(i.subject) + '</a></td><td>' + esc(uName(i.userId)) + '</td><td>' + badge(isOverdue(i) ? 'Overdue' : i.status) + '</td><td>' + (i.followUp ? (i.followUpDone ? '<span class="muted">Done</span>' : fmtDate(i.followUp)) : '<span class="muted">None</span>') + '</td></tr>').join('') + '</tbody></table></div>' + pager('inter', res.total);
}
refresh.inter = () => { const el = $('#results'); if (el) el.innerHTML = interResults(); };
function vInteractions() {
  const st = ui.inter;
  return { html: pageHead('Interactions', 'Every call, email, meeting and complaint, newest first.', '<button class="btn primary" data-go="/interactions/new">' + ico('plus') + 'Add interaction</button>') +
    '<div class="filters" role="search"><div class="f grow"><label for="i-q">Search</label><input id="i-q" type="search" value="' + esc(st.q) + '" placeholder="Subject, notes or customer" data-input="list" data-s="inter" data-k="q"></div>' +
    '<div class="f"><label for="i-t">Type</label><select id="i-t" data-change="filter" data-s="inter" data-k="type">' + opts(INTERACTION_TYPES, st.type, 'All types') + '</select></div>' +
    '<div class="f"><label for="i-s">Status</label><select id="i-s" data-change="filter" data-s="inter" data-k="status">' + opts(INTERACTION_STATUS, st.status, 'All statuses') + '</select></div>' +
    '<div class="f"><label for="i-f">From</label><input id="i-f" type="date" value="' + st.from + '" data-change="filter" data-s="inter" data-k="from"></div>' +
    '<div class="f"><label for="i-to">To</label><input id="i-to" type="date" value="' + st.to + '" data-change="filter" data-s="inter" data-k="to"></div></div><div id="results">' + interResults() + '</div>' };
}

/* ---------- interactions: form and detail ---------- */
function vInteractionForm(r) {
  const editing = r.crumbs[r.crumbs.length - 1][0] === 'Edit';
  const it = editing ? getInter(r.id) : null;
  if (editing && !it) return vNotFound();
  if (editing && !canEditInteraction(it)) return { html: pageHead('Edit interaction') + '<div class="banner bad"><div>Employees can edit only the interactions they recorded.</div></div>' };
  const u = me();
  const preset = Number(r.q.customer) || (it ? it.customerId : 0);
  const custList = visibleCustomers().filter(c => c.status !== 'Archived' || c.id === preset);
  const v = it || { customerId: preset, type: 'Phone call', at: new Date().toISOString(), subject: '', notes: '', outcome: '', followUp: '', status: 'Open', assignee: u.id, userId: u.id };
  const html = pageHead(editing ? 'Edit interaction' : 'Add interaction', editing ? 'Changes are recorded in the interaction history.' : 'Link the conversation to the correct customer.') +
    '<form class="card" data-form="interaction" data-id="' + (it ? it.id : '') + '" novalidate><div class="fgrid">' +
    field('customerId', 'Customer', 'select', '', { req: true, options: '<option value="">Choose a customer</option>' + custList.map(c => '<option value="' + c.id + '"' + (c.id === v.customerId ? ' selected' : '') + '>' + esc(cName(c) + ' · ' + c.code) + '</option>').join('') }) +
    field('type', 'Interaction type', 'select', '', { req: true, options: opts(INTERACTION_TYPES, v.type) }) +
    field('at', 'Date and time', 'datetime-local', localDT(new Date(v.at)), { req: true, max: localDT(new Date()) }) +
    field('status', 'Status', 'select', '', { options: opts(INTERACTION_STATUS, v.status) }) +
    field('subject', 'Subject', 'text', v.subject, { req: true, full: true, auto: 'off' }) +
    field('notes', 'Description or notes', 'textarea', v.notes, { full: true }) +
    field('outcome', 'Outcome', 'text', v.outcome, { auto: 'off' }) +
    field('followUp', 'Follow-up date', 'date', v.followUp, { hint: 'Leave empty if no follow-up is needed.', min: it && it.followUp && it.followUp < todayStr() ? it.followUp : todayStr() }) +
    (can('followups.assign') ? field('assignee', 'Follow-up owner', 'select', '', { options: staffOpts(v.assignee || v.userId, 'Me') }) : '') +
    '</div><div class="form-foot"><button class="btn primary" type="submit">' + (editing ? 'Save changes' : 'Save interaction') + '</button><button type="button" class="btn ghost" data-act="back" data-to="/interactions">Cancel</button></div></form>';
  return { html };
}
forms.interaction = f => {
  reloadDB();
  const id = Number(f.dataset.id) || 0, d = formData(f), errs = {}, u = me();
  const cust = getCust(Number(d.customerId));
  if (!cust) errs.customerId = 'Choose the customer this interaction belongs to.';
  else if (cust.status === 'Archived' && !id) errs.customerId = 'Archived customers cannot receive new interactions.';
  if (!d.subject) errs.subject = 'Enter a short subject.'; else if (d.subject.length > 120) errs.subject = 'Use 120 characters or fewer.';
  const when = new Date(d.at);
  if (!d.at || isNaN(when)) errs.at = 'Enter the date and time.';
  else if (when.getTime() > Date.now() + 60000) errs.at = 'The interaction cannot be in the future. Use a follow-up date to schedule ahead.';
  const cur = id ? getInter(id) : null;
  if (d.followUp) {
    if (d.followUp < d.at.slice(0, 10)) errs.followUp = 'The follow-up cannot be before the interaction date.';
    else if (d.followUp < todayStr() && !(cur && cur.followUp === d.followUp)) errs.followUp = 'Choose today or a later date.';
  }
  if (Object.keys(errs).length) { showErrors(f, errs); return; }
  const res = tx(() => {
    const now = new Date().toISOString();
    const assignee = d.followUp ? (can('followups.assign') ? (Number(d.assignee) || u.id) : (cur ? (cur.assignee || u.id) : u.id)) : null;
    if (!cur) {
      const nid = nextId('interaction');
      const i = { id: nid, customerId: cust.id, type: d.type, at: when.toISOString(), userId: u.id, subject: d.subject, notes: d.notes, outcome: d.outcome, followUp: d.followUp, followUpDone: false, assignee, status: d.status, createdAt: now, updatedAt: now, history: [] };
      DB.interactions.push(i);
      pushAudit({ action: 'interaction.create', entity: 'interaction', entityId: nid, summary: 'Recorded ' + d.type.toLowerCase() + ' for ' + cust.code });
      if (d.type === 'Complaint') notify(managersAndAdmins().filter(x => x !== u.id), 'complaint', 'New complaint from ' + cName(cust) + ': ' + d.subject, '/interactions/' + nid);
      if (d.followUp) notify([assignee], 'followup', 'Follow-up scheduled for ' + fmtDate(d.followUp) + ': ' + d.subject, '/interactions/' + nid);
      return i;
    }
    const changes = [];
    const set = (k, val, label) => { if (cur[k] !== val) { changes.push(label + ': ' + (cur[k] === '' || cur[k] == null ? '(empty)' : cur[k]) + ' → ' + (val === '' || val == null ? '(empty)' : val)); cur[k] = val; } };
    set('customerId', cust.id, 'customer'); set('type', d.type, 'type'); set('at', when.toISOString(), 'time'); set('status', d.status, 'status'); set('subject', d.subject, 'subject');
    set('notes', d.notes, 'notes'); set('outcome', d.outcome, 'outcome'); set('followUp', d.followUp, 'follow-up'); set('assignee', assignee, 'owner');
    if (changes.length) { cur.history.push({ at: now, userId: u.id, summary: changes.join('; ') }); pushAudit({ action: 'interaction.update', entity: 'interaction', entityId: cur.id, summary: 'Updated interaction #' + cur.id + ' for ' + cust.code }); }
    cur.updatedAt = now;
    return cur;
  });
  if (!res.ok) return toast('The interaction could not be saved. No changes were made.', 'bad');
  toast(cur ? 'Interaction updated' : 'Interaction recorded');
  go('/interactions/' + res.result.id);
};
function vInteractionDetail(r) {
  const i = getInter(r.id);
  if (!i || !visIds().has(i.customerId)) return vNotFound();
  const c = getCust(i.customerId);
  const html = pageHead(i.subject, badge(i.type) + ' ' + badge(isOverdue(i) ? 'Overdue' : i.status),
    (canEditInteraction(i) ? '<button class="btn" data-go="/interactions/' + i.id + '/edit">Edit</button>' : '') +
    (i.followUp && !i.followUpDone && (canEditInteraction(i) || can('followups.assign') || i.assignee === me().id) ? '<button class="btn primary" data-act="complete-fu" data-id="' + i.id + '">' + ico('check') + 'Mark follow-up done</button>' : '')) +
    '<div class="detail-grid"><div class="card"><header><h2>Details</h2></header><dl class="dl"><dt>Customer</dt><dd>' + custLink(c) + '</dd><dt>When</dt><dd>' + fmtDT(i.at) + '</dd><dt>Employee</dt><dd>' + esc(uName(i.userId)) + '</dd><dt>Outcome</dt><dd>' + esc(i.outcome || '—') + '</dd><dt>Follow-up</dt><dd>' + (i.followUp ? fmtDate(i.followUp) + (i.followUpDone ? ' (done)' : isOverdue(i) ? ' (overdue by ' + daysBetween(i.followUp, todayStr()) + ' days)' : '') + '<br><span class="muted">Owner: ' + esc(uName(i.assignee)) + '</span>' : '—') + '</dd></dl></div>' +
    '<div class="stack"><div class="card"><header><h2>Notes</h2></header><p>' + esc(i.notes || 'No notes recorded.') + '</p></div><div class="card"><header><h2>Change history</h2></header>' +
    (i.history.length ? '<ul class="list">' + i.history.slice().reverse().map(h => '<li><div>' + esc(h.summary) + '<div class="sub">' + esc(uName(h.userId)) + '</div></div><span class="sub" style="white-space:nowrap">' + fmtDT(h.at) + '</span></li>').join('') + '</ul>' : '<div class="empty sm">No changes since it was recorded.</div>') + '</div></div></div>';
  return { html };
}
function completeFU(id) {
  const r = tx(() => {
    const i = getInter(id); const u = me();
    if (!i) throw new Error('Interaction not found');
    i.followUpDone = true; i.status = 'Completed'; i.updatedAt = new Date().toISOString();
    i.history.push({ at: i.updatedAt, userId: u.id, summary: 'Follow-up marked done' });
    DB.notifications.forEach(n => { if (n.key === 'ov-' + id || n.key === 'up-' + id) n.read = true; });
    pushAudit({ action: 'interaction.complete', entity: 'interaction', entityId: id, summary: 'Completed follow-up for interaction #' + id });
  });
  toast(r.ok ? 'Follow-up marked done' : 'Could not update the follow-up.', r.ok ? '' : 'bad');
  render();
}
acts['complete-fu'] = el => completeFU(Number(el.dataset.id));
function assignFollowUp(id, uid) {
  if (!can('followups.assign')) return toast('You do not have permission to assign follow-ups.', 'bad');
  const r = tx(() => {
    const i = getInter(id); const before = i.assignee;
    i.assignee = uid || i.userId; i.updatedAt = new Date().toISOString();
    i.history.push({ at: i.updatedAt, userId: me().id, summary: 'Follow-up owner: ' + uName(before) + ' → ' + uName(i.assignee) });
    notify([i.assignee], 'followup', 'You were assigned a follow-up: ' + i.subject, '/interactions/' + id);
    pushAudit({ action: 'interaction.assign', entity: 'interaction', entityId: id, summary: 'Assigned follow-up #' + id + ' to ' + uName(i.assignee) });
  });
  toast(r.ok ? 'Follow-up assigned' : 'Could not assign the follow-up.', r.ok ? '' : 'bad');
  render();
}

/* ---------- follow-ups ---------- */
function vFollowups() {
  const u = me();
  const mine = i => u.role !== 'employee' || (i.assignee || i.userId) === u.id;
  const all = visibleInteractions().filter(i => i.followUp && mine(i));
  const sets = {
    overdue: all.filter(isOverdue).sort((a, b) => a.followUp < b.followUp ? -1 : 1),
    upcoming: all.filter(i => !i.followUpDone && !isOverdue(i)).sort((a, b) => a.followUp < b.followUp ? -1 : 1),
    done: all.filter(i => i.followUpDone).sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1).slice(0, 20)
  };
  const tab = ui.followTab, rows = sets[tab];
  const due = i => { const d = daysBetween(todayStr(), i.followUp); return i.followUpDone ? 'Done' : d === 0 ? 'Due today' : d < 0 ? Math.abs(d) + ' day' + (d === -1 ? '' : 's') + ' overdue' : 'In ' + d + ' day' + (d === 1 ? '' : 's'); };
  const body = rows.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>Due</th><th>Customer</th><th>Subject</th><th>Owner</th><th>State</th><th></th></tr></thead><tbody>' + rows.map(i =>
    '<tr><td>' + fmtDate(i.followUp) + '</td><td>' + custLink(getCust(i.customerId)) + '</td><td><a href="#" data-go="/interactions/' + i.id + '" style="color:var(--fg);text-decoration:none;font-weight:500">' + esc(i.subject) + '</a></td><td>' +
    (can('followups.assign') && !i.followUpDone ? '<label class="sr" for="as' + i.id + '">Assign follow-up</label><select id="as' + i.id + '" data-change="assign" data-id="' + i.id + '" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px 6px">' + staffOpts(i.assignee || i.userId) + '</select>' : esc(uName(i.assignee || i.userId))) +
    '</td><td>' + badge(i.followUpDone ? 'Completed' : isOverdue(i) ? 'Overdue' : 'Open') + ' <span class="muted" style="font-size:12.5px">' + due(i) + '</span></td><td class="r">' + (i.followUpDone ? '' : '<button class="btn sm" data-act="complete-fu" data-id="' + i.id + '">Mark done</button>') + '</td></tr>').join('') + '</tbody></table></div>'
    : '<div class="tablewrap"><div class="empty"><b>' + (tab === 'overdue' ? 'No overdue follow-ups' : tab === 'upcoming' ? 'No upcoming follow-ups' : 'No completed follow-ups yet') + '</b>' + (tab === 'overdue' ? 'Everything scheduled is on time.' : 'Schedule one when you record an interaction.') + '</div></div>';
  return { html: pageHead('Follow-ups', u.role === 'employee' ? 'Follow-ups assigned to you.' : 'Follow-ups across the team. Managers can reassign them.', '<button class="btn primary" data-go="/interactions/new">' + ico('plus') + 'Add interaction</button>') +
    '<div class="tabs" role="tablist">' + [['overdue', 'Overdue'], ['upcoming', 'Upcoming'], ['done', 'Completed']].map(t => '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="follow-tab" data-t="' + t[0] + '">' + t[1] + ' (' + sets[t[0]].length + ')</button>').join('') + '</div>' + body };
}
acts['follow-tab'] = el => { ui.followTab = el.dataset.t; render(); };

/* ---------- orders: list ---------- */
function filteredOrders() {
  const st = ui.ord, q = lc(st.q);
  return visibleOrders().filter(o => {
    if (q && !(lc(o.code).includes(q) || lc(cName(getCust(o.customerId))).includes(q))) return false;
    if (st.status && o.status !== st.status) return false;
    if (st.pay && o.payment !== st.pay) return false;
    return inRange(o.date, st.from, st.to);
  });
}
const ordGetters = { code: o => o.id, customer: o => lc(cName(getCust(o.customerId))), date: o => o.date, status: o => o.status, pay: o => o.payment, total: o => o.total };
function ordResults() {
  const res = sortPage(filteredOrders(), 'ord', ordGetters);
  if (!res.total) return '<div class="tablewrap"><div class="empty"><b>No orders found</b>Create an order for an existing customer, or adjust the filters.<div><button class="btn primary" data-go="/orders/new">' + ico('plus') + 'Create order</button></div></div></div>';
  const cols = [{ k: 'code', l: 'Order' }, { k: 'customer', l: 'Customer' }, { k: 'date', l: 'Date' }, { k: 'status', l: 'Status' }, { k: 'pay', l: 'Payment' }, { l: 'Items', cls: 'r' }, { k: 'total', l: 'Total', cls: 'r' }];
  return '<div class="tablewrap"><table class="data"><thead>' + thead('ord', cols) + '</thead><tbody>' + res.rows.map(o =>
    '<tr><td><a href="#" data-go="/orders/' + o.id + '" class="mono">' + o.code + '</a></td><td>' + custLink(getCust(o.customerId)) + '</td><td>' + fmtDate(o.date) + '</td><td>' + badge(o.status) + '</td><td>' + badge(o.payment) + '</td><td class="r num">' + o.items.reduce((s, i) => s + i.qty, 0) + '</td><td class="r num">' + fmtMoney(o.total) + '</td></tr>').join('') + '</tbody></table></div>' + pager('ord', res.total);
}
refresh.ord = () => { const el = $('#results'); if (el) el.innerHTML = ordResults(); };
function vOrders() {
  const st = ui.ord;
  return { html: pageHead('Orders', 'Search and filter every order.', '<button class="btn primary" data-go="/orders/new">' + ico('plus') + 'Create order</button>') +
    '<div class="filters" role="search"><div class="f grow"><label for="o-q">Search</label><input id="o-q" type="search" value="' + esc(st.q) + '" placeholder="Order number or customer" data-input="list" data-s="ord" data-k="q"></div>' +
    '<div class="f"><label for="o-s">Order status</label><select id="o-s" data-change="filter" data-s="ord" data-k="status">' + opts(ORDER_STATUS, st.status, 'All statuses') + '</select></div>' +
    '<div class="f"><label for="o-p">Payment</label><select id="o-p" data-change="filter" data-s="ord" data-k="pay">' + opts(PAY_STATUS, st.pay, 'All payments') + '</select></div>' +
    '<div class="f"><label for="o-f">From</label><input id="o-f" type="date" value="' + st.from + '" data-change="filter" data-s="ord" data-k="from"></div>' +
    '<div class="f"><label for="o-to">To</label><input id="o-to" type="date" value="' + st.to + '" data-change="filter" data-s="ord" data-k="to"></div></div><div id="results">' + ordResults() + '</div>' };
}

/* ---------- orders: create ---------- */
let orderKey = '';
function itemRow(it) {
  it = it || { name: '', qty: 1, unit: 0 };
  return '<div class="fgrid item-row" style="grid-template-columns:minmax(0,2fr) minmax(70px,.6fr) minmax(90px,1fr) auto;align-items:end;margin-bottom:10px"><div class="field"><label>Product</label><input name="iname" list="plist" value="' + esc(it.name) + '" data-input="order-calc" autocomplete="off"></div><div class="field"><label>Qty</label><input name="iqty" type="number" min="1" max="999" step="1" value="' + it.qty + '" data-input="order-calc"></div><div class="field"><label>Unit price</label><input name="iprice" type="number" min="0.01" step="0.01" value="' + (it.unit ? money2(it.unit) : '') + '" data-input="order-calc"></div><button type="button" class="btn ghost sm" data-act="rm-item" aria-label="Remove item">Remove</button></div>';
}
function readItems(f) {
  return $$('.item-row', f).map(r => ({ name: $('[name=iname]', r).value.trim(), qty: Number($('[name=iqty]', r).value), unitRaw: $('[name=iprice]', r).value }));
}
function orderCalc() {
  const f = $('form[data-form="order"]'); if (!f) return;
  const items = readItems(f).filter(i => i.name && i.qty > 0 && parseFloat(i.unitRaw) > 0).map(i => ({ qty: Math.floor(i.qty), unit: Math.round(parseFloat(i.unitRaw) * 100) }));
  const pct = Math.min(100, Math.max(0, Number($('#discountPct', f).value) || 0));
  const t = calcTotals(items, pct);
  $('#totals').innerHTML = '<dl class="dl"><dt>Subtotal</dt><dd class="num">' + fmtMoney(t.subtotal) + '</dd><dt>Discount (' + pct + '%)</dt><dd class="num">−' + fmtMoney(t.discount) + '</dd><dt><b>Total</b></dt><dd class="num"><b>' + fmtMoney(t.total) + '</b></dd></dl>';
}
function vOrderForm(r) {
  const u = me(); orderKey = 'ord-' + rid() + rid();
  const preset = Number(r.q.customer) || 0;
  const custs = visibleCustomers().filter(c => c.status === 'Active');
  const html = pageHead('Create order', 'Totals are recalculated when the order is saved.') +
    '<form class="card" data-form="order" novalidate><datalist id="plist">' + PRODUCTS.map(p => '<option value="' + esc(p[0]) + '">').join('') + '</datalist><div class="fgrid">' +
    field('customerId', 'Customer', 'select', '', { req: true, full: true, options: '<option value="">Choose a customer</option>' + custs.map(c => '<option value="' + c.id + '"' + (c.id === preset ? ' selected' : '') + '>' + esc(cName(c) + ' · ' + c.code) + '</option>').join(''), hint: 'Only active customers can receive orders.' }) + '</div>' +
    '<h3 style="margin:20px 0 10px">Items</h3><div id="items">' + itemRow({ name: PRODUCTS[0][0], qty: 1, unit: PRODUCTS[0][1] * 100 }) + '</div><span class="err" id="items-err" role="alert"></span><button type="button" class="btn sm" data-act="add-item">' + ico('plus') + 'Add item</button>' +
    '<div class="fgrid" style="margin-top:18px">' + field('discountPct', 'Discount (%)', 'number', '0', { min: '0', max: '100', step: '1' }) + field('payment', 'Payment status', 'select', '', { options: opts(['Unpaid', 'Partially paid', 'Paid'], 'Unpaid') }) + field('shipping', 'Shipping or delivery details', 'textarea', '', { full: true, ph: 'Address, delivery notes' }) + '</div>' +
    '<div class="card" style="margin-top:16px;background:var(--bg)"><div id="totals"></div></div><div class="form-foot"><button class="btn primary" type="submit" id="order-submit">Create order</button><button type="button" class="btn ghost" data-act="back" data-to="/orders">Cancel</button></div></form>';
  return { html, mount: orderCalc };
}
acts['add-item'] = () => { $('#items').insertAdjacentHTML('beforeend', itemRow()); orderCalc(); };
acts['rm-item'] = el => { const rows = $$('.item-row'); if (rows.length > 1) { el.closest('.item-row').remove(); orderCalc(); } else toast('An order needs at least one item.', 'warn'); };
forms.order = f => {
  reloadDB();
  const d = formData(f), errs = {}, u = me();
  const existing = DB.orderKeys[orderKey];
  if (existing) { toast('This order was already created. Opening it now.', 'warn'); return go('/orders/' + existing); }
  const cust = getCust(Number(d.customerId));
  if (!cust) errs.customerId = 'Choose the customer for this order.';
  else if (cust.status !== 'Active') errs.customerId = 'This customer is not active, so an order cannot be created.';
  const raw = readItems(f), items = [];
  let itemErr = '';
  if (!raw.length) itemErr = 'Add at least one item.';
  raw.forEach((i, n) => {
    const price = parseFloat(i.unitRaw);
    if (!i.name) itemErr = itemErr || 'Item ' + (n + 1) + ' needs a product name.';
    else if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999) itemErr = itemErr || 'Item ' + (n + 1) + ': quantity must be a whole number from 1 to 999.';
    else if (!(price > 0) || price > 10000000) itemErr = itemErr || 'Item ' + (n + 1) + ': enter a unit price above zero.';
    else items.push({ name: i.name, qty: i.qty, unit: Math.round(price * 100) });
  });
  const pct = Number(d.discountPct || 0);
  if (!(pct >= 0 && pct <= 100)) errs.discountPct = 'Enter a discount from 0 to 100.';
  $('#items-err', f).textContent = itemErr;
  if (itemErr || Object.keys(errs).length) {
    showErrors(f, errs); $('#items-err', f).textContent = itemErr;
    if (itemErr) logError('Order rejected: ' + itemErr);
    return;
  }
  showErrors(f, {});
  const key = orderKey;
  $('#order-submit', f).disabled = true;
  const res = tx(() => {
    const now = new Date().toISOString(), t = calcTotals(items, pct), nid = nextId('order');
    const o = { id: nid, code: 'VLX-O-' + String(nid).padStart(6, '0'), customerId: cust.id, date: now, status: 'Pending', payment: d.payment, items, subtotal: t.subtotal, discountPct: pct, discount: t.discount, total: t.total, shipping: d.shipping, createdBy: u.id, createdAt: now, updatedAt: now, version: 1, history: [{ at: now, userId: u.id, kind: 'status', from: '', to: 'Pending', note: 'Order created' }] };
    DB.orders.push(o);
    DB.orderKeys[key] = nid;
    pushAudit({ action: 'order.create', entity: 'order', entityId: nid, summary: 'Created order ' + o.code + ' for ' + cust.code + ' (' + fmtMoney(t.total) + ')' });
    return o;
  });
  if (!res.ok) { $('#order-submit', f).disabled = false; toast('The order could not be saved and nothing was stored. Please try again.', 'bad'); return; }
  toast('Order ' + res.result.code + ' created');
  go('/orders/' + res.result.id);
};

/* ---------- orders: detail ---------- */
function vOrderDetail(r) {
  const o = getOrder(r.id);
  if (!o || !visIds().has(o.customerId)) return vNotFound();
  const c = getCust(o.customerId), nexts = allowedNext(o);
  const payOpts = PAY_STATUS.filter(p => p !== 'Refunded' || can('orders.cancel'));
  const html = pageHead('Order ' + o.code, badge(o.status) + ' ' + badge(o.payment) + ' &nbsp;<span class="muted">Placed ' + fmtDT(o.date) + '</span>') +
    '<div class="detail-grid"><div class="stack"><div class="card"><header><h2>Customer</h2></header><dl class="dl"><dt>Name</dt><dd>' + custLink(c) + '</dd><dt>Contact</dt><dd>' + esc(c ? (c.email || c.phone) : '—') + '</dd><dt>Delivery</dt><dd>' + esc(o.shipping || '—') + '</dd><dt>Created by</dt><dd>' + esc(uName(o.createdBy)) + '</dd></dl></div>' +
    '<div class="card"><header><h2>Update order</h2></header>' + (nexts.length ? '<form data-form="order-status" data-id="' + o.id + '" class="stack" style="gap:12px">' + field('toStatus', 'Move to', 'select', '', { options: nexts.map(s => '<option>' + s + '</option>').join('') }) + field('note', 'Note', 'text', '', { ph: 'Optional' }) + '<button class="btn primary" type="submit">Update status</button></form>' : '<p class="muted">This order is ' + o.status.toLowerCase() + ', so its status can no longer change.</p>') +
    '<hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><form data-form="order-pay" data-id="' + o.id + '" class="stack" style="gap:12px">' + field('payment', 'Payment status', 'select', '', { options: opts(payOpts, o.payment) }) + '<button class="btn" type="submit">Save payment status</button></form></div></div>' +
    '<div class="stack"><div class="card"><header><h2>Items</h2></header><div class="tablewrap" style="border:0"><table class="data" style="min-width:420px"><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Line total</th></tr></thead><tbody>' + o.items.map(i => '<tr><td>' + esc(i.name) + '</td><td class="r num">' + i.qty + '</td><td class="r num">' + fmtMoney(i.unit) + '</td><td class="r num">' + fmtMoney(i.qty * i.unit) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<dl class="dl" style="margin-top:14px;max-width:340px;margin-left:auto"><dt>Subtotal</dt><dd class="num">' + fmtMoney(o.subtotal) + '</dd><dt>Discount (' + o.discountPct + '%)</dt><dd class="num">−' + fmtMoney(o.discount) + '</dd><dt><b>Total</b></dt><dd class="num"><b>' + fmtMoney(o.total) + '</b></dd></dl></div>' +
    '<div class="card"><header><h2>Status history</h2></header><ol class="timeline">' + o.history.slice().reverse().map(h => '<li><div class="t">' + badge(h.to) + '<span class="when">' + fmtDT(h.at) + ' · ' + esc(uName(h.userId)) + '</span></div>' + (h.kind === 'payment' ? '<p>Payment: ' + esc(h.from) + ' → ' + esc(h.to) + (h.note ? '. ' + esc(h.note) : '') + '</p>' : (h.note || h.from) ? '<p>' + (h.from ? esc(h.from) + ' → ' + esc(h.to) + '. ' : '') + esc(h.note) + '</p>' : '') + '</li>').join('') + '</ol></div></div></div>';
  return { html };
}
forms['order-status'] = f => {
  reloadDB();
  const o = getOrder(Number(f.dataset.id)), d = formData(f);
  if (!o) return;
  if (allowedNext(o).indexOf(d.toStatus) < 0) { toast('That status change is not allowed for this order or your role.', 'bad'); logError('Blocked status change on ' + o.code); return; }
  const r = tx(() => {
    const now = new Date().toISOString(), from = o.status;
    o.status = d.toStatus; o.version++; o.updatedAt = now;
    o.history.push({ at: now, userId: me().id, kind: 'status', from, to: d.toStatus, note: d.note });
    notify([o.createdBy].filter(x => x !== me().id), 'order', 'Order ' + o.code + ' moved to ' + d.toStatus, '/orders/' + o.id);
    pushAudit({ action: 'order.status', entity: 'order', entityId: o.id, summary: o.code + ': ' + from + ' → ' + d.toStatus, before: { status: from }, after: { status: d.toStatus } });
  });
  toast(r.ok ? 'Order moved to ' + d.toStatus : 'Could not update the order. No changes were made.', r.ok ? '' : 'bad'); render();
};
forms['order-pay'] = f => {
  reloadDB();
  const o = getOrder(Number(f.dataset.id)), d = formData(f);
  if (!o || d.payment === o.payment) return toast('Payment status is unchanged.', 'warn');
  if (d.payment === 'Refunded' && !can('orders.cancel')) return toast('Only a manager or administrator can mark an order refunded.', 'bad');
  const r = tx(() => {
    const now = new Date().toISOString(), from = o.payment;
    o.payment = d.payment; o.version++; o.updatedAt = now;
    o.history.push({ at: now, userId: me().id, kind: 'payment', from, to: d.payment, note: '' });
    pushAudit({ action: 'order.payment', entity: 'order', entityId: o.id, summary: o.code + ' payment: ' + from + ' → ' + d.payment, before: { payment: from }, after: { payment: d.payment } });
  });
  toast(r.ok ? 'Payment status saved' : 'Could not save the payment status.', r.ok ? '' : 'bad'); render();
};
