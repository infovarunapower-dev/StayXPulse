import axios from 'axios';
import { API_BASE } from '../config';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Never redirect from here directly — a hard reload wipes React state. Emit an
// event instead and let the guards in App route via react-router.
//   402 (trial/subscription ended) → AccessGuard → /hotel/upgrade
//   401 (token expired/invalid)    → AuthGuard   → logout + /login
// Requests made while logged OUT are excluded: a wrong password on the login
// page is also a 401, and treating that as a session expiry would fire a
// bogus "session expired" toast and fight the login form.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 402 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
      window.dispatchEvent(new Event('sxp:subscription-required'));
    }
    if (status === 401) {
      const url = error.config?.url || '';
      const isAuthCall = AUTH_ENDPOINTS.some(p => url.includes(p));
      const hadToken = !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
      if (!isAuthCall && hadToken) {
        window.dispatchEvent(new Event('sxp:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
