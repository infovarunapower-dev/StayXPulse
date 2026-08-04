-- ═════════════════════════════════════════════════════════════════════════════
--  009 — Daily AI marketing posters
--
--  History table + public storage bucket for the cron-generated daily poster
--  (/api/cron/daily-poster). The table doubles as the theme-rotation memory:
--  the picker reads the most recent rows to avoid repeating a theme.
--  Idempotent; safe to re-run.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_posters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme        TEXT NOT NULL,
  headline     TEXT NOT NULL,
  subtext      TEXT,
  caption      TEXT,
  image_prompt TEXT,
  image_url    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rotation query is "latest N ordered by created_at".
CREATE INDEX IF NOT EXISTS idx_daily_posters_created_at
  ON daily_posters (created_at DESC);

-- Backend uses the service-role key (bypasses RLS); enabling RLS with no
-- policies simply blocks anon/authenticated clients, same as other tables.
ALTER TABLE daily_posters ENABLE ROW LEVEL SECURITY;

-- Public bucket so the poster URL can be shared straight to WhatsApp/Instagram
-- and embedded in the delivery email.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'daily-posters',
  'daily-posters',
  true,
  10485760,                      -- 10MB
  ARRAY['image/png','image/jpeg','image/webp']
) ON CONFLICT DO NOTHING;

-- Public READ only — writes go through the backend with the service-role key,
-- which bypasses these policies (same pattern as hotel-logos in storage.sql).
DROP POLICY IF EXISTS "Public read daily posters" ON storage.objects;
CREATE POLICY "Public read daily posters"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'daily-posters');
