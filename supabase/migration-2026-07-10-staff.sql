-- ═══════════════════════════════════════════════════════════════
--  Staff (labour) app — run this in Supabase SQL Editor
--  Adds hotel staff accounts and task assignment on service requests.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS staff (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,                  -- bcrypt hash of the 4-digit PIN
  department TEXT DEFAULT 'Housekeeping',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, phone)
);

ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_hotel_id    ON staff(hotel_id);
CREATE INDEX IF NOT EXISTS idx_service_assigned  ON service_requests(assigned_to);
