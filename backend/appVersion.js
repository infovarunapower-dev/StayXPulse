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
  version:     '3.7',
  versionCode: 28,
  releasedAt:  '2026-11-18T00:00:00Z',
  notes: [
    'More accurate revenue and analytics totals',
    'Correct Today / daily figures (IST)',
    'Monthly revenue chart on the admin dashboard',
    'Security and stability updates',
  ],
};
