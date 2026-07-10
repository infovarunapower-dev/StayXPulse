import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { playOrderChime, playServiceChime, unlockAudio } from '../utils/chime';

const POLL_MS = 5000;

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const notify = (title, body) => {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(title, { body, tag: 'sxp-alert' }); } catch {}
  }
};

// Watches for new pending food orders and service requests while the admin
// app is open (any page): plays a chime, shows a toast, and fires a desktop
// notification when the tab is in the background. Seeds silently on first
// load so existing pending items don't false-alarm. Polls status=pending
// without a date filter — the server clock is UTC, so a "today" filter
// would miss late-night IST orders.
export default function useNewOrderAlert(enabled) {
  const seenOrders   = useRef(null); // null = not seeded yet
  const seenRequests = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const unlock = () => {
      unlockAudio();
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });

    let cancelled = false;
    let stopped = false; // set on auth/subscription failure so we don't poll a locked account forever

    async function tick() {
      if (cancelled || stopped) return;
      try {
        const [ordRes, reqRes] = await Promise.all([
          api.get('/hotel/food-orders',      { params: { status: 'pending', limit: 20 } }),
          api.get('/hotel/service-requests', { params: { status: 'pending', limit: 20 } }),
        ]);
        if (cancelled) return;
        const orders   = ordRes.data?.data || [];
        const requests = reqRes.data?.data || [];

        if (seenOrders.current === null) {
          seenOrders.current   = new Set(orders.map((o) => o.id));
          seenRequests.current = new Set(requests.map((r) => r.id));
          return;
        }

        const freshOrders = orders.filter((o) => !seenOrders.current.has(o.id));
        freshOrders.forEach((o) => seenOrders.current.add(o.id));
        const freshReqs = requests.filter((r) => !seenRequests.current.has(r.id));
        freshReqs.forEach((r) => seenRequests.current.add(r.id));

        if (freshOrders.length) {
          const first = freshOrders[0];
          const total = freshOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
          const label = freshOrders.length === 1
            ? `New food order — Room ${first.room_number} • ${inr(first.total_amount)}`
            : `${freshOrders.length} new food orders • ${inr(total)}`;
          playOrderChime();
          toast(label, { icon: '🍽', duration: 8000 });
          notify('StayXPulse — new food order', label);
        }

        if (freshReqs.length) {
          const first = freshReqs[0];
          const label = freshReqs.length === 1
            ? `Service request — Room ${first.room_number}: ${first.type}`
            : `${freshReqs.length} new service requests`;
          playServiceChime();
          toast(label, { icon: '🛎', duration: 8000 });
          notify('StayXPulse — service request', label);
        }
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401 || status === 402 || status === 403) stopped = true;
        /* other errors are transient: stay silent, try again next tick */
      }
    }

    const id = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('pointerdown', unlock);
    };
  }, [enabled]);
}
