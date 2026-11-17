-- ─────────────────────────────────────────────────────────────────────────────
-- 026 · Sunver Growth Engine — engine-connection support
--
-- Two additive columns on `hotels`. Safe to run on live: both are optional with
-- defaults, nothing is dropped or rewritten, and the app self-heals if this has
-- not run yet (inserts/selects fall back).
--
--   1. whatsapp_opt_in  — the signup consent tick ("setup help on WhatsApp").
--   2. updated_at       — a last-changed stamp so the engine's hourly
--                         GET /api/sge/accounts?updated_since=… can list only
--                         accounts that changed (a trigger keeps it current).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) WhatsApp opt-in (unticked by default, as WhatsApp's rules require) ─────────
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

-- 2) updated_at ────────────────────────────────────────────────────────────────
-- Add without a default first so we can backfill real timestamps, then set the
-- default for future inserts.
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE hotels
   SET updated_at = COALESCE(plan_valid_from, created_at, now())
 WHERE updated_at IS NULL;

ALTER TABLE hotels ALTER COLUMN updated_at SET DEFAULT now();

-- Bump updated_at on every change to a hotel row (signup insert already stamps it
-- via the default; this covers plan activation, profile edits, etc.).
CREATE OR REPLACE FUNCTION sxp_touch_hotels_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hotels_updated_at ON hotels;
CREATE TRIGGER trg_hotels_updated_at
  BEFORE UPDATE ON hotels
  FOR EACH ROW
  EXECUTE FUNCTION sxp_touch_hotels_updated_at();

-- Keyset paging / filtering for the daily account list.
CREATE INDEX IF NOT EXISTS idx_hotels_updated_at ON hotels (updated_at);
