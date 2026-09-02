-- ═══════════════════════════════════════════════════════════════════════════
--  017 — Marketing attribution (UTM) captured at signup
--
--  The register page reads utm_* from the landing URL and stores them on the
--  hotel, so the Sanvi feed (/api/sanvi/*) can join a signup/payment back to the
--  exact ad/post that caused it. All nullable; unknown → NULL (never invented).
--  Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text;

NOTIFY pgrst, 'reload schema';
