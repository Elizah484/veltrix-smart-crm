'use strict';

const { toIso } = require('./dates');

/**
 * Shape database rows into the JSON the API returns. Fields are listed one by
 * one so a new column (or a password hash) is never exposed by accident.
 */
const customerDto = (r) => ({
  id: r.id,
  code: r.customer_code,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  company: r.company,
  address: r.address,
  category: r.category,
  status: r.status,
  registeredOn: r.registered_on,
  assignedUserId: r.assigned_user_id,
  assignedName: r.assigned_name || null,
  createdBy: r.created_by,
  mergedIntoId: r.merged_into_id,
  notes: r.notes,
  version: r.version,
  createdAt: toIso(r.created_at),
  updatedAt: toIso(r.updated_at),
});

const interactionDto = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.customer_first ? r.customer_first + ' ' + r.customer_last : null,
  customerCode: r.customer_code || null,
  type: r.type,
  occurredAt: toIso(r.occurred_at),
  userId: r.user_id,
  userName: r.user_name || null,
  subject: r.subject,
  notes: r.notes,
  outcome: r.outcome,
  followUpDate: r.follow_up_date,
  followUpDone: !!r.follow_up_done,
  followUpAssigneeId: r.follow_up_assignee_id,
  assigneeName: r.assignee_name || null,
  status: r.status,
  overdue: !!r.follow_up_date && !r.follow_up_done && String(r.follow_up_date) < new Date().toISOString().slice(0, 10),
  createdAt: toIso(r.created_at),
  updatedAt: toIso(r.updated_at),
});

const orderDto = (r) => ({
  id: r.id,
  code: r.order_code,
  customerId: r.customer_id,
  customerName: r.customer_first ? r.customer_first + ' ' + r.customer_last : null,
  customerCode: r.customer_code || null,
  orderDate: toIso(r.order_date),
  status: r.status,
  paymentStatus: r.payment_status,
  subtotal: Number(r.subtotal),
  discountPercent: Number(r.discount_percent),
  discountAmount: Number(r.discount_amount),
  total: Number(r.total_amount),
  shippingDetails: r.shipping_details,
  createdBy: r.created_by,
  createdByName: r.created_by_name || null,
  itemCount: r.item_count !== undefined ? Number(r.item_count) : undefined,
  version: r.version,
  createdAt: toIso(r.created_at),
  updatedAt: toIso(r.updated_at),
});

const orderItemDto = (r) => ({
  id: r.id,
  productName: r.product_name,
  quantity: r.quantity,
  unitPrice: Number(r.unit_price),
  lineTotal: Number(r.line_total),
});

const historyDto = (r) => ({
  id: r.id,
  kind: r.kind,
  from: r.from_value,
  to: r.to_value,
  note: r.note,
  userId: r.user_id,
  userName: r.user_name || null,
  at: toIso(r.created_at),
});

const userDto = (r) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role_code,
  roleName: r.role_name,
  active: !!r.is_active,
  lastLoginAt: toIso(r.last_login_at),
  createdAt: toIso(r.created_at),
});

const notificationDto = (r) => ({
  id: r.id,
  type: r.type,
  message: r.message,
  link: r.link,
  read: !!r.is_read,
  at: toIso(r.created_at),
});

function safeParse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

const auditDto = (r) => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name || null,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  summary: r.summary,
  before: safeParse(r.before_json),
  after: safeParse(r.after_json),
  requestId: r.request_id,
  at: toIso(r.created_at),
});

module.exports = { customerDto, interactionDto, orderDto, orderItemDto, historyDto, userDto, notificationDto, auditDto };
