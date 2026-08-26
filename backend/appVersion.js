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
  version:     '2.0',
  versionCode: 11,
  releasedAt:  '2026-08-26T15:30:00Z',
  notes: [
    'Kitchen Hours now supports multiple serving windows — set breakfast, lunch and dinner separately',
    'Guests see all your serving windows when the kitchen is closed',
  ],
};
