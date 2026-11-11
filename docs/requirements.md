# Requirements

## Purpose
Veltrix Smart CRM lets a small business keep one accurate record per customer, log every contact with them, never miss a promised follow-up, take and track orders, and see how the business is doing. It must be safe to share between staff with different levels of access.

## Users and roles
| Role | Purpose | Customer visibility |
|---|---|---|
| Administrator | runs the system, users and settings | all |
| Manager | oversees customers, orders and reports | all |
| Employee | day-to-day customer work | customers assigned to them, unassigned, or created by them |

Permissions are stored in the database (`permissions`, `role_permissions`) and loaded on every request, so a role change or deactivation applies immediately.

## Functional requirements
| Id | Module | Requirement |
|---|---|---|
| A | Authentication | Sign in with email and password; HTTP-only cookie session; sign out; change own password; deactivated users are refused immediately; role-based access on every endpoint and screen. |
| B | Customers | Add, view, edit, archive and restore (never hard-delete). Fields: id, first and last name, email, phone, company, address, category, status, registration date, assigned employee, notes. Validation of email, phone and dates. |
| B2 | Duplicates | Block an active customer with the same email (database-enforced). Warn on same name, or same phone with same first or last name. Review screen to merge or mark as different. Merge moves orders and interactions and archives the duplicate. |
| C | Interactions | Log calls, emails, meetings, chat, complaints, follow-ups. Timeline per customer. Optional follow-up date and owner; mark done; reassign; change history. |
| D | Orders | Create orders with line items; totals and discount calculated on the server in whole cents; status flow Pending, Confirmed, Processing, Shipped, Delivered, or Cancelled; payment status; status history; role-limited status changes. |
| E | Reliability | Optimistic locking (`version`) on customers and orders; idempotent order creation (`Idempotency-Key`); transactions for multi-row changes; friendly errors with a reference id; no stack traces to users. |
| F | Search | Search and filter customers, interactions, orders and audit logs; global search box across customers, orders and interactions; sorting and paging done by the server. |
| G | Dashboard | KPIs and five charts: customer growth, orders placed, sales, orders by status, interactions by type; 7, 30 or 90 day periods. Figures come from the database on every load. |
| H | Audit | Append-only record of who did what and when, with before/after values; searchable by administrators and managers. |
| I | Reports | Eight reports on screen and as CSV; CSV cells beginning with `= + - @` are neutralised against spreadsheet formula injection; exports are audited. |
| J | Notifications | In-app reminders when a follow-up is due soon or overdue, when one is assigned, when a complaint is logged (to managers), and when an order you created changes status; unread count; mark read. |
| K | Settings and health | Business name, currency, reminder lead time; health page with database status, counts and recent errors; backup and restore scripts. |

## Pages
Login, Dashboard, Customer directory, Add customer, Customer details, Edit customer, Customer interaction history, Add interaction (plus interaction details and edit), Orders directory, Order details, Create order, Follow-up management, Notifications, Reports, Audit logs, User management, User profile, Settings, Not found, Unauthorized, and Duplicate review.

## Non-functional requirements
* **Security:** passwords hashed with bcryptjs; JWT in an HTTP-only SameSite cookie (never in localStorage); CSRF token on every change; Helmet; CORS limited to the client origin; rate limiting (stricter on sign-in); parameterised SQL only; whitelists for sort columns; request bodies limited to 100 KB; secrets only in `.env`.
* **Privacy:** audit rows mask email and phone; data in the repo is synthetic.
* **Data integrity:** money stored as DECIMAL(12,2) and calculated in integer cents; all timestamps UTC; foreign keys; unique keys for duplicates, idempotency and notification de-duplication.
* **Usability:** dark navy theme with teal accent; works from 360 px wide phones to desktop; keyboard accessible, visible focus, labelled form controls, reduced-motion respected.
* **Operability:** clear start-up messages for database, credential and port problems; configurable database port; Windows PowerShell instructions.

## Out of scope (for this version)
Email or SMS sending, file attachments, multi-currency in one order, payment processing, real-time push updates, multi-tenant use, and production deployment.

## Assumptions
Kenyan phone formats are understood (`07…` becomes `2547…`); default currency KES; one business per installation.
