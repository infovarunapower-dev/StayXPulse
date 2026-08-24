-- ═══════════════════════════════════════════════════════════════════════════
--  015 — Kitchen hours
--
--  A hotel can limit food ordering to its kitchen's serving hours. When enabled
--  and the current time (IST) is outside the window, the guest food menu shows
--  "currently not serving" and new food orders are rejected. Times are stored as
--  "HH:MM" (24h, IST). Room-service requests are unaffected. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS kitchen_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kitchen_open  text,
  ADD COLUMN IF NOT EXISTS kitchen_close text;

NOTIFY pgrst, 'reload schema';
