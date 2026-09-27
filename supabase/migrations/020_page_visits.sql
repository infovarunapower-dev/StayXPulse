-- ═══════════════════════════════════════════════════════════════════════════
--  020 — page_visits : lightweight first-party website visitor tracking
--
--  The frontend logs each web page view (once per session per path) to this
--  table; the Super Admin dashboard shows the totals. First-party (our own DB)
--  so it isn't capped by Vercel's free tier and the data stays ours.
--
--  Includes analytics_summary() — one RPC the backend calls to get all the
--  headline numbers in a single round-trip. "Today" is IST (Asia/Kolkata).
--
--  Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS page_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path        text,
  visitor_id  text,          -- random id from the browser (localStorage) → uniques
  referrer    text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_visitor ON page_visits (visitor_id);

ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY; -- backend uses service role

-- All headline numbers in one call.
CREATE OR REPLACE FUNCTION analytics_summary()
RETURNS json LANGUAGE sql STABLE AS $$
  WITH today_start AS (
    SELECT (date_trunc('day', (now() AT TIME ZONE 'Asia/Kolkata')) AT TIME ZONE 'Asia/Kolkata') AS ts
  )
  SELECT json_build_object(
    'total',        (SELECT count(*)                 FROM page_visits),
    'unique',       (SELECT count(DISTINCT visitor_id) FROM page_visits),
    'today',        (SELECT count(*)                 FROM page_visits, today_start WHERE created_at >= today_start.ts),
    'todayUnique',  (SELECT count(DISTINCT visitor_id) FROM page_visits, today_start WHERE created_at >= today_start.ts),
    'last7',        (SELECT count(*)                 FROM page_visits WHERE created_at >= now() - interval '7 days'),
    'last7Unique',  (SELECT count(DISTINCT visitor_id) FROM page_visits WHERE created_at >= now() - interval '7 days'),
    'topPaths',     (SELECT coalesce(json_agg(t), '[]'::json) FROM (
                       SELECT path, count(*) AS visits
                       FROM page_visits GROUP BY path ORDER BY count(*) DESC LIMIT 6
                     ) t)
  );
$$;

NOTIFY pgrst, 'reload schema';
