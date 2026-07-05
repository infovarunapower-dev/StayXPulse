// ─────────────────────────────────────────────────────────────────────────────
// API origin configuration
//
// WEB (Vercel):     REACT_APP_API_URL is unset  → API_ORIGIN = ''  → calls hit
//                   same-origin '/api' (proxied to the backend). No change needed.
//
// ANDROID (native): the app bundles the built web assets and has no same-origin
//                   server, so it must call the DEPLOYED backend by absolute URL.
//                   Set REACT_APP_API_URL to your API host before building, e.g.
//                     REACT_APP_API_URL=https://stayxpulse.vercel.app
//                   Then API calls go to https://stayxpulse.vercel.app/api.
//
// Both platforms share ONE backend (Express + Supabase) → same user IDs, same
// data, in real time. A request created on web appears in the Android app (and
// vice-versa) on the next auto-refresh.
// ─────────────────────────────────────────────────────────────────────────────
export const API_ORIGIN = process.env.REACT_APP_API_URL || '';
export const API_BASE   = `${API_ORIGIN}/api`;
