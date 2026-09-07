// ─────────────────────────────────────────────────────────────────────────────
//  Android push bridge (FCM via @capacitor/push-notifications).
//
//  Native-only. On web every function is a safe no-op. This owns:
//   • the HIGH-importance notification channel (sound + vibration + heads-up)
//   • permission + registration, then POSTing the device token to the backend
//   • deep-linking a notification tap to the right screen, incl. COLD START
//
//  Foreground sound is intentionally NOT played here — useNewOrderAlert.js owns
//  the foreground chime, so we stay silent on receipt to avoid a double alert.
//  When the app is backgrounded/closed, Android's system tray shows the push and
//  plays the channel sound with zero JS running (that's the whole point).
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api';

const IS_NATIVE = Capacitor.isNativePlatform();
const CHANNEL_ID = 'stayxpulse_alerts';
const TOKEN_LS = 'sxp-push-token';   // last token we registered (for logout DELETE)

let listenersBound = false;  // guard: bind FCM listeners exactly once per app run
let channelReady = false;
let navigateFn = null;       // set by <PushManager/> once the router is live
let pendingRoute = null;     // a tap that arrived before the router was ready (cold start)

// Map a push's data payload → an in-app route. Backend always sends `route`,
// but we fall back to `type` so a hand-crafted payload still lands correctly.
function routeFromData(data) {
  if (!data) return null;
  if (data.route) return data.route;
  if (data.type === 'food_order') return '/hotel/food-orders';
  if (data.type === 'service_request') return '/hotel/service-requests';
  return null;
}

// Called by <PushManager/> whenever the router's navigate is available. If a tap
// was queued during a cold start, replay it now.
export function setNavigator(fn) {
  navigateFn = fn;
  if (pendingRoute && navigateFn) {
    const r = pendingRoute;
    pendingRoute = null;
    // let the current render settle before navigating
    setTimeout(() => navigateFn(r), 0);
  }
}

function handleTap(action) {
  const route = routeFromData(action && action.notification && action.notification.data);
  if (!route) return;
  if (navigateFn) navigateFn(route);
  else pendingRoute = route;   // router not ready yet → replay on setNavigator
}

async function ensureChannel() {
  if (channelReady) return;
  try {
    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'StayXPulse Alerts',
      description: 'New food orders and service requests',
      importance: 5,   // MAX/HIGH → heads-up banner
      visibility: 1,   // public on lock screen
      sound: 'default',
      vibration: true,
      lights: true,
    });
    channelReady = true;
  } catch (e) {
    // createChannel is Android-only; ignore elsewhere.
  }
}

async function bindListenersOnce() {
  if (listenersBound) return;
  listenersBound = true;

  PushNotifications.addListener('registration', async (token) => {
    try {
      localStorage.setItem(TOKEN_LS, token.value);
      await api.post('/hotel/push-token', { token: token.value, platform: 'android' });
      console.log('[push] device token registered with backend');
    } catch (e) {
      console.warn('[push] token POST failed:', e && e.message);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error:', err && err.error);
  });

  // Foreground receipt: stay silent — useNewOrderAlert handles the open-app
  // chime/toast. (Android does not raise a tray notification while the app is
  // in the foreground, so there is no duplicate to suppress here.)
  PushNotifications.addListener('pushNotificationReceived', () => {});

  // Tap on the tray notification (background or cold start) → deep-link.
  PushNotifications.addListener('pushNotificationActionPerformed', handleTap);
}

// Request permission (Android 13+ prompts), then register. Safe to call on every
// login/boot — listeners are bound once, and register() just re-emits the token.
export async function registerPush() {
  if (!IS_NATIVE) return;
  try {
    await ensureChannel();
    await bindListenersOnce();

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[push] notification permission not granted');
      return;
    }
    await PushNotifications.register();   // → fires 'registration' → POSTs token
  } catch (e) {
    console.warn('[push] registerPush failed:', e && e.message);
  }
}

// Explicit-logout only. Deactivates this device's token on the server so a
// logged-out phone stops receiving that hotel's alerts. MUST run while the JWT
// is still present (call before clearing the auth session).
export async function unregisterPush() {
  if (!IS_NATIVE) return;
  const token = localStorage.getItem(TOKEN_LS);
  if (!token) return;
  try {
    await api.delete('/hotel/push-token', { data: { token } });
  } catch (e) {
    console.warn('[push] token DELETE failed:', e && e.message);
  } finally {
    localStorage.removeItem(TOKEN_LS);
  }
}
