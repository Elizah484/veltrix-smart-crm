# User guide

## Signing in
Open http://localhost:5173, enter your email and password and press **Sign in**. If your session ends you are returned to this page. This happens if you were deactivated, or when two hours have passed since you signed in (the lifetime is `JWT_EXPIRES_IN` in `server/.env`). Use **My profile** (top right) to change your password: at least 10 characters with a letter and a number.

## Finding your way
The left menu shows only what your role can use. The search box at the top finds customers, orders and interactions at once. The bell shows unread reminders. On a phone, open the menu with the button at the top left.

## What each role sees
| Area | Administrator | Manager | Employee |
|---|---|---|---|
| Dashboard | full, with sales figures | full, with sales figures | your own customers only |
| Customers | all | all, can merge duplicates | assigned to you, unassigned, or created by you |
| Interactions and follow-ups | all | all | yours or assigned to you |
| Orders | all, can refund | all, can cancel | create; confirm and process |
| Reports | all, including Sales summary | all except Sales summary | not available |
| Audit logs | yes | yes | no |
| Users and Settings | yes | no | no |

## Customers
* **Add:** Customers → Add customer. Give a first and last name, a registration date, and an email, a phone number, or both. When you leave the name, email or phone field, Veltrix checks for people who may already exist. A red notice (same email) means open that record instead. A yellow notice (similar customer) means check, then tick "different customer" if you are sure.
* **Open a customer** to see their details, interaction timeline, orders and change history.
* **Edit** from the list or the customer page. If someone else saved first you will be asked to reload.
* **Archive** hides a customer from normal lists but keeps all history; **Restore** brings them back. Customers are never deleted.
* **Duplicate review** (managers and administrators): merge keeps one record, moves the other's orders and interactions to it, and archives the duplicate. "They are different people" stops that pair appearing again.

## Interactions and follow-ups
* Log what happened from a customer page (**Log interaction**) or Interactions → Add interaction. Pick the type, time and subject; add notes and the outcome.
* Set a **follow-up date** if you promised to get back. It appears under **Follow-ups** (Overdue, Upcoming, Completed). You get a reminder shortly before it is due.
* **Mark done** when finished. Managers can reassign a follow-up.

## Orders
* **Create order:** choose the customer, add items (product, quantity, unit price), optional discount percentage, payment status and shipping details. The total updates as you type. Press Create once; pressing twice will not create two orders.
* **Move an order along** with the buttons on the order page. The flow is Pending → Confirmed → Processing → Shipped → Delivered. Cancelled orders cannot be reopened. Every change is kept in the order's history.
* Change the **payment status** from the dropdown on the order page.

## Reports
Reports → choose a report and, if you like, a date range. **Download CSV** opens in Excel. Cells that start with `=`, `+`, `-` or `@` are saved as plain text so a spreadsheet cannot run them as formulas. Every download is recorded in the audit log.

## Audit logs (managers, administrators)
Shows who did what and when. Press **Show details** on a row to see values before and after. Entries cannot be changed or deleted from the app.

## Users and settings (administrators)
* **Users:** add a person with a temporary password and a role, change a role, reset a password, or deactivate. Deactivation takes effect immediately and keeps their history. You cannot deactivate yourself, and the last active administrator is protected.
* **Settings:** business name, currency and how many days before a follow-up to remind people. The page also shows system health and recent errors.

## When something goes wrong
A red box explains the problem in plain words. If it shows a **Reference** code, give that to your administrator. If you see "Cannot reach the server", the API is not running or the database is stopped (see README, Troubleshooting).
