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
  version:     '3.6',
  versionCode: 27,
  releasedAt:  '2026-11-18T00:00:00Z',
  notes: [
    'Back button now goes back instead of closing the app',
    'Cleaner header on mobile',
    'Analytics now show real order data',
    'Food Orders: export to CSV and improved date filters',
    'Fixed guest food ordering',
  ],
};
