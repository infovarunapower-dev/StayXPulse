// ─────────────────────────────────────────────────────────────────────────────
//  Sunver Growth Engine attribution capture (Requirement 2).
//  On any page load, read the tracking tags from the URL and keep them for the
//  session so they survive the journey to the register page. The visitor id
//  (sge_aid) is captured once and never overwritten.
// ─────────────────────────────────────────────────────────────────────────────
const KEY = 'sxp-sge-attr';
const AID = 'sxp-sge-aid';

// Tags we carry through. sge_src/src/utm_source all mean "where from".
const PARAMS = [
  'sge_aid', 'sge_ref', 'sge_src', 'src', 'sge_gclid', 'gclid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'campaign',
];

export function readAttribution() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

export function captureAttribution() {
  try {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const incoming = {};
    PARAMS.forEach(k => { const v = sp.get(k); if (v) incoming[k] = String(v).slice(0, 200); });
    if (!Object.keys(incoming).length && sessionStorage.getItem(KEY)) return; // nothing new

    const stored = readAttribution();
    const merged = { ...stored, ...incoming };
    // Never overwrite the first-seen visitor id.
    if (stored.sge_aid) merged.sge_aid = stored.sge_aid;
    sessionStorage.setItem(KEY, JSON.stringify(merged));
    if (merged.sge_aid) { try { localStorage.setItem(AID, merged.sge_aid); } catch (_) {} }
  } catch (_) { /* private mode / no storage — attribution is best-effort */ }
}

export function getSgeAid() {
  const a = readAttribution();
  if (a.sge_aid) return a.sge_aid;
  try { return localStorage.getItem(AID) || null; } catch { return null; }
}
