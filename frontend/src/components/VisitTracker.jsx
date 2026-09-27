// Logs a website page view to our own backend (once per session per path).
// Web-only — the native app is excluded so this measures website visitors.
// Renders nothing. Must live inside <BrowserRouter> (uses useLocation).
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import api from '../utils/api';

const IS_NATIVE = Capacitor.isNativePlatform();

function getVisitorId() {
  try {
    let id = localStorage.getItem('sxp-visitor-id');
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('sxp-visitor-id', id);
    }
    return id;
  } catch { return null; }
}

export default function VisitTracker() {
  const location = useLocation();
  useEffect(() => {
    if (IS_NATIVE) return;                       // website visitors only
    const path = location.pathname || '/';
    try {
      const key = `sxp-seen-${path}`;
      if (sessionStorage.getItem(key)) return;   // count each path once per session
      sessionStorage.setItem(key, '1');
    } catch { /* private mode — still send once */ }
    api.post('/analytics/visit', {
      path,
      visitorId: getVisitorId(),
      referrer: (typeof document !== 'undefined' && document.referrer) || '',
    }).catch(() => {});
  }, [location.pathname]);
  return null;
}
