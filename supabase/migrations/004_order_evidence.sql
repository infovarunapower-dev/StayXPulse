-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — checkout evidence for the Order Record (dispute defence)
--
--  Run in the Supabase SQL Editor. Idempotent.
--
--  Captures the consent / IP / user-agent / timing that the Order Record PDF
--  needs to stand up as a dispute-defence document. Existing orders keep NULLs
--  and render as "not recorded"; new checkouts populate them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS customer_ip       TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS user_agent        TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS terms_accepted    BOOLEAN DEFAULT false;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS policy_version    TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS initiated_at      TIMESTAMPTZ;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'payment_orders'
ORDER BY ordinal_position;
