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
  version:     '2.1',
  versionCode: 12,
  releasedAt:  '2026-08-26T16:30:00Z',
  notes: [
    'Stay signed in — the app no longer logs you out when you minimise or reopen it',
    'Longer login sessions so you are not asked to sign in every week',
  ],
};
