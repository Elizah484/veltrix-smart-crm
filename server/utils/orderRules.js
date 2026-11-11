'use strict';

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Partially paid', 'Paid', 'Refunded'];

/** Valid next steps for each status. Shipped orders cannot be cancelled. */
const NEXT = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

/**
 * Which statuses this person may move the order to.
 * perms is a Set of permission codes.
 *  - orders.status_any   any valid next step
 *  - orders.status_basic only Confirmed and Processing
 *  - orders.cancel       needed for Cancelled, on top of one of the above
 */
function allowedNext(current, perms) {
  const valid = NEXT[current] || [];
  const any = perms.has('orders.status_any');
  const basic = perms.has('orders.status_basic');
  return valid.filter((s) => {
    if (s === 'Cancelled') return perms.has('orders.cancel') && (any || basic);
    if (any) return true;
    return basic && (s === 'Confirmed' || s === 'Processing');
  });
}

module.exports = { ORDER_STATUSES, PAYMENT_STATUSES, NEXT, allowedNext };
