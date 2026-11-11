'use strict';

const { addDaysYmd } = require('./dates');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (ymd) => {
  const [, m, d] = ymd.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1];
};

/**
 * Empty buckets for the last `days` days ending on `today` (YYYY-MM-DD).
 * Periods longer than 31 days use weekly buckets so charts stay readable.
 */
function makeBuckets(days, today) {
  const step = days > 31 ? 7 : 1;
  const count = Math.ceil(days / step);
  const first = addDaysYmd(today, -(count * step - 1));
  const buckets = [];
  for (let i = 0; i < count; i++) {
    const from = addDaysYmd(first, i * step);
    buckets.push({ x: label(from), from, to: addDaysYmd(from, step - 1), y: 0 });
  }
  return buckets;
}

/** Add database rows ({ d: 'YYYY-MM-DD', v: number }) into the buckets they fall in. */
function fillBuckets(buckets, rows) {
  rows.forEach((r) => {
    const day = String(r.d).slice(0, 10);
    const b = buckets.find((x) => day >= x.from && day <= x.to);
    if (b) b.y += Number(r.v) || 0;
  });
  return buckets.map((b) => ({ x: b.x, from: b.from, y: Math.round(b.y * 100) / 100 }));
}

/** First day covered by the period, for use in WHERE clauses */
const periodStart = (days, today) => addDaysYmd(today, -(days - 1));

module.exports = { makeBuckets, fillBuckets, periodStart };
