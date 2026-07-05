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
// Redirecting from the interceptor causes a hard reload that wipes React state
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
