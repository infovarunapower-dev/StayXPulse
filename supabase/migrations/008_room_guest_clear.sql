-- ═══════════════════════════════════════════════════════════════════════════
--  008 — Per-room "clear guest view"
--
--  Lets a hotel admin reset what a room's guest sees under "My Orders" (e.g. on
--  checkout/turnover) WITHOUT deleting anything. We stamp the moment of the
--  clear here; the guest endpoint then only returns activity created after it.
--  All orders/requests stay in the dashboard, analytics and revenue.
--  Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS guest_cleared_at TIMESTAMPTZ;
