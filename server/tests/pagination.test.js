'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePaging, pageMeta } = require('../utils/pagination');

const sortMap = { name: 'c.name', created: 'c.created_at, c.id' };

test('defaults', () => {
  const p = parsePaging({}, sortMap, 'name', 'asc');
  assert.deepEqual([p.page, p.pageSize, p.offset, p.orderBy], [1, 10, 0, 'c.name ASC']);
});

test('page size is capped and offset computed', () => {
  const p = parsePaging({ page: '3', pageSize: '500', sort: 'created', dir: 'desc' }, sortMap, 'name', 'asc');
  assert.equal(p.pageSize, 100);
  assert.equal(p.offset, 200);
  assert.equal(p.orderBy, 'c.created_at DESC, c.id DESC');
});

test('rejects bad paging and unknown sort columns', () => {
  assert.throws(() => parsePaging({ page: '0' }, sortMap, 'name', 'asc'));
  assert.throws(() => parsePaging({ page: '1;DROP' }, sortMap, 'name', 'asc'));
  assert.throws(() => parsePaging({ sort: 'password_hash' }, sortMap, 'name', 'asc'));
  assert.throws(() => parsePaging({ sort: 'constructor' }, sortMap, 'name', 'asc'));
  assert.throws(() => parsePaging({ dir: 'sideways' }, sortMap, 'name', 'asc'));
});

test('pageMeta totals', () => {
  const p = parsePaging({ pageSize: '10' }, sortMap, 'name', 'asc');
  assert.equal(pageMeta(p, 25).totalPages, 3);
  assert.equal(pageMeta(p, 0).totalPages, 1);
});
