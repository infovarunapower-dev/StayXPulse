-- ═══════════════════════════════════════════════════════════════════════════
--  018 — device_tokens : Android push (FCM) device registry
--
--  One row per physical device that a hotel admin has logged in on and granted
--  notification permission. The backend sends an FCM push to every ACTIVE token
--  belonging to a hotel whenever a new food order / service request is created,
--  so the phone rings even when the StayXPulse app is fully closed.
--
--  FCM is used ONLY as the Android push transport — auth/data stay in Supabase.
--
--  After running: NOTIFY pgrst so PostgREST reloads its schema cache.
--  Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS device_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id)  ON DELETE CASCADE,
  hotel_id    uuid REFERENCES hotels(id) ON DELETE CASCADE,
  platform    text NOT NULL DEFAULT 'android',
  token       text NOT NULL UNIQUE,          -- the FCM registration token (one per device install)
  is_active   boolean NOT NULL DEFAULT true, -- flipped false on logout or when FCM reports it dead
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- The hot path: "give me every live token for this hotel" (send fan-out).
CREATE INDEX IF NOT EXISTS idx_device_tokens_hotel_active
  ON device_tokens (hotel_id) WHERE is_active;

-- RLS on, no policies: the backend uses the service-role key and bypasses RLS.
-- Guests/clients never touch this table directly, so a locked-down default is
-- the safe posture (matches the rest of the schema).
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
