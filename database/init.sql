-- ============================================================================
-- VELTRIX CRM - database initialisation
-- Creates an empty veltrix_db. Run this first, then schema.sql, then (optional)
-- seed.sql. schema.sql also creates the database if it is missing, so this file
-- is only needed if you want to create the database on its own.
-- ============================================================================
CREATE DATABASE IF NOT EXISTS veltrix_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- OPTIONAL: a dedicated database user for the API instead of XAMPP's root.
-- Replace the password, then put the same values in server/.env (DB_USER / DB_PASSWORD).
-- Uncomment to use.
--
-- CREATE USER IF NOT EXISTS 'veltrix_app'@'localhost' IDENTIFIED BY 'change-this-password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON veltrix_db.* TO 'veltrix_app'@'localhost';
-- REVOKE UPDATE, DELETE ON veltrix_db.audit_logs FROM 'veltrix_app'@'localhost';
-- FLUSH PRIVILEGES;
--
-- Note: MySQL cannot revoke a single table's privilege that was granted at the
-- database level. If the REVOKE above fails, grant per table instead, or use
-- audit-protection.sql, which blocks changes with triggers and works for every user.
