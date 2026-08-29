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
  version:     '2.6',
  versionCode: 17,
  releasedAt:  '2026-08-26T20:30:00Z',
  notes: [
    'Reopening the app no longer bounces you to login while your saved session is being checked',
    'The login screen now shows whether a saved session was found at startup',
  ],
};
