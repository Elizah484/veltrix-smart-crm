'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBody, parseId, optionalDate, optionalEnum } = require('../utils/validate');

const schema = {
  name: { type: 'string', label: 'name', required: true, max: 10 },
  email: { type: 'email', label: 'email' },
  qty: { type: 'int', label: 'quantity', min: 1, max: 5 },
  kind: { type: 'enum', label: 'kind', values: ['a', 'b'] },
  on: { type: 'date', label: 'date' },
};

function fields(fn) {
  try { fn(); } catch (e) { return e.fields || e.details || e; }
  return null;
}

test('valid input passes and is trimmed', () => {
  const out = validateBody({ name: '  Ann ', qty: '3', kind: 'a' }, schema);
  assert.equal(out.name, 'Ann');
  assert.equal(out.qty, 3);
  assert.equal(out.email, null);
});

test('unknown fields are dropped (mass assignment)', () => {
  const out = validateBody({ name: 'Ann', role: 'admin', version: 99 }, schema);
  assert.equal('role' in out, false);
  assert.equal('version' in out, false);
});

test('invalid input throws', () => {
  assert.throws(() => validateBody({}, schema));
  assert.throws(() => validateBody({ name: 'x'.repeat(11) }, schema));
  assert.throws(() => validateBody({ name: 'A', qty: 9 }, schema));
  assert.throws(() => validateBody({ name: 'A', qty: 1.5 }, schema));
  assert.throws(() => validateBody({ name: 'A', kind: 'z' }, schema));
  assert.throws(() => validateBody({ name: 'A', email: 'bad' }, schema));
  assert.throws(() => validateBody({ name: 'A', on: '2026-02-30' }, schema));
  assert.throws(() => validateBody({ name: { $ne: 1 } }, schema));
});

test('parseId accepts only positive integers', () => {
  assert.equal(parseId('42'), 42);
  assert.throws(() => parseId('0'));
  assert.throws(() => parseId('-1'));
  assert.throws(() => parseId('1; DROP TABLE x'));
});

test('optionalDate and optionalEnum', () => {
  assert.equal(optionalDate(''), null);
  assert.equal(optionalDate('2026-10-14'), '2026-10-14');
  assert.throws(() => optionalDate('14/10/2026'));
  assert.equal(optionalEnum(undefined, ['x']), null);
  assert.equal(optionalEnum('x', ['x']), 'x');
  assert.throws(() => optionalEnum('y', ['x']));
});
