// ─────────────────────────────────────────────────────────────────────────────
//  Web Push (VAPID) — browser notifications that fire even when the dashboard
//  tab is closed (browser must still be running). Web-only; no-op on the native
//  Android app (which uses FCM) and on browsers without push support.
//
//  The subscription is stored server-side in device_tokens with platform 'web'
//  (the JSON-stringified PushSubscription is the "token"), reusing the same
//  /hotel/push-token endpoint as Android.
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core';
import api from './api';

const IS_NATIVE = Capacitor.isNativePlatform();
const SUB_LS = 'sxp-web-push-sub';

function supported() {
  return !IS_NATIVE &&
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
    typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
}

// VAPID public key (base64url) → Uint8Array, as the Push API requires.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Register the service worker, ask permission, subscribe, and send the
// subscription to the backend. Safe to call on every login.
export async function registerWebPush() {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') { console.warn('[webpush] permission not granted'); return; }

    const { data } = await api.get('/hotel/webpush-key');
    const key = data && data.key;
    if (!key) { console.warn('[webpush] server has no VAPID key configured'); return; }

    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const json = JSON.stringify(sub);
    localStorage.setItem(SUB_LS, json);
    await api.post('/hotel/push-token', { token: json, platform: 'web' });
    console.log('[webpush] subscribed + registered with backend');
  } catch (e) {
    console.warn('[webpush] register failed:', e && e.message);
  }
}

// Explicit logout: unsubscribe this browser and deactivate it server-side.
export async function unregisterWebPush() {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const json = (sub && JSON.stringify(sub)) || localStorage.getItem(SUB_LS);
    if (sub) { try { await sub.unsubscribe(); } catch (_) {} }
    if (json) { try { await api.delete('/hotel/push-token', { data: { token: json } }); } catch (_) {} }
  } catch (_) {
    /* ignore */
  } finally {
    localStorage.removeItem(SUB_LS);
  }
}
