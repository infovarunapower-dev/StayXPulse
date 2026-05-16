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

-- Allow public read access to hotel-logos bucket
CREATE POLICY "Public read hotel logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hotel-logos');

-- Allow authenticated upload to hotel-logos
CREATE POLICY "Allow logo upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'hotel-logos');

-- Allow delete own logos
CREATE POLICY "Allow logo delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'hotel-logos');
