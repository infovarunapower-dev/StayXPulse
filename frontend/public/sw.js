/* StayXPulse web-push service worker.
   Receives pushes from the backend (VAPID) and shows a notification even when
   the dashboard tab is closed, as long as the browser is running. Tapping it
   focuses/opens the app at the right screen.
   NOTE: web notifications use the system sound — the custom MP3 is Android-only. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  const title = payload.title || 'StayXPulse';
  const data = payload.data || {};
  const options = {
    body: payload.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.type ? `sxp-${data.type}` : 'sxp',
    renotify: true,
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = (event.notification.data && event.notification.data.route) || '/';
  const url = new URL(route, self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) {
        try { if ('navigate' in c) await c.navigate(url); } catch (e) {}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
