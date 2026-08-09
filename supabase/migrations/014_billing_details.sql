-- ═══════════════════════════════════════════════════════════════════════════
--  014 — Billing details captured at checkout
--
--  Before paying, the hotel fills a billing form (name, address, contact). We
--  keep it on the payment_orders row so it appears on the tax invoice and gives
--  the payment gateway the payer's real contact details. All nullable; the app
--  requires the important ones at submit time. Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS billing_name     text,
  ADD COLUMN IF NOT EXISTS billing_company  text,
  ADD COLUMN IF NOT EXISTS billing_email    text,
  ADD COLUMN IF NOT EXISTS billing_phone    text,
  ADD COLUMN IF NOT EXISTS billing_country  text,
  ADD COLUMN IF NOT EXISTS billing_address1 text,
  ADD COLUMN IF NOT EXISTS billing_address2 text,
  ADD COLUMN IF NOT EXISTS billing_city     text,
  ADD COLUMN IF NOT EXISTS billing_state    text,
  ADD COLUMN IF NOT EXISTS billing_pincode  text,
  ADD COLUMN IF NOT EXISTS order_notes      text;

NOTIFY pgrst, 'reload schema';
