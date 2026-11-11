# Veltrix Smart CRM

A customer relationship manager with a **React** front end, an **Express** REST API and a **MySQL** database (run through XAMPP). It has three roles (Administrator, Manager, Employee) and covers customers with duplicate detection, interaction history and follow-ups, orders, a dashboard with charts, reports with CSV export, audit logs, notifications, user management and settings.

> **Status, stated honestly.** This is a local development project, not a production system. It was written and checked in a sandbox that had **no MySQL and no internet**, so the full stack (React + Express + MySQL together) has **not been run end to end yet**. Section 11 lists exactly what was and was not tested, and gives you a short checklist to run on your own computer. Expect to meet a few small bugs on first run; the troubleshooting section and the checklist will help you find them quickly.

All data in `database/seed.sql` is fictional. Do not put real customer data in this project until you have done the hardening in section 10.

---

## What's new: themes, home page, sign in / sign up

* **Light and dark theme.** The sun/moon button in every navbar switches themes. The choice is remembered in the browser; first-time visitors get their system setting. All colours live in `client/src/styles/global.css` (`:root` for dark, `:root[data-theme="light"]` for light).
* **Public pages with a navbar:** `/` (Home), `/login` (Sign in), `/signup` (Sign up). The signed-in app now lives at `/dashboard`.
* **Sign up.** `POST /api/auth/register` creates an **Employee** account (never a higher role; an administrator can promote it from Users). The form has a required terms checkbox, a password strength meter, and after success shows ticked checkboxes, then sends you to Sign in with a ticked "Registration complete" box. The registration is written to the audit log.
* **Turn sign-up off** by setting `ALLOW_SIGNUP=false` in `server/.env` (see `.env.example`). No database change is needed.

## 1. What you need (Windows)

| Tool | Why | Check it with (PowerShell) |
|---|---|---|
| **Node.js 18 or newer** (LTS) | runs the API and the React dev server | `node -v` |
| **XAMPP** (MySQL/MariaDB + phpMyAdmin) | the database | open the XAMPP Control Panel |
| **VS Code** | editing | |
| A modern browser | Chrome, Edge or Firefox | |

Install Node.js from https://nodejs.org (choose LTS) and XAMPP from https://www.apachefriends.org if you do not have them. Restart PowerShell after installing Node so `node` and `npm` are found.

## 2. Folder layout

```
veltrix/
  client/      React app (Vite). Port 5173.
  server/      Express API. Port 5000.
  database/    schema.sql, seed.sql, backup/restore scripts, ERD
  docs/        requirements, architecture, API, testing, user guide, UI preview
  README.md
```

## 3. Start MySQL in XAMPP

1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL**. Also start **Apache** (phpMyAdmin needs it).
3. Look at the **Port(s)** column next to MySQL. It is normally `3306`. **Remember this number.** If MySQL fails to start with a port error, another MySQL is using 3306: either stop that one, or change XAMPP's MySQL port (Config, my.ini, `port=3307`) and use 3307 below.

## 4. Create the database

1. Open http://localhost/phpmyadmin (if Apache uses another port, use that, for example `http://localhost:8080/phpmyadmin`).
2. Click the **Import** tab. Choose `database/schema.sql`. Click **Import** at the bottom. This creates `veltrix_db` with 15 tables and the roles and permissions.
3. Click **Import** again and choose `database/seed.sql` to load the fictional demo data (29 customers, 86 interactions, 44 orders and four demo users).
4. In the left panel, `veltrix_db` should now list its tables.

Optional: import `database/audit-protection.sql` too. It adds database triggers that stop anyone from changing or deleting audit rows.

## 5. Configure the API

Open a PowerShell window in the project folder, then:

```powershell
cd server
Copy-Item .env.example .env
code .env        # opens it in VS Code
```

Edit `.env`:

* `DB_PORT` : the MySQL port you noted in step 3 (default 3306).
* `DB_PASSWORD` : empty for a fresh XAMPP (root has no password). Set it if you set one.
* `JWT_SECRET` : replace with a long random value. Generate one with:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
* Leave the other values alone for now.

`.env` is listed in `.gitignore`, so it is never committed.

## 6. Install and prepare

Still in the `server` folder:

```powershell
npm install
npm run db:check          # should say "Connected" and "Tables ... 15 (looks right)"
npm run seed:passwords    # gives the four demo accounts a real password
```

Then the client, in a **second** PowerShell window:

```powershell
cd client
npm install
```

If PowerShell says scripts are disabled, run this once and try again:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 7. Run it (two terminals)

Terminal 1, the API:

```powershell
cd server
npm run dev
```

You should see `Veltrix API running at http://localhost:5000/api`. If MySQL is not reachable, the message tells you what to fix.

Terminal 2, the website:

```powershell
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

## 8. Sign in

The password for all demo accounts is the `DEMO_PASSWORD` in `server/.env` (default `Veltrix#2026`).

| Role | Email | What they can do |
|---|---|---|
| Administrator | admin@veltrix.test | everything, including users, settings, sales report |
| Manager | manager@veltrix.test | all customers, orders, reports, audit logs, merging duplicates |
| Employee | employee@veltrix.test | own and unassigned customers, own interactions, basic order steps |
| Employee (second) | kevin@veltrix.test | to check that employees cannot see each other's customers |

## 9. Everyday commands

| What | Command |
|---|---|
| Run the unit tests | `cd server` then `npm test` |
| Check the database connection | `cd server` then `npm run db:check` |
| Reset to a clean demo database | run `database/reset.sql` (it **deletes everything**), then `schema.sql`, `seed.sql`, and `npm run seed:passwords` |
| Backup | `powershell -ExecutionPolicy Bypass -File database\backup.ps1` |
| Restore | `powershell -ExecutionPolicy Bypass -File database\restore.ps1 -File backups\veltrix-YYYYMMDD-HHMM.sql` |
| Different MySQL port or XAMPP folder | add `-Port 3307` and/or `-XamppPath "D:\xampp"` to the backup/restore commands |

Backups are written to `backups\` (ignored by Git). They contain customer data, so store them safely.

## 10. Before this could ever hold real data

Running on `localhost` with demo accounts is **not** production-ready. At minimum you would need to: serve both parts over HTTPS and set `COOKIE_SECURE=true`; set `NODE_ENV=production` with a strong `JWT_SECRET` (the server refuses to start otherwise); use a dedicated MySQL user instead of `root` (see `database/init.sql`); delete or change the demo accounts and password; schedule backups; add monitoring; and have someone review security and data-protection obligations (for example Kenya's Data Protection Act) for the customer data you hold.

## 11. What was tested, and what was not

**Run in the build sandbox (all passed):**
* All server files pass `node --check` (syntax).
* 27 unit tests (`node --test`) on the pure logic: email/phone normalisation, money in cents, CSV formula-injection guard, validation and mass-assignment protection, paging/sort whitelisting, chart buckets, order status rules.
* A wiring check with stubbed packages: all 44 API routes point at real handler functions and every permission code used exists in `schema.sql`.
* A schema/seed consistency check on the SQL files.
* The React client bundles with esbuild (every import resolves), and **all 22 routes (every required page, including not-found and unauthorized) render in a real Chromium browser** without console errors, against a **mocked** API (so it proves the screens work with the data shapes I expected, not with the real server).

**NOT run (could not be, here):**
* `npm install` for either project, the Express server, and any SQL against a real MySQL/MariaDB.
* Real sign-in, CSRF, rate limiting and cookie behaviour; the duplicate constraint; order transactions and idempotency; reports and CSV download; backup and restore scripts.
* Cross-browser and screen-reader testing.

**Your 15-minute first-run checklist** (also in `docs/testing.md`): sign in as each role; add a customer and confirm a duplicate email is blocked; log an interaction with a follow-up; create an order and submit it twice quickly (only one should exist); move it through statuses; export a report to CSV and open it in Excel; sign in as `employee@veltrix.test` and confirm other employees' customers are not visible; stop MySQL and confirm you see a friendly error, not a stack trace. If anything fails, note the "Reference" code shown on the error and look for it in the API terminal.

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| API says `Cannot reach MySQL at 127.0.0.1:3306` | MySQL is not started in XAMPP, or `DB_PORT` is wrong. Check the Port column in the XAMPP panel. |
| `MySQL refused the username or password` | Fix `DB_USER` / `DB_PASSWORD` in `server/.env`. |
| `database "veltrix_db" does not exist` | Import `database/schema.sql` in phpMyAdmin (step 4). |
| `Port 5000 is already in use` | Change `PORT` in `server/.env` **and** the `target` in `client/vite.config.js`, then restart both. |
| Port 5173 busy | Vite will offer the next port. Set `CLIENT_ORIGIN` in `server/.env` to the address Vite prints. |
| Login says invalid email or password for a demo account | Run `npm run seed:passwords` in `server`, and use the exact `DEMO_PASSWORD`. |
| Browser shows "Cannot reach the server" | The API terminal is not running, or it crashed. Look at its output. |
| You get signed out every time the API restarts | Set a fixed `JWT_SECRET` in `.env`. |
| Too many failed sign-ins | The limiter allows `LOGIN_MAX_ATTEMPTS` per 15 minutes per IP. Wait or restart the API. |
| phpMyAdmin import is rejected as too large | Not expected for these files; if it happens, raise `upload_max_filesize` in XAMPP's `php.ini`, or import with `C:\xampp\mysql\bin\mysql.exe -u root -P 3306 < database\schema.sql` from `cmd`. |
| `npm` / `node` not recognised | Restart PowerShell after installing Node.js; confirm with `node -v`. |

## 13. Documentation

* `docs/requirements.md` : what the system must do
* `docs/architecture.md` : how the parts fit together and why
* `docs/api-documentation.md` : every endpoint
* `docs/testing.md` : tests run, tests to run, manual checklist
* `docs/user-guide.md` : using the app, per role
* `database/erd.md` : tables and relationships
* `docs/ui-preview/` : an earlier static, browser-only preview of the design (open `index.html`; it uses its own in-browser data and does not talk to the API)
