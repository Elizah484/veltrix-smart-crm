-- ============================================================================
-- VELTRIX CRM - database schema
-- Target: MySQL 5.7+ / MariaDB 10.4+ (the version bundled with XAMPP)
-- Engine: InnoDB, character set utf8mb4
--
-- Safe to re-run: every table uses CREATE TABLE IF NOT EXISTS and the reference
-- data uses INSERT IGNORE. To wipe everything, use database/reset.sql instead.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS veltrix_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE veltrix_db;

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- Roles and permissions (permissions are data, so changing who can do what is
-- a database edit, not a code change)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(30)  NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(60)  NOT NULL,
  description VARCHAR(160) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TINYINT UNSIGNED  NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Users. Accounts are deactivated, never deleted, so history stays intact.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(100) NOT NULL,
  email               VARCHAR(190) NOT NULL,
  password_hash       VARCHAR(100) NOT NULL,
  role_id             TINYINT UNSIGNED NOT NULL,
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at       DATETIME     NULL,
  password_changed_at DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Customers
--   email_normalized  lower-cased, trimmed email
--   phone_normalized  digits only, Kenyan 07xx numbers turned into 2547xx
--   email_active      generated column: the email while the customer is not
--                     archived, otherwise NULL. Its UNIQUE index enforces
--                     "one active customer per email" inside the database, and
--                     frees the email when a profile is archived or merged.
--   version           optimistic locking counter
-- Customers with history are archived, never deleted (see FK RESTRICT rules).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code    VARCHAR(20)  NULL,
  first_name       VARCHAR(60)  NOT NULL,
  last_name        VARCHAR(60)  NOT NULL,
  email            VARCHAR(190) NULL,
  email_normalized VARCHAR(190) NULL,
  phone            VARCHAR(30)  NULL,
  phone_normalized VARCHAR(20)  NULL,
  company          VARCHAR(120) NULL,
  address          VARCHAR(255) NULL,
  category         ENUM('Retail','Wholesale','Corporate','VIP') NOT NULL DEFAULT 'Retail',
  status           ENUM('Active','Inactive','Archived') NOT NULL DEFAULT 'Active',
  registered_on    DATE         NOT NULL,
  assigned_user_id INT UNSIGNED NULL,
  created_by       INT UNSIGNED NULL,
  merged_into_id   INT UNSIGNED NULL,
  notes            TEXT         NULL,
  version          INT UNSIGNED NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  email_active     VARCHAR(190) GENERATED ALWAYS AS (IF(status = 'Archived', NULL, email_normalized)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (customer_code),
  UNIQUE KEY uq_customers_email_active (email_active),
  KEY idx_customers_name (last_name, first_name),
  KEY idx_customers_phone (phone_normalized),
  KEY idx_customers_status (status),
  KEY idx_customers_category (category),
  KEY idx_customers_registered (registered_on),
  KEY idx_customers_assigned (assigned_user_id),
  CONSTRAINT fk_customers_assigned FOREIGN KEY (assigned_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_merged FOREIGN KEY (merged_into_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Interactions (calls, emails, meetings, chats, complaints, follow-ups, other)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interactions (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id          INT UNSIGNED NOT NULL,
  type                 ENUM('Phone call','Email','In-person meeting','Live chat','Complaint','Follow-up','Other') NOT NULL,
  occurred_at          DATETIME     NOT NULL,
  user_id              INT UNSIGNED NOT NULL,
  subject              VARCHAR(150) NOT NULL,
  notes                TEXT         NULL,
  outcome              VARCHAR(255) NULL,
  follow_up_date       DATE         NULL,
  follow_up_done       TINYINT(1)   NOT NULL DEFAULT 0,
  follow_up_assignee_id INT UNSIGNED NULL,
  status               ENUM('Open','In progress','Completed') NOT NULL DEFAULT 'Open',
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_interactions_customer (customer_id, occurred_at),
  KEY idx_interactions_followup (follow_up_date, follow_up_done),
  KEY idx_interactions_status (status),
  KEY idx_interactions_user (user_id),
  KEY idx_interactions_assignee (follow_up_assignee_id),
  CONSTRAINT fk_interactions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_interactions_assignee FOREIGN KEY (follow_up_assignee_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interaction_history (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  interaction_id INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  summary        VARCHAR(500) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ih_interaction (interaction_id, created_at),
  CONSTRAINT fk_ih_interaction FOREIGN KEY (interaction_id) REFERENCES interactions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ih_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Orders. Money is DECIMAL, never floating point.
--   idempotency_key  unique key sent by the browser; a repeated submission with
--                    the same key returns the original order instead of a copy.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code       VARCHAR(20)  NULL,
  customer_id      INT UNSIGNED NOT NULL,
  order_date       DATETIME     NOT NULL,
  status           ENUM('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  payment_status   ENUM('Unpaid','Partially paid','Paid','Refunded') NOT NULL DEFAULT 'Unpaid',
  subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  shipping_details VARCHAR(500)  NULL,
  idempotency_key  VARCHAR(80)   NULL,
  created_by       INT UNSIGNED  NOT NULL,
  version          INT UNSIGNED  NOT NULL DEFAULT 1,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (order_code),
  UNIQUE KEY uq_orders_idempotency (idempotency_key),
  KEY idx_orders_customer (customer_id, order_date),
  KEY idx_orders_status (status),
  KEY idx_orders_payment (payment_status),
  KEY idx_orders_date (order_date),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity     INT UNSIGNED NOT NULL,
  unit_price   DECIMAL(12,2) NOT NULL,
  line_total   DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED NOT NULL,
  kind       ENUM('status','payment') NOT NULL DEFAULT 'status',
  from_value VARCHAR(30)  NULL,
  to_value   VARCHAR(30)  NOT NULL,
  note       VARCHAR(255) NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_osh_order (order_id, created_at),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_osh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Notifications. dedupe_key stops the same reminder being created twice.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  type       ENUM('followup','complaint','order','operation') NOT NULL,
  message    VARCHAR(300) NOT NULL,
  link       VARCHAR(120) NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  dedupe_key VARCHAR(80)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_dedupe (user_id, dedupe_key),
  KEY idx_notifications_user (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Audit log. The application only ever INSERTs and SELECTs here.
-- Run database/audit-protection.sql to make the database itself refuse
-- UPDATE and DELETE on this table.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(60)  NOT NULL,
  entity_type VARCHAR(40)  NULL,
  entity_id   INT UNSIGNED NULL,
  summary     VARCHAR(500) NOT NULL,
  before_json TEXT NULL,
  after_json  TEXT NULL,
  request_id  VARCHAR(40)  NULL,
  ip_address  VARCHAR(45)  NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_action (action),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Duplicate review decisions (so a pair a manager marked "different people"
-- does not come back). customer_a_id is always the smaller id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS duplicate_reviews (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_a_id INT UNSIGNED NOT NULL,
  customer_b_id INT UNSIGNED NOT NULL,
  decision      ENUM('different','merged') NOT NULL,
  decided_by    INT UNSIGNED NOT NULL,
  decided_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dup_pair (customer_a_id, customer_b_id),
  CONSTRAINT fk_dup_a FOREIGN KEY (customer_a_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT fk_dup_b FOREIGN KEY (customer_b_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT fk_dup_user FOREIGN KEY (decided_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- System settings and a sanitized error log (no stack traces, no personal data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   VARCHAR(60)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  VARCHAR(40)  NULL,
  status_code SMALLINT UNSIGNED NOT NULL,
  method      VARCHAR(10)  NULL,
  path        VARCHAR(200) NULL,
  message     VARCHAR(300) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_error_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Reference data (required for the application to work)
-- ============================================================================
INSERT IGNORE INTO roles (id, code, name) VALUES
  (1, 'admin',    'Administrator'),
  (2, 'manager',  'Manager'),
  (3, 'employee', 'Employee');

INSERT IGNORE INTO permissions (code, description) VALUES
  ('customers.view_all',   'See every customer (otherwise only assigned, unassigned or own)'),
  ('customers.view',       'View customers'),
  ('customers.create',     'Register customers'),
  ('customers.edit',       'Edit customers (own scope unless view_all)'),
  ('customers.archive',    'Archive and restore customers'),
  ('customers.merge',      'Review duplicates and merge customers'),
  ('interactions.view',    'View interactions'),
  ('interactions.create',  'Record interactions'),
  ('interactions.edit',    'Edit interactions (own unless manage_all)'),
  ('interactions.manage_all', 'Edit any interaction'),
  ('interactions.assign',  'Assign follow-ups to other staff'),
  ('orders.view',          'View orders'),
  ('orders.create',        'Create orders'),
  ('orders.status_basic',  'Move orders to Confirmed or Processing'),
  ('orders.status_any',    'Move orders to any valid next status'),
  ('orders.cancel',        'Cancel orders'),
  ('orders.refund',        'Mark payments as refunded'),
  ('dashboard.full',       'See team-wide dashboard figures'),
  ('reports.view',         'Open reports'),
  ('reports.sales',        'Open the sales summary report'),
  ('reports.export',       'Export reports to CSV'),
  ('audit.view',           'Review audit logs'),
  ('users.manage',         'Manage user accounts and roles'),
  ('settings.manage',      'Change system settings and see system health');

-- Administrator: everything
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions;

-- Manager: everything except user management, settings and the sales summary
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions
  WHERE code NOT IN ('users.manage', 'settings.manage', 'reports.sales');

-- Employee: day-to-day work on their own customers
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions
  WHERE code IN ('customers.view', 'customers.create', 'customers.edit',
                 'interactions.view', 'interactions.create', 'interactions.edit',
                 'orders.view', 'orders.create', 'orders.status_basic');

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('company_name',  'Northline Supplies Ltd'),
  ('currency',      'KES'),
  ('reminder_days', '2');
