-- ═══════════════════════════════════════════════════════════════════════════
--  019 — order/request reminder tracking
--
--  Lets a scheduled job re-push a "still pending" nudge for a food order or
--  service request the hotel hasn't acted on yet. Two columns per table:
--    reminder_count   — how many nudges have been sent (capped in code)
--    last_reminded_at — when the last nudge went out (paces the interval)
--
--  A reminder stops the moment status leaves 'pending' (admin marked it
--  completed/cancelled). Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE food_orders
  ADD COLUMN IF NOT EXISTS reminder_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS reminder_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

-- The cron scans for pending, under-reminded rows — index the hot filter.
CREATE INDEX IF NOT EXISTS idx_food_orders_pending
  ON food_orders (status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_service_requests_pending
  ON service_requests (status, created_at) WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
