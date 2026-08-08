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
  version:     '1.7',
  versionCode: 8,
  releasedAt:  '2026-08-08T10:15:00Z',
  notes: [
    'High-resolution, print-ready QR code downloads — the logo is now crisp',
    'Service Management: standard services can be renamed and turned on/off',
    'Tap any dashboard stat card to jump straight to its details',
    'Free trial extended to 14 days',
    'Super Admin: editable email content, richer Payment History (drill-down, invoice downloads, filing exports) and the new company invoice design',
  ],
};
