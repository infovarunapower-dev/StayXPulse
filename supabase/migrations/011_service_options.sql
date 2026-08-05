-- ═══════════════════════════════════════════════════════════════════════════
--  011 — Per-hotel custom service options
--
--  Lets each hotel manage its own Room-Service list (add/remove/reorder) from
--  the admin dashboard; the guest QR page renders these. A hotel with no rows
--  falls back to the built-in defaults. Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  icon        text NOT NULL DEFAULT '🛎',
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_options_hotel ON service_options (hotel_id, sort_order, created_at);

-- Same posture as every other table: RLS on, no policies — the backend uses the
-- service-role key and bypasses it; anon/authenticated get nothing directly.
ALTER TABLE service_options ENABLE ROW LEVEL SECURITY;
