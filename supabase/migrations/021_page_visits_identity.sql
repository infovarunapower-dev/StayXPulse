-- ═══════════════════════════════════════════════════════════════════════════
--  021 — attach identity to page_visits (for logged-in visits)
--
--  When a visit happens while someone is signed in, the backend derives their
--  hotel/email from the JWT (server-side, not trusted from the client) and
--  stores it here. Anonymous (pre-login) visits leave these NULL.
--
--  Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE page_visits
  ADD COLUMN IF NOT EXISTS hotel_id   uuid,
  ADD COLUMN IF NOT EXISTS hotel_name text,
  ADD COLUMN IF NOT EXISTS user_email text;

NOTIFY pgrst, 'reload schema';
