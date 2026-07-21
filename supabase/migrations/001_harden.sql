-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — hardening migration (health check, July 2026)
--
--  Run this ONCE in the Supabase SQL Editor against the live project.
--  It is idempotent: re-running it is safe.
--
--  Nothing here changes application behaviour. The Express backend connects
--  with the service-role key, which bypasses RLS entirely, so enabling RLS
--  below locks out the anon/public path WITHOUT touching the app.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Row Level Security ──────────────────────────────────────────────────
-- schema.sql explicitly DISABLEs RLS on every table. Supabase always exposes
-- PostgREST at https://<project>.supabase.co/rest/v1, so with RLS off, anyone
-- holding the anon key could read `users` (including password_hash and
-- reset_password_token) and flip any hotel to subscription_status='active'.
--
-- There is no Supabase client in the frontend today, so the key is not
-- currently exposed — this closes the hole before it can ever be opened.
-- We enable RLS and deliberately create NO policies: default-deny for anon,
-- full access for the service role.

ALTER TABLE hotels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Belt and braces: revoke the table grants PostgREST relies on.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- ── 2. Storage policies ────────────────────────────────────────────────────
-- storage.sql granted INSERT and DELETE on the hotel-logos bucket to everyone
-- with no owner check, so anybody could upload arbitrary files to a public
-- bucket (free CDN hosting) or delete every hotel's logo.
-- Uploads go through the backend service key, so no policy is needed for
-- writes at all — only public read.

DROP POLICY IF EXISTS "Allow logo upload"       ON storage.objects;
DROP POLICY IF EXISTS "Allow logo delete"       ON storage.objects;
DROP POLICY IF EXISTS "Public read hotel logos" ON storage.objects;

CREATE POLICY "Public read hotel logos"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('hotel-logos', 'food-images'));


-- ── 3. Indexes on the hot paths ────────────────────────────────────────────
-- food_orders.room_id / service_requests.room_id had NO index, yet the guest
-- "My Orders" tab polls by room_id every 20s for every open QR page — the
-- highest-frequency scan in the system. The admin lists poll every 5s
-- filtered by hotel_id + created_at + status.

CREATE INDEX IF NOT EXISTS idx_food_orders_room            ON food_orders      (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_room       ON service_requests (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_orders_hotel_created   ON food_orders      (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_hotel_created ON service_requests (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_orders_hotel_status    ON food_orders      (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_service_requests_hotel_status ON service_requests (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_users_hotel                 ON users            (hotel_id);
CREATE INDEX IF NOT EXISTS idx_rzp_orders_hotel            ON razorpay_orders  (hotel_id);
CREATE INDEX IF NOT EXISTS idx_rzp_orders_order_id         ON razorpay_orders  (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_hotel_created      ON payments         (hotel_id, created_at DESC);


-- ── 4. Data-integrity constraints ──────────────────────────────────────────
-- Nothing stopped a negative price, which (combined with the client-trusted
-- order pricing that is now fixed in the API) could drive revenue negative.
-- Added NOT VALID so the migration cannot fail on pre-existing rows; validate
-- separately once you've confirmed the data is clean.

ALTER TABLE food_items  DROP CONSTRAINT IF EXISTS chk_food_items_price_nonneg;
ALTER TABLE food_items  ADD  CONSTRAINT chk_food_items_price_nonneg  CHECK (price >= 0) NOT VALID;

ALTER TABLE plans       DROP CONSTRAINT IF EXISTS chk_plans_price_nonneg;
ALTER TABLE plans       ADD  CONSTRAINT chk_plans_price_nonneg       CHECK (price >= 0) NOT VALID;

ALTER TABLE food_orders DROP CONSTRAINT IF EXISTS chk_food_orders_total_nonneg;
ALTER TABLE food_orders ADD  CONSTRAINT chk_food_orders_total_nonneg CHECK (total_amount >= 0) NOT VALID;

ALTER TABLE payments    DROP CONSTRAINT IF EXISTS chk_payments_amount_nonneg;
ALTER TABLE payments    ADD  CONSTRAINT chk_payments_amount_nonneg   CHECK (amount >= 0) NOT VALID;

-- After confirming no existing row violates these:
--   ALTER TABLE food_items  VALIDATE CONSTRAINT chk_food_items_price_nonneg;
--   ALTER TABLE plans       VALIDATE CONSTRAINT chk_plans_price_nonneg;
--   ALTER TABLE food_orders VALIDATE CONSTRAINT chk_food_orders_total_nonneg;
--   ALTER TABLE payments    VALIDATE CONSTRAINT chk_payments_amount_nonneg;


-- ── 5. Plan deletion ───────────────────────────────────────────────────────
-- hotels.current_plan_id has no ON DELETE clause, so once any hotel has bought
-- a plan the superadmin's Delete button can only ever fail. SET NULL lets the
-- plan go while leaving the hotel's subscription dates intact.
-- (payments.plan_id is deliberately left restrictive — financial records must
-- keep pointing at the plan that was sold.)

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_current_plan_id_fkey;
ALTER TABLE hotels ADD  CONSTRAINT hotels_current_plan_id_fkey
  FOREIGN KEY (current_plan_id) REFERENCES plans(id) ON DELETE SET NULL;


-- ── 6. Verify ──────────────────────────────────────────────────────────────
-- Expect: rls_enabled = true for all 9 rows.
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('hotels','users','plans','payments','razorpay_orders',
                    'rooms','food_items','food_orders','service_requests')
ORDER BY tablename;
