-- ═══════════════════════════════════════════════════════════════════════════
--  022 — per-room WiFi credentials
--
--  Each room can carry its own WiFi name + password, shown to the guest on the
--  room-service landing page. Both optional. Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS wifi_ssid     text,
  ADD COLUMN IF NOT EXISTS wifi_password text;

NOTIFY pgrst, 'reload schema';
