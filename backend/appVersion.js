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
  version:     '1.9',
  versionCode: 10,
  releasedAt:  '2026-08-24T16:30:00Z',
  notes: [
    'Kitchen Hours — food ordering automatically closes outside your serving times',
    'Select multiple menu items and delete them together',
    'Bulk menu upload now reads Veg / Non-Veg correctly from your sheet',
    'Rooms are now limited to your plan',
    'Order history shows Today / Yesterday labels',
  ],
};
