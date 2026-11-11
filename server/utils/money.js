'use strict';

/** 12.5 or "12.50" -> 1250 (whole cents). Returns NaN for invalid input. */
function toCents(value) {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

/** 1250 -> "12.50" for DECIMAL columns */
const centsToDecimal = (cents) => (cents / 100).toFixed(2);

/**
 * All order maths happens in whole cents so floating point never creeps in.
 * items: [{ quantity, unitCents }], discountPercent: 0..100
 */
function calcTotals(items, discountPercent) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitCents, 0);
  const pct = Number(discountPercent) || 0;
  const discount = Math.round((subtotal * pct) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

module.exports = { toCents, centsToDecimal, calcTotals };
