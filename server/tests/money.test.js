'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toCents, centsToDecimal, calcTotals } = require('../utils/money');

test('toCents converts without float drift', () => {
  assert.equal(toCents('12.50'), 1250);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(19.99), 1999);
  assert.ok(Number.isNaN(toCents('abc')));
});

test('centsToDecimal formats two places', () => {
  assert.equal(centsToDecimal(1250), '12.50');
  assert.equal(centsToDecimal(5), '0.05');
});

test('calcTotals applies a percentage discount in cents', () => {
  const r = calcTotals([{ quantity: 2, unitCents: 1000 }, { quantity: 1, unitCents: 550 }], 10);
  assert.deepEqual(r, { subtotal: 2550, discount: 255, total: 2295 });
  assert.deepEqual(calcTotals([], 0), { subtotal: 0, discount: 0, total: 0 });
});
