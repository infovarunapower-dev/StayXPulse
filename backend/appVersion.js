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
  version:     '2.4',
  versionCode: 15,
  releasedAt:  '2026-08-26T19:30:00Z',
  notes: [
    'The app version now shows on the login screen and sidebar, so you always know which build you are on',
    'Stay signed in — opening the app takes you straight to your dashboard',
  ],
};
