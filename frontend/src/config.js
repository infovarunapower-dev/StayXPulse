// ─────────────────────────────────────────────────────────────────────────────
// API origin configuration
//
// WEB (Vercel):     REACT_APP_API_URL is unset  → API_ORIGIN = ''  → calls hit
//                   same-origin '/api' (proxied to the backend). No change needed.
//
// ANDROID (native): the app bundles the built web assets and has no same-origin
//                   server, so it must call the DEPLOYED backend by absolute URL.
//                   This is the LIVE production API host. NOTE: use the custom
//                   domain — the raw *.vercel.app host does NOT serve /api (404).
//                   Override at build time with REACT_APP_API_URL if the host
//                   ever changes.
//
// Both platforms share ONE backend (Express + Supabase) → same user IDs, same
// data, in real time. A request created on web appears in the Android app (and
// vice-versa) on the next auto-refresh.
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';

// The deployed backend used by the native app when no build-time override is set.
const NATIVE_API_ORIGIN = 'https://stayxpulse.sunver.in';

// Web (Vercel) → '' (same-origin /api). Native (Android/iOS) → absolute host, so
// a missing REACT_APP_API_URL at build time can never silently break the APK.
export const API_ORIGIN =
  process.env.REACT_APP_API_URL ||
  (Capacitor.isNativePlatform() ? NATIVE_API_ORIGIN : '');
export const API_BASE   = `${API_ORIGIN}/api`;
