# Testing

## Honesty note
Only things listed under "Executed" were actually run. Everything under "Not yet executed" is a checklist for you; do not treat it as passed.

## Executed (in the build sandbox, no MySQL, no network)
| Check | Command / method | Result |
|---|---|---|
| Server syntax | `node --check` on every `.js` file | passed |
| Unit tests (27) | `cd server` then `npm test` | passed |
| Route wiring | stubbed-package script: every route handler is a function; every permission code used exists in `schema.sql` (44 routes, 17 codes) | passed |
| SQL consistency | script comparing schema columns with the seed inserts | passed |
| Client compile | esbuild bundle of `client/src/main.jsx` | passed |
| Client render | all 22 routes loaded in Chromium against a **mocked** API: no page errors or console warnings; list filters kept in the URL | passed |

Unit tests cover: email/phone normalisation, LIKE escaping, password rule, money in cents and discount maths, CSV formula guard and BOM, request validation and mass-assignment protection, id/date/enum parsing, paging and sort whitelisting (including `constructor`), chart bucketing, date helpers, order status rules per role.

## Not yet executed (needs your computer)
Please run these once after setup and tick them off.

**Setup**
- [ ] `npm install` succeeds in `server` and `client`
- [ ] `npm run db:check` reports 15 tables and users
- [ ] `npm test` in `server` passes on your machine
- [ ] Both servers start; http://localhost:5000/api/health shows `ok`

**Authentication and roles**
- [ ] Wrong password shows a friendly message; after 10 wrong attempts the limiter blocks
- [ ] Sign in as admin, manager, employee: menus differ as described in the user guide
- [ ] Type `/users` as the employee: you land on "Unauthorized"
- [ ] Deactivate the employee as admin; their next click returns to the sign-in page
- [ ] Sign out, then press Back: protected pages do not show data

**Customers**
- [ ] Add a customer; leave email and phone empty → both fields show an error
- [ ] Add another customer with the same email → blocked, shows the existing one
- [ ] Add one with the same name and a new email → warning, then "different customer" lets you save
- [ ] Edit in two browser tabs; save in both → second save shows the "changed while you were editing" message
- [ ] Archive and restore a customer; archived ones cannot be edited or get orders
- [ ] Duplicate review: merge one pair; its orders and interactions move

**Interactions and follow-ups**
- [ ] Log an interaction with a follow-up date in the past → shows under Overdue; Mark done moves it
- [ ] Reassign a follow-up; the other user gets a notification
- [ ] Log a Complaint; a manager gets a notification

**Orders**
- [ ] Create an order with a 10% discount: on-screen and saved totals match
- [ ] Double-click "Create order" quickly: only one order exists
- [ ] Employee can Confirm and Process but not Ship or Cancel; manager can cancel
- [ ] A cancelled order cannot move again

**Search, reports, audit**
- [ ] Global search finds a customer by name, email fragment and phone
- [ ] Customer list sorts, filters and pages; the URL keeps the filters
- [ ] Download the Customers CSV and open in Excel; a customer whose name starts with `=` (try one) shows as text, not a formula
- [ ] Audit logs show your actions; there is no edit or delete control
- [ ] `database\audit-protection.sql` imported: `UPDATE audit_logs SET summary='x'` in phpMyAdmin fails

**Resilience**
- [ ] Stop MySQL in XAMPP: pages show a friendly error with a reference, the API terminal shows the real cause, no stack trace in the browser
- [ ] Start MySQL again and press "Try again": it recovers
- [ ] `backup.ps1` creates a file; `restore.ps1` restores it after you type RESTORE

**Responsive and accessibility (spot check)**
- [ ] 390 px wide (browser dev tools): menu opens from the button, tables scroll sideways, forms stack
- [ ] Tab through the login and customer form: focus ring visible; errors are announced next to the field
- [ ] Zoom to 200%: nothing is cut off

## Reporting a bug
Note the page, what you clicked, and the **Reference** code on the red error box. Search the API terminal for that code to see the real cause.
