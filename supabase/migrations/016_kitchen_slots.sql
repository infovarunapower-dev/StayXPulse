-- ═══════════════════════════════════════════════════════════════════════════
--  016 — Multiple kitchen serving windows
--
--  A kitchen can serve in several windows on the same day (e.g. breakfast,
--  lunch, dinner). Stored as a JSON array of {open,close} "HH:MM" (IST). The
--  guest can order if the current time falls in ANY window. The older single
--  kitchen_open/kitchen_close columns stay as a fallback. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS kitchen_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Fold any existing single window into the new slots array so nothing is lost.
UPDATE hotels
   SET kitchen_slots = jsonb_build_array(jsonb_build_object('open', kitchen_open, 'close', kitchen_close))
 WHERE kitchen_slots = '[]'::jsonb
   AND kitchen_open IS NOT NULL AND kitchen_close IS NOT NULL;

NOTIFY pgrst, 'reload schema';
