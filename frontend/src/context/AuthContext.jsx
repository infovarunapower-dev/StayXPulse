import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import api from '../utils/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'token';

// The native app should stay logged in like any other app — sessionStorage is
// wiped when Android kills the backgrounded web-view, so on native we persist
// the token in localStorage AND mirror it into Capacitor Preferences (native
// storage that survives app kills, updates, and even a WebView-storage wipe).
const IS_NATIVE = Capacitor.isNativePlatform();

// Helper — get token from either web store
const getStoredToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;

// Persist the token. localStorage is the synchronous store api.js reads;
// sessionStorage is only for a non-remembered *web* login; Preferences is the
// durable native backup.
const storeToken = (token, remember) => {
  if (remember || IS_NATIVE) { localStorage.setItem(TOKEN_KEY, token); sessionStorage.removeItem(TOKEN_KEY); }
  else { sessionStorage.setItem(TOKEN_KEY, token); localStorage.removeItem(TOKEN_KEY); }
  if (IS_NATIVE) Preferences.set({ key: TOKEN_KEY, value: token }).catch(() => {});
};

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (IS_NATIVE) Preferences.remove({ key: TOKEN_KEY }).catch(() => {});
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // On mount: rehydrate the token from durable native storage if needed, then
  // validate it. Crucially, a transient error (cold-start network blip, a 5xx,
  // a timeout) must NOT log the user out — only a genuine 401/403 does. This was
  // the bug: killing/reopening the app fired /auth/me before the network was
  // ready, and the old catch wiped a valid session.
  useEffect(() => {
    let cancelled = false;

    const validate = async (attempt = 0) => {
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) { setUser(data.user); setLoading(false); }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          clearToken();                       // genuinely invalid/expired
          if (!cancelled) { setUser(null); setLoading(false); }
        } else if (attempt < 3) {
          setTimeout(() => { if (!cancelled) validate(attempt + 1); }, 700 * (attempt + 1)); // transient → keep token, retry
        } else if (!cancelled) {
          setLoading(false);                  // give up for now, but keep the token for the next launch
        }
      }
    };

    (async () => {
      // If the WebView store was cleared, restore the token from native storage.
      if (IS_NATIVE && !getStoredToken()) {
        try { const { value } = await Preferences.get({ key: TOKEN_KEY }); if (value) localStorage.setItem(TOKEN_KEY, value); } catch {}
      }
      if (!getStoredToken()) { if (!cancelled) setLoading(false); return; }
      validate();
    })();

    return () => { cancelled = true; };
  }, []); // empty deps — runs exactly once

  const login = async ({ email, password, rememberMe }) => {
    setError(null);
    try {
      // On native we always keep the session so the app behaves like any app;
      // pass that to the server too so it issues the longer-lived token.
      const remember = !!rememberMe || IS_NATIVE;
      const { data } = await api.post('/auth/login', { email, password, rememberMe: remember });

      // Store token FIRST before updating state
      storeToken(data.token, remember);

      setUser(data.user);
      return { success: true, role: data.user.role };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Auto-login with a token issued elsewhere (e.g. straight after registration),
  // so a new hotel can go directly to the plan page without a separate login.
  const loginWithToken = async (token, remember = false) => {
    setError(null);
    storeToken(token, remember || IS_NATIVE);
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return { success: true, role: data.user.role };
    } catch (err) {
      // Only drop the session if the token is actually rejected; a transient
      // error shouldn't undo a fresh registration login.
      if (err?.response?.status === 401 || err?.response?.status === 403) { clearToken(); setUser(null); }
      return { success: false };
    }
  };

  // Re-reads the profile after the hotel edits it, so the sidebar logo, name
  // and trial banner update without forcing a re-login.
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch { return null; }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginWithToken, logout, clearError, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
