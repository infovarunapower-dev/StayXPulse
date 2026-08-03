-- ═══════════════════════════════════════════════════════════════════════════
--  010 — Android APK version history
--
--  Powers the Super Admin "Android APK" page: a changelog of released app
--  versions with their "what's new" notes, and a per-version "notify hotels"
--  action. Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL UNIQUE,
  version_code integer,
  notes        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- array of "what's new" strings
  released_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed the versions released so far.
INSERT INTO app_versions (version, version_code, notes, released_at) VALUES
  ('1.0', 1, '["Initial Android app release","Room QR ordering, food menu and service requests"]'::jsonb, '2026-07-30T14:00:00Z'),
  ('1.1', 2, '["Fixed the dashboard showing zeros","Wake-up call time picker","Cab request option"]'::jsonb, '2026-07-30T21:00:00Z'),
  ('1.2', 3, '["Wake-up call reminders with a dedicated alarm sound","Per-room activity view with clear-guest-view","Cab request option"]'::jsonb, '2026-08-02T21:30:00Z')
ON CONFLICT (version) DO NOTHING;
