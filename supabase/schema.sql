-- ═══════════════════════════════════════════════════════════════
--  StayXPulse — Supabase PostgreSQL Schema
--  Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── HOTELS ────────────────────────────────────────────────────────────────────
CREATE TABLE hotels (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_name          TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  address             TEXT NOT NULL,
  gst_number          TEXT NOT NULL,
  logo_url            TEXT,
  user_id             TEXT UNIQUE,  -- auto-generated HTL001, HTL002...
  is_active           BOOLEAN DEFAULT true,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','expired','suspended')),
  trial_start_date    TIMESTAMPTZ DEFAULT NOW(),
  trial_end_date      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
  current_plan_id     UUID,
  plan_valid_from     TIMESTAMPTZ,
  plan_valid_to       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  email                   TEXT NOT NULL UNIQUE,
  password_hash           TEXT NOT NULL,
  role                    TEXT DEFAULT 'hoteladmin' CHECK (role IN ('superadmin','hoteladmin')),
  hotel_id                UUID REFERENCES hotels(id) ON DELETE CASCADE,
  is_active               BOOLEAN DEFAULT true,
  reset_password_token    TEXT,
  reset_password_expire   TIMESTAMPTZ,
  last_login              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── PLANS ─────────────────────────────────────────────────────────────────────
CREATE TABLE plans (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  price          INTEGER NOT NULL,  -- monthly price in INR
  duration_days  INTEGER DEFAULT 30,
  max_rooms      INTEGER DEFAULT 20,
  features       TEXT[],            -- array of feature strings
  is_popular     BOOLEAN DEFAULT false,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for hotels.current_plan_id after plans table exists
ALTER TABLE hotels ADD CONSTRAINT fk_hotels_plan
  FOREIGN KEY (current_plan_id) REFERENCES plans(id);

-- ── PAYMENTS ──────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id       UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  plan_id        UUID NOT NULL REFERENCES plans(id),
  amount         INTEGER NOT NULL,   -- in INR
  payment_id     TEXT NOT NULL,      -- Razorpay payment ID
  invoice_number TEXT UNIQUE,
  valid_from     TIMESTAMPTZ NOT NULL,
  valid_to       TIMESTAMPTZ NOT NULL,
  paid_at        TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── RAZORPAY ORDERS ────────────────────────────────────────────────────────────
CREATE TABLE razorpay_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id            UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES plans(id),
  cycle               TEXT NOT NULL CHECK (cycle IN ('monthly','quarterly','yearly')),
  amount              INTEGER NOT NULL,   -- in paise
  amount_display      INTEGER NOT NULL,   -- in INR
  currency            TEXT DEFAULT 'INR',
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  status              TEXT DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  valid_from          TIMESTAMPTZ,
  valid_to            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROOMS ─────────────────────────────────────────────────────────────────────
CREATE TABLE rooms (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id   UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  number     TEXT NOT NULL,
  floor      TEXT DEFAULT '',
  type       TEXT DEFAULT 'Standard' CHECK (type IN ('Standard','Deluxe','Suite','Executive Suite','Villa')),
  is_active  BOOLEAN DEFAULT true,
  qr_token   TEXT UNIQUE DEFAULT uuid_generate_v4()::TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, number)
);

-- ── FOOD ITEMS ────────────────────────────────────────────────────────────────
CREATE TABLE food_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  price        INTEGER NOT NULL,  -- in INR
  category     TEXT NOT NULL,
  is_veg       BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  image_emoji  TEXT DEFAULT '🍽',
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── FOOD ORDERS ───────────────────────────────────────────────────────────────
CREATE TABLE food_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_number  TEXT NOT NULL,
  items        JSONB NOT NULL DEFAULT '[]',  -- [{foodItemId, name, price, quantity}]
  total_amount INTEGER NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','delivered','cancelled')),
  guest_note   TEXT DEFAULT '',
  order_ref    TEXT UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SERVICE REQUESTS ──────────────────────────────────────────────────────────
CREATE TABLE service_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id     UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_number  TEXT NOT NULL,
  type         TEXT NOT NULL,
  note         TEXT DEFAULT '',
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','in-progress','completed','cancelled')),
  request_ref  TEXT UNIQUE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hotels_updated_at        BEFORE UPDATE ON hotels        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_food_items_updated_at    BEFORE UPDATE ON food_items    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_food_orders_updated_at   BEFORE UPDATE ON food_orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_service_requests_updated BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count FROM payments;
  NEW.invoice_number := 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD((count + 1)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Auto-generate order ref
CREATE OR REPLACE FUNCTION generate_order_ref()
RETURNS TRIGGER AS $$
DECLARE count INTEGER; uid TEXT;
BEGIN
  SELECT COUNT(*) INTO count FROM food_orders WHERE hotel_id = NEW.hotel_id;
  uid := UPPER(SUBSTRING(uuid_generate_v4()::TEXT, 1, 6));
  NEW.order_ref := 'FO-' || LPAD((count + 1)::TEXT, 4, '0') || '-' || uid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_ref BEFORE INSERT ON food_orders FOR EACH ROW EXECUTE FUNCTION generate_order_ref();

-- Auto-generate service request ref
CREATE OR REPLACE FUNCTION generate_request_ref()
RETURNS TRIGGER AS $$
DECLARE count INTEGER; uid TEXT;
BEGIN
  SELECT COUNT(*) INTO count FROM service_requests WHERE hotel_id = NEW.hotel_id;
  uid := UPPER(SUBSTRING(uuid_generate_v4()::TEXT, 1, 6));
  NEW.request_ref := 'SR-' || LPAD((count + 1)::TEXT, 4, '0') || '-' || uid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_request_ref BEFORE INSERT ON service_requests FOR EACH ROW EXECUTE FUNCTION generate_request_ref();

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════
-- The backend authenticates with its own JWT and connects using the SERVICE
-- ROLE key, which bypasses RLS — so RLS is enabled here with NO policies:
-- default-deny for anon/authenticated, unrestricted for the backend.
--
-- Do NOT disable this. Supabase publishes PostgREST at
-- https://<project>.supabase.co/rest/v1 whether you use it or not; with RLS
-- off, anyone holding the (public-by-design) anon key can read `users`
-- including password_hash, and set any hotel's subscription to active.
ALTER TABLE hotels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Default Plans + Super Admin
-- ═══════════════════════════════════════════════════════════════
INSERT INTO plans (name, price, duration_days, max_rooms, features, is_popular) VALUES
  ('Starter',      999,  30, 20,     ARRAY['Up to 20 rooms','QR Management','Food Menu','Email Support'], false),
  ('Professional', 2499, 30, 100,    ARRAY['Up to 100 rooms','QR Management','Food Menu + Bulk Upload','Full Analytics','Priority Support'], true),
  ('Enterprise',   4999, 30, 999999, ARRAY['Unlimited rooms','All features','Dedicated Support','Custom Integrations'], false);

-- Super admin will be seeded by backend on first run
-- ═══════════════════════════════════════════════════════════════
--  INDEXES for performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_hotels_email         ON hotels(email);
CREATE INDEX idx_hotels_user_id       ON hotels(user_id);
CREATE INDEX idx_rooms_hotel_id       ON rooms(hotel_id);
CREATE INDEX idx_rooms_qr_token       ON rooms(qr_token);
CREATE INDEX idx_food_items_hotel_id  ON food_items(hotel_id);
CREATE INDEX idx_food_orders_hotel_id ON food_orders(hotel_id);
CREATE INDEX idx_food_orders_status   ON food_orders(status);
CREATE INDEX idx_service_hotel_id     ON service_requests(hotel_id);
CREATE INDEX idx_service_status       ON service_requests(status);
CREATE INDEX idx_payments_hotel_id    ON payments(hotel_id);
