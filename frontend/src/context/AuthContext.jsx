import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import api from '../utils/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'token';

// ── Durable native session file ──────────────────────────────────────────────
// The real cause of the "logged out after kill" bug: Preferences (SharedPrefs)
// writes ASYNC (apply) and Samsung's abrupt force-close can drop the unflushed
// write. A file write we AWAIT is committed to disk immediately (close() flushes)
// — the same idea Gmail/WhatsApp use to stay signed in across kills. This file
// is the source of truth on native; localStorage/Preferences are fast mirrors.
const AUTH_FILE = 'sxp-session.json';
const fileWriteSession = async (token, user) => {
  if (!IS_NATIVE) return;
  try { await Filesystem.writeFile({ path: AUTH_FILE, directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify({ token, user }) }); } catch {}
};
const fileReadSession = async () => {
  if (!IS_NATIVE) return null;
  try { const r = await Filesystem.readFile({ path: AUTH_FILE, directory: Directory.Data, encoding: Encoding.UTF8 }); return JSON.parse(r.data); } catch { return null; }
};
const fileClearSession = async () => {
  if (!IS_NATIVE) return;
  try { await Filesystem.deleteFile({ path: AUTH_FILE, directory: Directory.Data }); } catch {}
};

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

// Cache the signed-in profile so the app can open straight into the dashboard
// on relaunch without waiting on (or being blocked by) the network. Mirrored to
// Preferences on native for durability.
const USER_KEY = 'sxp-user';
const storeUser = (user) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
  if (IS_NATIVE) Preferences.set({ key: USER_KEY, value: JSON.stringify(user) }).catch(() => {});
};
const readCachedUser = () => {
  try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
};
const clearUser = () => {
  try { localStorage.removeItem(USER_KEY); } catch {}
  if (IS_NATIVE) Preferences.remove({ key: USER_KEY }).catch(() => {});
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

    const finishLoading = () => { if (!cancelled) setLoading(false); };
    const boot = (obj) => { try { localStorage.setItem('sxp-boot', JSON.stringify({ ...obj, at: new Date().toISOString() })); } catch {} };

    // Validate the restored session. Signs out ONLY on a real 401/403; a
    // transient failure (cold-start network blip) is retried and the session is
    // kept. `blocking` = we had no cached profile to show, so keep the spinner
    // until this resolves rather than flashing the login screen.
    const validate = async (attempt = 0, blocking = false) => {
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) { setUser(data.user); storeUser(data.user); }
        fileWriteSession(getStoredToken(), data.user);   // keep the on-disk copy fresh
        boot({ step: 'validated', ok: true });
        finishLoading();
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          clearToken(); clearUser(); fileClearSession();
          if (!cancelled) setUser(null);
          boot({ step: 'rejected', status });
          finishLoading();
        } else if (attempt < 4) {
          boot({ step: 'retry', attempt, err: status || 'network' });
          setTimeout(() => { if (!cancelled) validate(attempt + 1, blocking); }, 800 * (attempt + 1)); // keep session, retry
        } else {
          boot({ step: 'gaveup', err: status || 'network' });
          finishLoading();   // keep the token for next time; lands on login only if there was no cached profile
        }
      }
    };

    (async () => {
      // Persistence self-test — proves, in one look, WHERE the failure is:
      //   • prefWorks   : native Preferences round-trips this session
      //   • prefSurvived: a marker written on a PREVIOUS launch survived the kill
      // Restore the session from the on-disk file FIRST (most reliable), then
      // Preferences, then whatever is already in localStorage.
      let fileSurvived = false;
      if (IS_NATIVE) {
        const f = await fileReadSession();
        if (f && f.token) {
          fileSurvived = true;
          if (!getStoredToken()) localStorage.setItem(TOKEN_KEY, f.token);
          if (f.user && !localStorage.getItem(USER_KEY)) { try { localStorage.setItem(USER_KEY, JSON.stringify(f.user)); } catch {} }
        }
        if (!getStoredToken()) { try { const { value } = await Preferences.get({ key: TOKEN_KEY }); if (value) localStorage.setItem(TOKEN_KEY, value); } catch {} }
        if (!localStorage.getItem(USER_KEY)) { try { const { value } = await Preferences.get({ key: USER_KEY }); if (value) localStorage.setItem(USER_KEY, value); } catch {} }
      }
      const token = getStoredToken();
      const cached = readCachedUser();
      // Startup diagnostic — surfaced on the login screen so we can see whether
      // the session survived the app being killed, and via which store.
      boot({ step: 'start', native: IS_NATIVE, token: !!token, cachedUser: !!cached, fileSurvived });

      if (!token) { finishLoading(); return; }          // truly no session → login
      if (cached && !cancelled) {
        setUser(cached);        // open straight into the app, no network wait
        finishLoading();
        validate(0, false);     // confirm in the background
      } else {
        // We have a token but no cached profile — keep the spinner (do NOT flash
        // to login) until the server confirms who this is.
        validate(0, true);
      }
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
      storeUser(data.user);
      await fileWriteSession(data.token, data.user);   // committed to disk before we return

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
      setUser(data.user); storeUser(data.user);
      await fileWriteSession(token, data.user);
      return { success: true, role: data.user.role };
    } catch (err) {
      // Only drop the session if the token is actually rejected; a transient
      // error shouldn't undo a fresh registration login.
      if (err?.response?.status === 401 || err?.response?.status === 403) { clearToken(); clearUser(); fileClearSession(); setUser(null); }
      return { success: false };
    }
  };

  // Re-reads the profile after the hotel edits it, so the sidebar logo, name
  // and trial banner update without forcing a re-login.
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user); storeUser(data.user);
      fileWriteSession(getStoredToken(), data.user);
      return data.user;
    } catch { return null; }
  };

  const logout = () => {
    clearToken();
    clearUser();
    fileClearSession();
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
