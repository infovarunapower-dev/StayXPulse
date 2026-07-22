-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — payment-path hardening
--
--  RUN THIS BEFORE TAKING ANY PAYMENT, TEST OR LIVE.
--  Idempotent: safe to re-run.
--
--  Every problem below fails AFTER Razorpay has captured the money, which is
--  the worst possible moment: the customer is charged and gets nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. The column /verify writes but the schema never defined ──────────────
-- routes/payment.js inserts razorpay_order_id into payments. If the column is
-- missing, PostgREST rejects the insert (PGRST204) after capture.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_rzp_order ON payments (razorpay_order_id);


-- ── 2. One payment can only ever be recorded once ──────────────────────────
-- The browser callback and the webhook race each other by design, and a
-- double-clicked verify used to insert two rows: charged once, subscription
-- extended twice. This constraint is the final backstop behind the application
-- level idempotency checks.
--
-- If this fails, you already have duplicates. Find them with:
--   SELECT payment_id, COUNT(*) FROM payments GROUP BY payment_id HAVING COUNT(*) > 1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_id_key'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_payment_id_key UNIQUE (payment_id);
  END IF;
END $$;


-- ── 3. Invoice numbers from a sequence, not COUNT(*) ───────────────────────
-- The old trigger did:  SELECT COUNT(*) INTO count FROM payments;
-- which (a) races — two concurrent payments compute the same number and the
-- second violates the UNIQUE constraint after capture, (b) reuses a burnt
-- serial whenever a row is deleted, wedging inserts permanently, and
-- (c) never resets per financial year.
--
-- It also overwrote the number the application had already put on the emailed
-- PDF, so the customer's invoice serial did not match the database. The app now
-- reads the number back off the inserted row; this makes that number sane.

CREATE SEQUENCE IF NOT EXISTS payments_invoice_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Respect an explicitly supplied number (e.g. data migration/backfill).
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-'
      || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY')
      || '-'
      || LPAD(nextval('payments_invoice_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure the trigger points at the function above whatever it was called.
DROP TRIGGER IF EXISTS set_invoice_number ON payments;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- Start the sequence past any existing invoice so we cannot collide with
-- numbers already issued to customers.
SELECT setval('payments_invoice_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^INV-\d{4}-', ''), '')::bigint), 0)
       FROM payments WHERE invoice_number ~ '^INV-\d{4}-\d+$'),
    (SELECT COUNT(*) FROM payments)
  )
);


-- ── 4. Verify ──────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name='payments' AND column_name='razorpay_order_id')            AS has_rzp_order_col,
  (SELECT COUNT(*) FROM pg_constraint WHERE conname='payments_payment_id_key')   AS has_payment_id_unique,
  (SELECT last_value FROM payments_invoice_seq)                                  AS invoice_seq_at,
  (SELECT COUNT(*) FROM payments)                                                AS existing_payments;
