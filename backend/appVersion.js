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
  version:     '3.5',
  versionCode: 26,
  releasedAt:  '2026-10-12T00:00:00Z',
  notes: [
    'Per-room WiFi: set it on a room and guests see it on their page; simpler 1-page signup',
  ],
};
