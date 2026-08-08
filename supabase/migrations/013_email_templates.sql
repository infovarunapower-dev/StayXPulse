-- ═══════════════════════════════════════════════════════════════════════════
--  013 — Editable email content
--
--  Super Admin can override the editable text of each transactional email
--  (subject / heading / intro / notice). A NULL field falls back to the built-in
--  default, so this table only ever holds what was actually customised.
--  Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_templates (
  type       text PRIMARY KEY,   -- welcome | forgot-password | trial-reminder | ...
  subject    text,
  heading    text,
  intro      text,
  notice     text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
