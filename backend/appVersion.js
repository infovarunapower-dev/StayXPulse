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
  version:     '1.6',
  versionCode: 7,
  releasedAt:  '2026-08-04T05:30:00Z',
  notes: [
    'Cab Request now offers Pickup & Drop (from/to) or Sightseeing, with a pickup time',
    'Service Requests show the scheduled time and details together',
  ],
};
