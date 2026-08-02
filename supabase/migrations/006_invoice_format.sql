-- ═══════════════════════════════════════════════════════════════════════════
--  006 — Invoice number format
--
--  Changes the auto-generated invoice serial from  INV-2026-0001
--  to the new house format                          SXP2026001
--    = 'SXP' + 4-digit year (IST) + 3-digit zero-padded running counter.
--
--  Only the trigger FUNCTION changes; the shared sequence keeps counting, so
--  numbers stay unique and never collide with invoices already issued to
--  customers. An explicitly supplied invoice_number (backfill/migration) is
--  still respected.
--
--  Idempotent: CREATE OR REPLACE. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'SXP'
      || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY')
      || LPAD(nextval('payments_invoice_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already points at this function (from 002); nothing else to do.

-- ── Optional clean-start reset ──────────────────────────────────────────────
-- Run this ONLY after clearing test payments, to make the first real invoice
-- SXP<year>001. Leave commented during testing so we don't reuse a live serial.
--
--   SELECT setval('payments_invoice_seq', 1, false);

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT
  'SXP'
    || to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY')
    || LPAD((last_value + 1)::text, 3, '0') AS next_invoice_number_preview
FROM payments_invoice_seq;
