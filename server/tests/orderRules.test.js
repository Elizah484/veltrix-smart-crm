'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { allowedNext } = require('../utils/orderRules');

const set = (...p) => new Set(p);

test('employee (basic) can only confirm or process', () => {
  const p = set('orders.status_basic');
  assert.deepEqual(allowedNext('Pending', p), ['Confirmed']);
  assert.deepEqual(allowedNext('Confirmed', p), ['Processing']);
  assert.deepEqual(allowedNext('Processing', p), []);
});

test('manager (any + cancel) follows the full flow', () => {
  const p = set('orders.status_any', 'orders.cancel');
  assert.deepEqual(allowedNext('Pending', p), ['Confirmed', 'Cancelled']);
  assert.deepEqual(allowedNext('Processing', p), ['Shipped', 'Cancelled']);
  assert.deepEqual(allowedNext('Shipped', p), ['Delivered']);
});

test('cancel needs orders.cancel, and finished orders are final', () => {
  assert.deepEqual(allowedNext('Pending', set('orders.status_any')), ['Confirmed']);
  assert.deepEqual(allowedNext('Delivered', set('orders.status_any', 'orders.cancel')), []);
  assert.deepEqual(allowedNext('Cancelled', set('orders.status_any', 'orders.cancel')), []);
  assert.deepEqual(allowedNext('Pending', set()), []);
});
