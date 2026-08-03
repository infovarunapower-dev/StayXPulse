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
  version:     '1.5',
  versionCode: 6,
  releasedAt:  '2026-08-03T21:10:00Z',
  notes: [
    'Redesigned Service Requests & Food Orders for phones — tap-friendly cards, no more sideways scrolling to update status',
  ],
};
