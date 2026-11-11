'use strict';

/**
 * Accepted request fields for every endpoint. Anything not listed here is
 * ignored, which prevents mass assignment (for example sending "role" or
 * "version" to an endpoint that should not accept it).
 */
const CATEGORIES = ['Retail', 'Wholesale', 'Corporate', 'VIP'];
const INTERACTION_TYPES = ['Phone call', 'Email', 'In-person meeting', 'Live chat', 'Complaint', 'Follow-up', 'Other'];
const INTERACTION_STATUSES = ['Open', 'In progress', 'Completed'];
const ROLES = ['admin', 'manager', 'employee'];
const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP'];

const login = {
  email: { type: 'email', label: 'your email address', required: true },
  password: { type: 'string', label: 'your password', required: true, max: 100 },
};

const register = {
  name: { type: 'string', label: 'your full name', required: true, max: 100, min: 2 },
  email: { type: 'email', label: 'your email address', required: true, max: 190 },
  password: { type: 'string', label: 'a password', required: true, max: 100 },
  acceptTerms: { type: 'bool', label: 'acceptTerms', default: false },
};

const changePassword = {
  currentPassword: { type: 'string', label: 'your current password', required: true, max: 100 },
  newPassword: { type: 'string', label: 'a new password', required: true, max: 100 },
};

const customer = {
  firstName: { type: 'string', label: 'a first name', required: true, max: 60 },
  lastName: { type: 'string', label: 'a last name', required: true, max: 60 },
  email: { type: 'email', label: 'email', max: 190 },
  phone: { type: 'phone', label: 'phone', max: 30 },
  company: { type: 'string', label: 'company', max: 120 },
  address: { type: 'string', label: 'address', max: 255 },
  category: { type: 'enum', label: 'category', values: CATEGORIES, default: 'Retail' },
  status: { type: 'enum', label: 'status', values: ['Active', 'Inactive'], default: 'Active' },
  registeredOn: { type: 'date', label: 'a registration date', required: true },
  assignedUserId: { type: 'int', label: 'assigned employee', min: 1 },
  notes: { type: 'string', label: 'notes', max: 5000 },
  version: { type: 'int', label: 'version', min: 1 },
  confirmDuplicate: { type: 'bool', label: 'confirmDuplicate', default: false },
};

const customerStatus = {
  status: { type: 'enum', label: 'status', values: ['Archived', 'Active'], required: true },
};

const duplicateDecision = {
  customerAId: { type: 'int', label: 'the first customer', required: true, min: 1 },
  customerBId: { type: 'int', label: 'the second customer', required: true, min: 1 },
};

const merge = {
  keepId: { type: 'int', label: 'the customer to keep', required: true, min: 1 },
  mergeId: { type: 'int', label: 'the customer to merge', required: true, min: 1 },
};

const interaction = {
  customerId: { type: 'int', label: 'a customer', required: true, min: 1 },
  type: { type: 'enum', label: 'type', values: INTERACTION_TYPES, required: true },
  occurredAt: { type: 'datetime', label: 'the date and time', required: true },
  subject: { type: 'string', label: 'a subject', required: true, max: 150 },
  notes: { type: 'string', label: 'notes', max: 5000 },
  outcome: { type: 'string', label: 'outcome', max: 255 },
  followUpDate: { type: 'date', label: 'follow-up date' },
  followUpAssigneeId: { type: 'int', label: 'follow-up owner', min: 1 },
  status: { type: 'enum', label: 'status', values: INTERACTION_STATUSES, default: 'Open' },
};

const assign = {
  assigneeId: { type: 'int', label: 'a follow-up owner', required: true, min: 1 },
};

const orderItem = {
  productName: { type: 'string', label: 'a product name', required: true, max: 150 },
  quantity: { type: 'int', label: 'quantity', required: true, min: 1, max: 999 },
  unitPrice: { type: 'number', label: 'unit price', required: true, min: 0.01, max: 10000000, decimals: 2 },
};

const order = {
  customerId: { type: 'int', label: 'a customer', required: true, min: 1 },
  items: { type: 'array', label: 'items', required: true, min: 1, max: 50, items: orderItem },
  discountPercent: { type: 'number', label: 'discount', min: 0, max: 100, decimals: 2, default: 0 },
  paymentStatus: { type: 'enum', label: 'payment status', values: ['Unpaid', 'Partially paid', 'Paid'], default: 'Unpaid' },
  shippingDetails: { type: 'string', label: 'shipping details', max: 500 },
};

const orderStatus = {
  status: { type: 'enum', label: 'status', values: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], required: true },
  note: { type: 'string', label: 'note', max: 255 },
  version: { type: 'int', label: 'version', min: 1 },
};

const orderPayment = {
  paymentStatus: { type: 'enum', label: 'payment status', values: ['Unpaid', 'Partially paid', 'Paid', 'Refunded'], required: true },
  version: { type: 'int', label: 'version', min: 1 },
};

const userCreate = {
  name: { type: 'string', label: 'a name', required: true, max: 100 },
  email: { type: 'email', label: 'an email address', required: true, max: 190 },
  role: { type: 'enum', label: 'role', values: ROLES, required: true },
  password: { type: 'string', label: 'a temporary password', required: true, max: 100 },
};

const userUpdate = {
  name: { type: 'string', label: 'a name', max: 100 },
  role: { type: 'enum', label: 'role', values: ROLES },
  active: { type: 'bool', label: 'active' },
  password: { type: 'string', label: 'a new password', max: 100 },
};

const settings = {
  companyName: { type: 'string', label: 'the business name', required: true, max: 120 },
  currency: { type: 'enum', label: 'currency', values: CURRENCIES, required: true },
  reminderDays: { type: 'int', label: 'reminder days', required: true, min: 1, max: 14 },
};

module.exports = {
  CATEGORIES, INTERACTION_TYPES, INTERACTION_STATUSES, ROLES, CURRENCIES,
  login, register, changePassword, customer, customerStatus, duplicateDecision, merge,
  interaction, assign, order, orderStatus, orderPayment, userCreate, userUpdate, settings,
};
