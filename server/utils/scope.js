'use strict';

/**
 * Row-level access. Administrators and managers (customers.view_all) see every
 * customer. Everyone else sees customers assigned to them, unassigned ones, and
 * ones they created. Interactions and orders follow their customer.
 *
 * Returns an SQL fragment to append to a WHERE clause plus its parameters.
 */
function customerScope(user, alias) {
  const a = alias || 'c';
  if (user.can('customers.view_all')) return { sql: '', params: [] };
  return {
    sql: ` AND (${a}.assigned_user_id IS NULL OR ${a}.assigned_user_id = ? OR ${a}.created_by = ?)`,
    params: [user.id, user.id],
  };
}

/** May this person edit this customer row? */
function canEditCustomer(user, row) {
  if (!user.can('customers.edit')) return false;
  if (user.can('customers.view_all')) return true;
  return !row.assigned_user_id || row.assigned_user_id === user.id || row.created_by === user.id;
}

module.exports = { customerScope, canEditCustomer };
