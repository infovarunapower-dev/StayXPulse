// ─────────────────────────────────────────────────────────────────────────────
//  CURRENT released Android app — single source of truth.
//
//  Bump this every time the APK is rebuilt (keep it in sync with
//  android/app/build.gradle's versionCode/versionName). The
//  /superadmin/app-versions endpoint auto-adds this entry to the version
//  history, so a new release shows up on the "Android APK" page on its own —
//  no one has to click "Add version".
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  version:     '2.2',
  versionCode: 13,
  releasedAt:  '2026-08-26T17:30:00Z',
  notes: [
    'Really fixed the sign-out issue — closing or reopening the app keeps you logged in',
    'A brief network glitch on startup no longer signs you out',
  ],
};
