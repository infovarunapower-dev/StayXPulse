-- ═══════════════════════════════════════════════════════════════════════════
--  StayXPulse — cached Russian menu translations
--
--  Run in the Supabase SQL Editor. Idempotent.
--
--  Item names / descriptions / categories are hotel-entered free text (English).
--  When a guest views the menu in Russian, the backend translates each item ONCE
--  with Claude and stores it here, so every later view is instant and free.
--  Cleared automatically when the hotel edits the item (see food PUT).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE food_items ADD COLUMN IF NOT EXISTS name_ru        TEXT;
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE food_items ADD COLUMN IF NOT EXISTS category_ru    TEXT;

NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'food_items' AND column_name LIKE '%_ru';
