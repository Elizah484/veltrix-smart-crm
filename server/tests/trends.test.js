'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeBuckets, fillBuckets, periodStart } = require('../utils/trends');
const { isYmd, addDaysYmd, toIso } = require('../utils/dates');

test('daily buckets for 7 days end on today', () => {
  const b = makeBuckets(7, '2026-10-14');
  assert.equal(b.length, 7);
  assert.equal(b[0].from, '2026-10-08');
  assert.equal(b[6].from, '2026-10-14');
});

test('long periods use weekly buckets', () => {
  const b = makeBuckets(90, '2026-10-14');
  assert.ok(b.length < 20);
  assert.equal(b[b.length - 1].to, '2026-10-14');
});

test('fillBuckets sums values into the right bucket and ignores out-of-range rows', () => {
  const b = makeBuckets(3, '2026-10-14');
  const out = fillBuckets(b, [{ d: '2026-10-14', v: 2 }, { d: '2026-10-14', v: 1.5 }, { d: '2026-10-12', v: 1 }, { d: '2020-01-01', v: 9 }]);
  assert.deepEqual(out.map((x) => x.y), [1, 0, 3.5]);
});

test('periodStart and date helpers', () => {
  assert.equal(periodStart(7, '2026-10-14'), '2026-10-08');
  assert.equal(addDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(isYmd('2026-02-29'), false);
  assert.equal(isYmd('2028-02-29'), true);
  assert.equal(toIso('2026-10-13 09:30:00'), '2026-10-13T09:30:00Z');
});
