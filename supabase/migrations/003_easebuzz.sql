-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — Easebuzz payment gateway
--
--  Run in the Supabase SQL Editor. Idempotent.
--
--  Razorpay is replaced by Easebuzz. The old razorpay_orders table is left in
--  place untouched so historical records stay readable; nothing writes to it
--  any more.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Gateway-agnostic order table ────────────────────────────────────────
-- One row per checkout ATTEMPT. `txnid` is ours, generated per attempt, and is
-- what Easebuzz echoes back — it is the join key for the callback, the webhook
-- and manual reconciliation.
CREATE TABLE IF NOT EXISTS payment_orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id           UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES plans(id),
  cycle              TEXT NOT NULL CHECK (cycle IN ('monthly','quarterly','yearly')),
  amount             INTEGER NOT NULL CHECK (amount >= 0),   -- INR
  txnid              TEXT NOT NULL UNIQUE,                   -- our reference
  gateway            TEXT NOT NULL DEFAULT 'easebuzz',
  gateway_payment_id TEXT,                                   -- Easebuzz easepayid
  status             TEXT NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created','paid','failed')),
  valid_from         TIMESTAMPTZ,
  valid_to           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_hotel   ON payment_orders (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_txnid   ON payment_orders (txnid);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status  ON payment_orders (status);

-- The backend uses the service-role key and bypasses RLS; enabling it with no
-- policies keeps the anon/PostgREST path shut, matching every other table.
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_orders FROM anon, authenticated;


-- ── 2. Record which gateway took the money ─────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'easebuzz';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS txnid   TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_txnid ON payments (txnid);

-- Existing rows predate Easebuzz.
UPDATE payments SET gateway = 'razorpay'
 WHERE gateway IS NULL OR (payment_id LIKE 'pay\_%' AND gateway = 'easebuzz');
UPDATE payments SET gateway = 'test'
 WHERE payment_id LIKE 'TEST-%';


-- ── 3. Verify ──────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name = 'payment_orders')                                        AS payment_orders_exists,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'payments' AND column_name = 'gateway')                  AS payments_has_gateway,
  (SELECT COUNT(*) FROM payments WHERE gateway = 'test')                         AS simulated_payments,
  (SELECT COUNT(*) FROM payments)                                                AS total_payments;


-- ── 4. OPTIONAL: delete the simulated test payments ────────────────────────
-- The old /test-pay endpoint (now removed) inserted real rows with a TEST-
-- prefixed payment_id. They count as revenue in the superadmin totals and
-- would appear in the GST register. Uncomment to clear them:
--
-- DELETE FROM payments WHERE payment_id LIKE 'TEST-%';
