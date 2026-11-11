export const CATEGORIES = ['Retail', 'Wholesale', 'Corporate', 'VIP'];
export const CUSTOMER_STATUSES = ['Active', 'Inactive', 'Archived'];
export const INTERACTION_TYPES = ['Phone call', 'Email', 'In-person meeting', 'Live chat', 'Complaint', 'Follow-up', 'Other'];
export const INTERACTION_STATUSES = ['Open', 'In progress', 'Completed'];
export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
export const PAYMENT_STATUSES = ['Unpaid', 'Partially paid', 'Paid', 'Refunded'];
export const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP'];
export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];
export const REPORTS = [
  { type: 'customers', label: 'Customer directory', about: 'Every customer you can see, with category, status and owner.' },
  { type: 'registrations', label: 'Customer registrations', about: 'New customers per month.' },
  { type: 'orders', label: 'Order report', about: 'All orders with status, payment and totals.' },
  { type: 'sales', label: 'Sales summary', about: 'Sales per month and per customer category (administrator).', permission: 'reports.sales' },
  { type: 'status', label: 'Order status report', about: 'How many orders sit in each status.' },
  { type: 'interactions', label: 'Customer interaction report', about: 'Calls, emails, meetings and complaints logged.' },
  { type: 'followups', label: 'Follow-up report', about: 'Open, overdue and completed follow-ups.' },
  { type: 'data-quality', label: 'Data quality and duplicates', about: 'Missing contact details and possible duplicate customers.' },
];
