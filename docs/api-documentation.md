# API documentation

Base URL in development: `http://localhost:5000/api` (the React app reaches it through the Vite proxy at `/api`).

## Conventions
* JSON in and out. Success: `{ "success": true, "data": …, "meta": … }`. Failure: `{ "success": false, "error": { "code", "message", "fields"?, "requestId" } }`.
* **Sign-in** is a cookie (`vlx_token`, HTTP-only). Send requests with credentials.
* **CSRF:** every POST, PUT and PATCH must send `X-CSRF-Token` (value from `/auth/login` or `/auth/me`). Missing or wrong → `403 CSRF_INVALID`.
* **Lists** accept `page` (default 1), `pageSize` (default 10, max 100), `sort`, `dir` (`asc`/`desc`). An unknown `sort` is a 400. `meta` returns `page, pageSize, total, totalPages, sort, dir`.
* **Dates** are `YYYY-MM-DD`; timestamps are ISO 8601 UTC.
* **Status codes:** 200 ok, 201 created, 400 bad input, 401 not signed in, 403 not allowed, 404 not found (also for records outside your scope), 409 conflict, 413 too large, 429 too many requests, 500 server error, 503 database unavailable.
* Common error codes: `VALIDATION_ERROR` (with `fields`), `DUPLICATE_EMAIL`, `POSSIBLE_DUPLICATE`, `VERSION_CONFLICT`, `INVALID_TRANSITION`, `FORBIDDEN`, `UNAUTHORIZED`, `NETWORK` (client only).

Permissions below are the codes in the `permissions` table.

## Health (public)
| Method and path | Notes |
|---|---|
| `GET /health` | `{ status: "ok", database: "up" }`, or 503 if MySQL is unreachable. |

## Authentication
| Method and path | Permission | Body / notes |
|---|---|---|
| `POST /auth/login` | public (rate-limited) | `{ email, password }` → `{ user, csrfToken }` and sets the cookie. Wrong credentials give the same message whether the email exists or not. |
| `GET /auth/me` | signed in | `{ user: { id, name, email, role, roleName, permissions[], lastLoginAt }, csrfToken }` |
| `POST /auth/logout` | signed in | clears the cookie |
| `POST /auth/change-password` | signed in | `{ currentPassword, newPassword }` (10+ characters, a letter and a number) |

## Customers
| Method and path | Permission | Notes |
|---|---|---|
| `GET /customers` | customers.view | filters `q, category, status, from, to`; sorts `code, name, email, category, status, registered, assigned` |
| `POST /customers` | customers.create | body fields: `firstName, lastName, email, phone, company, address, category, status, registeredOn, assignedUserId, notes, confirmDuplicate`. Needs an email or a phone. 409 `DUPLICATE_EMAIL` (cannot be overridden) or `POSSIBLE_DUPLICATE` (resend with `confirmDuplicate: true`); both carry `existing[]`. |
| `POST /customers/check-duplicates` | customers.view | same body (`excludeId` optional) → `{ hard[], soft[] }` |
| `GET /customers/duplicates` | customers.merge | possible duplicate pairs with reason and order counts |
| `POST /customers/duplicates/dismiss` | customers.merge | `{ customerAId, customerBId }` |
| `POST /customers/merge` | customers.merge | `{ keepId, mergeId }` → counts moved |
| `GET /customers/:id` | customers.view | adds `orderCount, lifetimeValue, interactionCount, canEdit` |
| `PUT /customers/:id` | customers.edit | as create plus `version`; 409 `VERSION_CONFLICT` if stale; archived customers cannot be edited |
| `PATCH /customers/:id/status` | customers.archive | `{ status: "Archived" | "Active" }` |
| `GET /customers/:id/interactions` | customers.view + interactions.view | newest first |
| `GET /customers/:id/orders` | customers.view + orders.view | |
| `GET /customers/:id/history` | customers.view | audit entries for this customer |

## Interactions
| Method and path | Permission | Notes |
|---|---|---|
| `GET /interactions` | interactions.view | filters `q, type, status, from, to, customerId`; sorts `at, customer, type, subject, status, followUp` |
| `GET /interactions/follow-ups?state=overdue|upcoming|done` | interactions.view | `{ items, counts }` |
| `POST /interactions` | interactions.create | `customerId, type, occurredAt, subject, notes, outcome, followUpDate, followUpAssigneeId, status` |
| `GET /interactions/:id` | interactions.view | adds `history[]`, `canEdit`, `canComplete` |
| `PUT /interactions/:id` | interactions.edit | |
| `PATCH /interactions/:id/complete` | interactions.view (owner or assignee or manager) | marks the follow-up done |
| `PATCH /interactions/:id/assign` | interactions.assign | `{ assigneeId }` |

## Orders
| Method and path | Permission | Notes |
|---|---|---|
| `GET /orders` | orders.view | filters `q, status, payment, from, to, customerId`; sorts `code, customer, date, status, pay, total` |
| `POST /orders` | orders.create | header `Idempotency-Key` (8–80 chars) recommended. Body `{ customerId, items:[{productName, quantity, unitPrice}], discountPercent, paymentStatus, shippingDetails }`. 201 for a new order; 200 with `meta.replayed:true` when the key was used before. |
| `GET /orders/:id` | orders.view | items, history, `allowedStatuses`, `canRefund` |
| `GET /orders/:id/history` | orders.view | |
| `PATCH /orders/:id/status` | orders.status_basic or status_any | `{ status, note?, version }`. Allowed moves: Pending→Confirmed/Cancelled, Confirmed→Processing/Cancelled, Processing→Shipped/Cancelled, Shipped→Delivered. Cancelling also needs orders.cancel. Employees can only confirm and process. |
| `PATCH /orders/:id/payment` | orders.view | `{ paymentStatus, version }`; `Refunded` needs orders.refund |

## Dashboard
| Method and path | Notes |
|---|---|
| `GET /dashboard/summary?days=7|30|90` | KPIs, status and type breakdowns, recent interactions, follow-ups, recent activity (employees see their own), duplicate count (managers and administrators) |
| `GET /dashboard/customer-trends?days=` | `{ points:[{x, from, y}] }` |
| `GET /dashboard/order-trends?days=` | `{ orders:[…], sales:[…] }` |

Periods longer than 31 days are grouped by week. Every figure respects the signed-in person's customer scope.

## Reports (reports.view)
`GET /reports/:type?from=&to=` with `type` one of `customers, registrations, orders, sales (reports.sales), status, interactions, followups, data-quality`. Returns `{ title, columns, rows (first 500), totalRows, note }`. Add `&format=csv` to download (needs reports.export; the export is written to the audit log; cells starting with `= + - @` get a leading apostrophe).

## Notifications (any signed-in user, own only)
`GET /notifications?unread=true&limit=` → `{ items, unread }` · `PATCH /notifications/:id/read` · `PATCH /notifications/read-all`

## Users and settings
| Method and path | Permission |
|---|---|
| `GET /users/directory` | signed in (active users: id, name, role) |
| `GET /users` · `POST /users` · `PUT /users/:id` | users.manage. You cannot deactivate or demote yourself, and the last active administrator is protected. |
| `GET /settings` | signed in |
| `PUT /settings` | settings.manage: `{ companyName, currency (KES/USD/EUR/GBP), reminderDays (1–14) }` |
| `GET /system/health` | settings.manage: database status, counts, recent errors |
| `GET /audit-logs` | audit.view: filters `q, userId, entityType, entityId, action, from, to`; sorts `at, user, action` |
