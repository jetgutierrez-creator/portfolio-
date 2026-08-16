-- ============================================================
--  Portfolio Contact Form — Database Schema (PostgreSQL)
--
--  Usage:
--    psql "$DATABASE_URL" -f schema.sql
--  or connect with psql and paste the statements below.
--
--  NOTE: server.js also auto-creates this table on startup,
--  so running this file manually is optional.
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,               -- visitor's full name
    email       VARCHAR(160) NOT NULL,               -- visitor's email address
    subject     VARCHAR(200) NOT NULL,               -- message subject
    message     TEXT         NOT NULL,               -- message content
    status      VARCHAR(10)  NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'read', 'replied')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()  -- date & time received
);

-- Fast "newest first" listing for the admin panel
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
-- Filter by status (unread / read / replied)
CREATE INDEX IF NOT EXISTS idx_messages_status     ON messages (status);
