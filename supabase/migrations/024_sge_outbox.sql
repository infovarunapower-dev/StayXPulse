-- ═══════════════════════════════════════════════════════════════════════════
--  024 — Sunver Growth Engine event outbox (Requirement 3)
--
--  Every engine event is written here first (idempotent on event_id), then a
--  drainer POSTs it to the engine webhook with retry/backoff. Nothing is sent
--  until SGE_WEBHOOK_URL + SGE_WEBHOOK_SECRET are configured.
--
--  status: pending → sent, or dead (4xx payload/signature error = stop retrying).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sge_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text NOT NULL UNIQUE,          -- sxp:<type>:<ref> idempotency key
  type            text NOT NULL,
  payload         jsonb NOT NULL,                -- the exact body to sign + send
  status          text NOT NULL DEFAULT 'pending',
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sge_outbox_due
  ON sge_outbox (next_attempt_at) WHERE status = 'pending';

ALTER TABLE sge_outbox ENABLE ROW LEVEL SECURITY; -- backend service-role only

NOTIFY pgrst, 'reload schema';
