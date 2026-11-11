-- ============================================================================
-- VELTRIX CRM - make the audit log append-only (OPTIONAL, recommended)
--
-- Creates two triggers that make the database refuse any UPDATE or DELETE on
-- audit_logs, for every database user including root.
--
-- phpMyAdmin: select veltrix_db, open the Import tab and import this file as it
-- is. (If you paste it into the SQL tab instead, set the "Delimiter" box under
-- the text area to $$ first.)
--
-- To remove protection later (for example to wipe a development database):
--   DROP TRIGGER IF EXISTS trg_audit_no_update;
--   DROP TRIGGER IF EXISTS trg_audit_no_delete;
-- ============================================================================
USE veltrix_db;

DROP TRIGGER IF EXISTS trg_audit_no_update;
DROP TRIGGER IF EXISTS trg_audit_no_delete;

DELIMITER $$

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: updates are not allowed';
END$$

CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: deletes are not allowed';
END$$

DELIMITER ;
