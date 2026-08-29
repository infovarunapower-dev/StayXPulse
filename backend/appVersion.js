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
  version:     '2.3',
  versionCode: 14,
  releasedAt:  '2026-08-26T18:30:00Z',
  notes: [
    'The app now opens straight to your dashboard — you stay logged in every time you reopen it',
    'Your session is saved securely on the device and no longer depends on the network at startup',
  ],
};
