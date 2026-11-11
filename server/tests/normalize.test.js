'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normEmail, normPhone, isEmail, isPhone, likeContains, passwordProblem } = require('../utils/normalize');

test('normEmail trims and lower-cases', () => {
  assert.equal(normEmail('  Jane@Example.COM '), 'jane@example.com');
  assert.equal(normEmail(''), null);
  assert.equal(normEmail(null), null);
});

test('normPhone keeps digits and converts Kenyan local numbers', () => {
  assert.equal(normPhone('0712 345 678'), '254712345678');
  assert.equal(normPhone('+254 712-345-678'), '254712345678');
  assert.equal(normPhone('abc'), null);
});

test('isEmail and isPhone', () => {
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('a@b'), false);
  assert.equal(isEmail('not an email'), false);
  assert.equal(isPhone('0712345678'), true);
  assert.equal(isPhone('123'), false);
});

test('likeContains escapes wildcard characters', () => {
  assert.equal(likeContains('50%_off'), '%50\\%\\_off%');
});

test('passwordProblem enforces length, letter and digit', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('onlyletterslong'));
  assert.ok(passwordProblem('1234567890123'));
  assert.equal(passwordProblem('Veltrix#2026'), null);
});
