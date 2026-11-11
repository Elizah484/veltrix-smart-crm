'use strict';
/* ---------- utilities ---------- */
const STORE_KEY = 'veltrix-demo-v1';
const SESSION_KEY = 'veltrix-demo-session';
const DEMO_PASSWORD = 'Veltrix#2026';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lc = s => String(s || '').trim().toLowerCase();
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const todayStr = () => ymd(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const fmtDate = s => { if (!s) return '—'; const d = s.length > 10 ? new Date(s) : parseYmd(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtDT = s => { const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const localDT = d => ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const rid = () => Math.random().toString(16).slice(2, 10);
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtMoney = c => {
  try { return new Intl.NumberFormat('en-KE', { style: 'currency', currency: DB.settings.currency }).format(c / 100); }
  catch (e) { return DB.settings.currency + ' ' + (c / 100).toFixed(2); }
};
const fmtCompact = c => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(c / 100);
const money2 = c => (c / 100).toFixed(2);

const normEmail = e => lc(e);
const normPhone = p => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10 && d[0] === '0') d = '254' + d.slice(1);
  return d;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Spreadsheet formula injection guard for CSV exports */
const csvCell = v => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const toCSV = (cols, rows) => [cols.map(csvCell).join(',')].concat(rows.map(r => r.map(csvCell).join(','))).join('\r\n');

async function sha(pw, salt) {
  const text = salt + ':' + pw;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }
}

/* ---------- constants ---------- */
const CATEGORIES = ['Retail', 'Wholesale', 'Corporate', 'VIP'];
const CUST_STATUS = ['Active', 'Inactive', 'Archived'];
const INTERACTION_TYPES = ['Phone call', 'Email', 'In-person meeting', 'Live chat', 'Complaint', 'Follow-up', 'Other'];
const INTERACTION_STATUS = ['Open', 'In progress', 'Completed'];
const ORDER_STATUS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PAY_STATUS = ['Unpaid', 'Partially paid', 'Paid', 'Refunded'];
const NEXT = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Processing', 'Cancelled'], Processing: ['Shipped', 'Cancelled'], Shipped: ['Delivered'], Delivered: [], Cancelled: [] };
const PRODUCTS = [
  ['Wireless Earbuds', 6500], ['Smart Watch', 14500], ['USB-C Charger 65W', 1800], ['Laptop Sleeve 14"', 2400],
  ['Mechanical Keyboard', 9800], ['Desk Lamp', 3200], ['HD Webcam', 5600], ['Phone Stand', 900]
];
const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', employee: 'Employee' };
const PERM = {
  admin: ['users', 'settings', 'customers.archive', 'dup.merge', 'followups.assign', 'orders.cancel', 'orders.any', 'dashboard.full', 'reports', 'reports.sales', 'audit', 'export'],
  manager: ['customers.archive', 'dup.merge', 'followups.assign', 'orders.cancel', 'orders.any', 'dashboard.full', 'reports', 'audit', 'export'],
  employee: []
};

/* ---------- storage ---------- */
let DB = null;
let storageWarned = false;
function loadDB() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return d; } } catch (e) { /* storage unavailable */ }
  return null;
}
function saveDB(strict) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); return true; }
  catch (e) {
    if (strict) throw new Error('Could not save changes in this browser');
    if (!storageWarned) { storageWarned = true; toast('Changes are kept for this visit only. Browser storage is unavailable.', 'warn'); }
    return false;
  }
}
function reloadDB() { const d = loadDB(); if (d) DB = d; }
function nextId(kind) { DB.seq[kind] = (DB.seq[kind] || 0) + 1; return DB.seq[kind]; }

/* ---------- seed data (fictional) ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function freshDB() {
  const salt = rid();
  const pwHash = await sha(DEMO_PASSWORD, salt);
  const mk = (id, name, email, role) => ({ id, name, email, role, active: true, salt, pwHash, createdAt: new Date().toISOString(), lastLogin: null });
  DB = {
    v: 1,
    seq: { customer: 0, order: 0, interaction: 0, audit: 0, notif: 0, user: 4 },
    settings: { company: 'Northline Supplies Ltd', currency: 'KES', reminderDays: 2 },
    users: [
      mk(1, 'Wanjiku Karimi', 'admin@veltrix.test', 'admin'),
      mk(2, 'Michael Otieno', 'manager@veltrix.test', 'manager'),
      mk(3, 'Sarah Achieng', 'employee@veltrix.test', 'employee'),
      mk(4, 'Kevin Mutua', 'kevin@veltrix.test', 'employee')
    ],
    customers: [], interactions: [], orders: [], audit: [], notifications: [],
    dupReviews: [], orderKeys: {}, errors: [], sampleLoaded: false
  };
  seedBusiness();
  return DB;
}

function seedBusiness() {
  const rand = rng(20261013);
  const pick = a => a[Math.floor(rand() * a.length)];
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const FIRST = ['Amina', 'Brian', 'Cynthia', 'David', 'Esther', 'Felix', 'Grace', 'Hassan', 'Irene', 'James', 'Lucy', 'Mercy', 'Nelson', 'Olivia', 'Peter', 'Rose', 'Samuel', 'Tabitha', 'Umar', 'Violet', 'Wycliffe', 'Zainab', 'Joseph', 'Faith', 'Daniel', 'Naomi'];
  const LAST = ['Wanjiru', 'Otieno', 'Kamau', 'Mwangi', 'Njoroge', 'Achieng', 'Kiptoo', 'Hussein', 'Mutua', 'Odhiambo', 'Chebet', 'Omondi', 'Wafula', 'Karanja', 'Abdi', 'Mbugua'];
  const COMPANIES = ['', '', '', 'Baraka Traders', 'Lakeview Cafe', 'Savanna Print Works', 'Tembo Logistics', 'Kilele Stationers', 'Mara Gadgets'];
  const TOWNS = ['Westlands, Nairobi', 'Kilimani, Nairobi', 'Nyali, Mombasa', 'Milimani, Kisumu', 'Section 58, Nakuru', 'Thika Town', 'Eldoret CBD'];
  const staff = [2, 3, 4];
  const now = new Date();
  const people = [];
  for (let i = 0; i < FIRST.length; i++) people.push([FIRST[i], LAST[(i * 5 + 3) % LAST.length]]);
  const make = (first, last, opts) => {
    opts = opts || {};
    const id = nextId('customer');
    const regDays = opts.regDays != null ? opts.regDays : between(0, 150);
    const reg = ymd(addDays(now, -regDays));
    const phone = opts.phone || ('+254 700 ' + String(between(100, 999)) + ' ' + String(between(100, 999)));
    const email = opts.email !== undefined ? opts.email : (first + '.' + last + between(1, 99) + '@example.test').toLowerCase();
    const created = new Date(parseYmd(reg).getTime() + 9 * 3600000).toISOString();
    const roll = rand();
    const c = {
      id, code: 'VLX-C-' + String(id).padStart(6, '0'), first, last, email, emailN: normEmail(email), phone, phoneN: normPhone(phone),
      company: opts.company !== undefined ? opts.company : pick(COMPANIES), address: pick(TOWNS), category: pick(CATEGORIES),
      status: roll < 0.84 ? 'Active' : (roll < 0.94 ? 'Inactive' : 'Archived'), registered: reg,
      assignedTo: rand() < 0.2 ? null : pick(staff), notes: '', createdAt: created, updatedAt: created, version: 1, createdBy: pick(staff)
    };
    DB.customers.push(c);
    pushAudit({ userId: c.createdBy, action: 'customer.create', entity: 'customer', entityId: id, summary: 'Created customer ' + c.code, at: created });
    return c;
  };
  people.forEach(p => make(p[0], p[1]));
  /* Deliberate review cases so the duplicate queue has something real to show */
  const base = DB.customers[3];
  make(base.first, base.last, { regDays: 6, company: base.company });
  const fam = DB.customers[6];
  make('Zawadi', fam.last, { regDays: 12, phone: fam.phone });
  make('Samson', 'Chebet', { regDays: 20, email: '' });

  const SUBJ = {
    'Phone call': ['Delivery time enquiry', 'Bulk pricing discussion', 'Account details check'],
    'Email': ['Invoice copy requested', 'Product catalogue sent', 'Order confirmation query'],
    'In-person meeting': ['Showroom visit', 'Contract renewal meeting'],
    'Live chat': ['Chat: sizing question', 'Chat: payment options'],
    'Complaint': ['Item arrived damaged', 'Late delivery complaint', 'Wrong colour delivered'],
    'Follow-up': ['Check satisfaction after delivery', 'Quote follow-up'],
    'Other': ['Updated delivery address', 'Warranty paperwork']
  };
  const OUT = ['Resolved on the call', 'Customer will confirm tomorrow', 'Escalated to manager', 'Information sent', 'Awaiting customer reply'];
  DB.customers.forEach(c => {
    const n = between(1, 4);
    for (let k = 0; k < n; k++) {
      const type = pick(INTERACTION_TYPES);
      const maxBack = Math.max(0, daysBetween(c.registered, todayStr()));
      const dAt = addDays(parseYmd(c.registered), between(0, maxBack));
      dAt.setHours(between(8, 17), between(0, 59));
      if (dAt > now) dAt.setTime(now.getTime() - 3600000);
      const hasFU = rand() < 0.5;
      const fuDate = hasFU ? ymd(addDays(now, between(-12, 14))) : '';
      const done = hasFU && fuDate < todayStr() && rand() < 0.4;
      const id = nextId('interaction');
      const user = c.assignedTo || pick(staff);
      DB.interactions.push({
        id, customerId: c.id, type, at: dAt.toISOString(), userId: user, subject: pick(SUBJ[type]),
        notes: 'Discussed with ' + c.first + '. ' + pick(['Customer was polite and clear about the request.', 'Needs a reply before the end of the week.', 'No further action needed unless the customer calls back.']),
        outcome: pick(OUT), followUp: fuDate, followUpDone: done, assignee: hasFU ? user : null,
        status: (!hasFU || done) ? 'Completed' : (type === 'Complaint' ? 'In progress' : 'Open'),
        createdAt: dAt.toISOString(), updatedAt: dAt.toISOString(), history: []
      });
      pushAudit({ userId: user, action: 'interaction.create', entity: 'interaction', entityId: id, summary: 'Recorded ' + type.toLowerCase() + ' for ' + c.code, at: dAt.toISOString() });
    }
  });

  DB.customers.forEach(c => {
    if (c.status === 'Archived') return;
    const n = between(0, 3);
    for (let k = 0; k < n; k++) {
      const maxBack = Math.max(0, daysBetween(c.registered, todayStr()));
      const dAt = addDays(parseYmd(c.registered), between(0, maxBack));
      dAt.setHours(between(8, 18), between(0, 59));
      if (dAt > now) dAt.setTime(now.getTime() - 7200000);
      const age = Math.round((now - dAt) / 86400000);
      const r = rand();
      let status;
      if (age > 14) status = r < 0.8 ? 'Delivered' : 'Cancelled';
      else if (age > 7) status = r < 0.6 ? 'Delivered' : (r < 0.9 ? 'Shipped' : 'Cancelled');
      else if (age > 3) status = r < 0.5 ? 'Processing' : 'Shipped';
      else status = r < 0.5 ? 'Pending' : 'Confirmed';
      const items = [];
      const used = new Set();
      const lines = between(1, 3);
      for (let j = 0; j < lines; j++) {
        const pr = pick(PRODUCTS);
        if (used.has(pr[0])) continue;
        used.add(pr[0]);
        items.push({ name: pr[0], qty: between(1, 4), unit: pr[1] * 100 });
      }
      const discountPct = rand() < 0.25 ? pick([5, 10]) : 0;
      const t = calcTotals(items, discountPct);
      let payment = 'Unpaid';
      if (status === 'Delivered') payment = rand() < 0.88 ? 'Paid' : 'Partially paid';
      else if (status === 'Shipped' || status === 'Processing') payment = rand() < 0.5 ? 'Paid' : 'Unpaid';
      else if (status === 'Cancelled') payment = rand() < 0.5 ? 'Refunded' : 'Unpaid';
      const id = nextId('order');
      const by = c.assignedTo || pick(staff);
      const path = ['Pending'];
      if (status === 'Cancelled') path.push('Cancelled');
      else { const idx = ORDER_STATUS.indexOf(status); for (let s = 1; s <= idx; s++) path.push(ORDER_STATUS[s]); }
      const history = path.map((st, i) => ({ at: new Date(dAt.getTime() + i * 86400000 * 0.8).toISOString(), userId: by, kind: 'status', from: i ? path[i - 1] : '', to: st, note: i ? '' : 'Order created' }));
      DB.orders.push({
        id, code: 'VLX-O-' + String(id).padStart(6, '0'), customerId: c.id, date: dAt.toISOString(), status, payment, items,
        subtotal: t.subtotal, discountPct, discount: t.discount, total: t.total, shipping: c.address, createdBy: by,
        createdAt: dAt.toISOString(), updatedAt: history[history.length - 1].at, version: 1, history
      });
      pushAudit({ userId: by, action: 'order.create', entity: 'order', entityId: id, summary: 'Created order VLX-O-' + String(id).padStart(6, '0') + ' for ' + c.code, at: dAt.toISOString() });
    }
  });
  DB.audit.sort((a, b) => a.at < b.at ? -1 : 1);
  DB.sampleLoaded = true;
  syncReminders();
}
