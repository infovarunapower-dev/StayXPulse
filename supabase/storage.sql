-- ═══════════════════════════════════════════════════════════════
--  StayXPulse — Supabase Storage Setup
--  Run this AFTER schema.sql in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Create storage bucket for hotel logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hotel-logos',
  'hotel-logos',
  true,                          -- public bucket (logos are public)
  2097152,                       -- 2MB limit
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
) ON CONFLICT DO NOTHING;

-- Create storage bucket for food images (future use)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-images',
  'food-images',
  true,
  5242880,                       -- 5MB limit
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT DO NOTHING;

-- Public READ only. Writes go through the backend, which uses the service-role
-- key and bypasses these policies entirely.
--
-- There is deliberately no INSERT or DELETE policy: granting those without an
-- owner check (as an earlier version did) lets anyone upload arbitrary files
-- into a public bucket — free CDN hosting for whatever they like — and delete
-- every hotel's logo.
CREATE POLICY "Public read hotel logos"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('hotel-logos', 'food-images'));
