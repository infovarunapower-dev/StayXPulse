-- ═══════════════════════════════════════════════════════════════════════════
--  007 — Scheduled time for service requests (wake-up calls)
--
--  A guest requesting a "Wake-up Call" now picks a time. We store that moment
--  here so the hotel admin dashboard can remind staff ~10 minutes before.
--  NULL for every other request type. Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Helps the dashboard poll upcoming scheduled requests efficiently.
CREATE INDEX IF NOT EXISTS idx_service_requests_scheduled
  ON service_requests (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
