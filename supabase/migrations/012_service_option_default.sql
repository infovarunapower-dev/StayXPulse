-- ═══════════════════════════════════════════════════════════════════════════
--  012 — Mark seeded "standard" service options
--
--  When a hotel first opens Service Management, the built-in standard services
--  are seeded into its service_options with is_default = true, so they can be
--  toggled Available/Not-available and edited (custom extras stay is_default =
--  false). Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE service_options
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
