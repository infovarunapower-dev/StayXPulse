-- ═══════════════════════════════════════════════════════════════════════════
--  025 — POS integration (read-only orders + menu feed for a hotel's own PMS)
--
--  • food_orders.updated_at: lets the POS poll "only what changed since X" and
--    pick up status changes (incl. cancelled). Nullable, set when an admin
--    changes an order's status. Reads COALESCE(updated_at, created_at).
--  • integration_tokens: Bearer token → hotel + mode (live/test). The POS polls
--    /api/integration/* with this token; everything is read-only + hotel-scoped.
--
--  Purely additive — no existing data changes, guest order flow untouched.
--  Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE food_orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS integration_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text NOT NULL UNIQUE,
  hotel_id   uuid REFERENCES hotels(id) ON DELETE CASCADE,
  mode       text NOT NULL DEFAULT 'live',   -- 'live' (real orders) | 'test' (TEST-marked only)
  label      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY; -- backend service-role only

NOTIFY pgrst, 'reload schema';
