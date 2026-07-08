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

// Do NOT redirect on 401 here — let AuthContext and ProtectedRoute handle it
// Redirecting from the interceptor causes a hard reload that wipes React state.
// On 402 (trial/subscription ended) emit an event; AccessGuard (in App) routes
// the user to the upgrade page via react-router (no hard reload).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402 && error.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
      window.dispatchEvent(new Event('sxp:subscription-required'));
    }
    return Promise.reject(error);
  }
);

export default api;
