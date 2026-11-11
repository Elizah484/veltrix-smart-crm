'use strict';

/**
 * One CSV cell. Values that start with = + - @ or a tab/return would be run as
 * formulas by Excel, so they get a leading apostrophe. Quotes are doubled.
 */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')];
  rows.forEach((r) => lines.push(r.map(csvCell).join(',')));
  return '﻿' + lines.join('\r\n'); // BOM so Excel reads UTF-8 correctly
}

module.exports = { csvCell, toCsv };
