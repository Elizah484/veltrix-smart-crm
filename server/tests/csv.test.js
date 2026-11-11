'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { csvCell, toCsv } = require('../utils/csv');

test('csvCell neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('+1'), '"\'+1"');
  assert.equal(csvCell('-1'), '"\'-1"');
  assert.equal(csvCell('@cmd'), '"\'@cmd"');
});

test('csvCell doubles quotes and handles empty values', () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});

test('toCsv writes a BOM, header and CRLF rows', () => {
  const out = toCsv(['A', 'B'], [[1, 'x'], [2, '=y']]);
  assert.equal(out.charCodeAt(0), 0xfeff);
  assert.equal(out.slice(1), '"A","B"\r\n"1","x"\r\n"2","\'=y"');
});
