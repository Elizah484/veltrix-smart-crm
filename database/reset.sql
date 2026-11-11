-- ============================================================================
-- VELTRIX CRM - RESET (DESTRUCTIVE)
-- Drops veltrix_db and every record in it. Use only on a development machine.
-- After running it, import schema.sql and seed.sql again.
-- ============================================================================
DROP DATABASE IF EXISTS veltrix_db;
CREATE DATABASE veltrix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
