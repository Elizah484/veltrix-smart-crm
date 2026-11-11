# Architecture

```
Browser (React, port 5173)
   |  fetch /api/...   (cookie + X-CSRF-Token)
   v
Vite dev server --proxy--> Express API (port 5000)
                               |  routes -> controllers -> services -> mysql2 (parameterised SQL)
                               v
                        MySQL / MariaDB (XAMPP) : veltrix_db
```

## Why this shape
* **Vite proxy:** the browser only talks to one origin, so the sign-in cookie is first-party and SameSite=Lax is enough. CORS is still configured (only the client origin, with credentials) as a second safeguard.
* **Layers on the server:** routes only declare URL, permission and handler; controllers validate input (`validators/schemas.js`) and shape the response; services hold the business rules and SQL; `utils/` holds small pure functions that are unit-tested.
* **Database does the hard guarantees:** duplicate emails (generated column `email_active` with a UNIQUE index), idempotent orders (`orders.idempotency_key` UNIQUE), notification de-duplication, foreign keys. Application checks give friendly messages; the database is the last line of defence.

## Server folders
| Folder | Contents |
|---|---|
| `config/` | environment loading and validation (`env.js`), connection pool and transaction helper (`db.js`) |
| `middleware/` | request id, authentication, permission checks, CSRF, rate limits, error handler |
| `routes/` | the single route table (`index.js`) |
| `controllers/` | HTTP in and out |
| `services/` | customers, interactions, orders, dashboard, reports, audit, notifications, users, settings, auth |
| `validators/` | field whitelists per endpoint |
| `utils/` | normalisation, money, CSV, dates, paging, DTO shaping, audit writer, row-level scope |
| `scripts/` | demo passwords, connection check |
| `tests/` | `node:test` unit tests |

## Client folders
`services/api.js` (the only code that calls the API), `context/` (auth and toasts/confirm dialogs), `hooks/` (data fetching, debounce, URL-synced list state), `components/` (table, pager, forms, charts, badges), `layouts/` (sidebar, top bar, shell), `pages/` (one file per screen).

## Authentication and sessions
1. `POST /auth/login` checks the password with bcryptjs (a dummy hash is compared for unknown emails so timing does not reveal which emails exist).
2. The API sets cookie `vlx_token` (HTTP-only, SameSite=Lax, `Secure` when `COOKIE_SECURE=true`). The JWT carries the user id and a session id only.
3. The CSRF token is `HMAC(JWT_SECRET, session id)`. It is returned in the JSON of login and `/auth/me` and kept in memory by the client, which sends it as `X-CSRF-Token` on every change. A page on another site cannot read it.
4. On **every** request the user, role and permissions are re-read from the database, so deactivation takes effect at once. A 401 makes the client return to the sign-in page.

## Authorisation
Route-level `requirePermission(...)` plus row-level scope for employees (`utils/scope.js`): an employee only reaches customers that are assigned to them, unassigned, or created by them, and the related interactions and orders. Out-of-scope ids return 404, not 403, so ids cannot be probed.

## Concurrency and reliability
* **Optimistic locking:** customers and orders carry `version`; an update with a stale version returns `409 VERSION_CONFLICT` and the UI tells the person to reload.
* **Idempotent orders:** the order form creates one `Idempotency-Key` per form. Re-sending the same key returns the original order (HTTP 200, `meta.replayed = true`) instead of creating another.
* **Transactions:** creating an order (order, items, history), merging customers, status changes and every audit write that belongs to a change commit together or not at all.
* **Money:** integer cents in code, DECIMAL(12,2) in the database; the browser shows a preview but the server recalculates.

## Audit trail
Services call `writeAudit` inside the same transaction as the change. The application only ever INSERTs and SELECTs `audit_logs`; the optional `audit-protection.sql` adds triggers that block UPDATE and DELETE for every database user.

## Error handling
Known problems throw `ApiError` (safe message, code, optional per-field messages). Database errors are mapped (duplicate, missing reference, busy, unavailable). Anything else becomes a generic 500. The real cause is printed in the API terminal with the request id, and a sanitised line is stored in `error_logs`. The browser shows the message and the reference id.

## Response format
Success: `{ "success": true, "data": ..., "meta": { page, pageSize, total, totalPages, sort, dir } }`
Failure: `{ "success": false, "error": { "code", "message", "fields"?, "requestId" } }`

## Time
The database session and connection pool use UTC. The API returns ISO timestamps ending in `Z`; the browser displays them in the person's local time. Dates without a time (registration date, follow-up date) are plain `YYYY-MM-DD` strings and are never shifted.
