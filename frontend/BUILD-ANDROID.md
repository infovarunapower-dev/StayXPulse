# StayXPulse — Android App (Capacitor)

The Android app is the **same React codebase** as the web app, wrapped natively with
[Capacitor](https://capacitorjs.com). Both talk to the **same backend (Express + Supabase)**,
so they share user IDs and data in real time — a request created on web shows up in the
Android app on the next auto-refresh, and vice-versa.

> **One codebase → change a feature once, and it updates web *and* Android.**

---

## What's already set up
- Capacitor installed (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android` v6)
- `capacitor.config.json` — app id `com.stayxpulse.app`, name **StayXPulse**, `webDir: build`
- Native project generated at `frontend/android/`
- API base URL made configurable via `REACT_APP_API_URL` (see `src/config.js`)

## Prerequisites (on your machine)
1. **Node 18+** and **JDK 17** (already used by this repo)
2. **[Android Studio](https://developer.android.com/studio)** — bundles the Android SDK,
   Gradle, and an emulator. *(The APK is built here; the SDK is not needed for the steps above.)*

---

## Build & run the app

### 1. Point the app at your deployed backend
Create `frontend/.env` (copy from `.env.example`) and set your live API host:
```
REACT_APP_API_URL=https://your-stayxpulse-domain.vercel.app
REACT_APP_CLIENT_URL=https://your-stayxpulse-domain.vercel.app
```
> This is essential: the packaged app has no same-origin server, so it must call the
> deployed API by absolute URL. The backend already sends open CORS, so it accepts the app.

### 2. Build the web, sync into Android, and open Android Studio
From `frontend/`:
```
npm run android:open
```
(That runs `react-scripts build` → `npx cap sync android` → `npx cap open android`.)

### 3. In Android Studio
- Let **Gradle sync** finish.
- Press **Run ▶** to launch on an emulator or a connected phone (enable USB debugging), **or**
- **Build → Build Bundle(s)/APK(s) → Build APK(s)** for an installable `.apk`, or
- **Build → Generate Signed Bundle/APK** for a Play Store release (`.aab`).

---

## Day-to-day workflow (feature parity)
1. Edit the React app once (in `src/`).
2. **Web:** deploy as usual (push → Vercel).
3. **Android:** from `frontend/` run `npm run android:prepare` (build + sync), then rebuild in Android Studio.

Same code, same backend — no feature is written twice.

Handy scripts (in `frontend/package.json`):
| Script | Does |
|---|---|
| `npm run android:prepare` | build web + `cap sync` (refresh the Android project) |
| `npm run android:open` | build + sync + open Android Studio |
| `npm run cap:sync` | just sync current `build/` into Android |
| `npm run cap:open` | just open the Android project |

---

## How data stays in sync across web + Android
- Both clients call the **same** endpoints (`/api/...`) on the **same** Supabase-backed backend.
- Auth: the JWT is stored in the webview's `localStorage`, exactly like web — same login, same user ID.
- Live updates today use **polling**: staff Orders/Requests refresh every 30s; the guest
  order tracker every 20s. So cross-device changes appear within seconds.

### Optional upgrade — instant realtime
For *instant* sync (no wait for the poll), add **Supabase Realtime** subscriptions on the
`food_orders` and `service_requests` tables (or send **FCM** push on new orders). This is an
enhancement, not required — polling already satisfies "shows in both."

---

## Notes
- **Guest QR flow:** guests scan a printed room QR that opens the web guest page
  (`REACT_APP_CLIENT_URL/guest/{qrToken}`) in their phone browser — no install needed. The
  native app targets hotel-admin and super-admin staff.
- **Payments:** the web Razorpay checkout runs inside the Android webview. For a more native
  feel later, swap to the `@capacitor-community/razorpay` plugin.
- **App icon / splash:** customize with `@capacitor/assets` (drop a 1024×1024 icon and run the
  generator), then `npx cap sync`.
- **App id / name:** change in `capacitor.config.json` and `android/app/src/main/res/values/strings.xml`.
