-- ═══════════════════════════════════════════════════════════════════════════
--  023 — Sunver Growth Engine attribution (Requirement 2)
--
--  Store the engine's tracking id + the full tag set captured at signup, so a
--  sale can be credited back to the ad / WhatsApp chat that produced it.
--  Both nullable — existing hotels keep NULL, nothing else changes.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS sge_aid     text,
  ADD COLUMN IF NOT EXISTS attribution jsonb;

NOTIFY pgrst, 'reload schema';
