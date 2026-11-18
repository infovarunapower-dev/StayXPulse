// ─────────────────────────────────────────────────────────────────────────────
//  PostgREST (Supabase) caps a single response at ~1000 rows. Whenever we need
//  to aggregate across ALL matching rows — a revenue SUM, a per-hotel room
//  COUNT, a full GST export — reading one page silently drops everything past
//  row 1000 and under-reports with no error. fetchAll() pages through the whole
//  result set in 1000-row windows and returns every row.
//
//  `buildQuery` MUST return a FRESH Supabase query each call (so .range() starts
//  clean), and that query should carry a stable .order() on a unique column
//  (e.g. id) so paging is deterministic and never skips/duplicates a row.
//
//    const rows = await fetchAll(() =>
//      supabase.from('payments').select('amount').order('id', { ascending: true }));
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAll(buildQuery, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) return out;   // last (partial) page reached
  }
}

module.exports = { fetchAll };
