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
  version:     '1.8',
  versionCode: 9,
  releasedAt:  '2026-08-09T11:30:00Z',
  notes: [
    'Billing details at checkout — enter name, address and contact before paying; it appears on your invoice',
    'Bigger hotel logo on the printable QR code',
    'Company name added under the QR footer',
  ],
};
