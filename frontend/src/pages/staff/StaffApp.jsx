import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../../config';
import { playServiceChime, unlockAudio } from '../../utils/chime';
import './StaffApp.css';

// Standalone staff (labour) app: separate token from the admin app, so a staff
// login never touches AuthContext and vice versa.
const TOKEN_KEY = 'sxp_staff_token';
const INFO_KEY  = 'sxp_staff_info';
const POLL_MS   = 10000;

const staffApi = axios.create({ baseURL: API_BASE });
staffApi.interceptors.request.use(cfg => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

// ── Login ─────────────────────────────────────────────────────────────
export const StaffLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ hotelCode: '', phone: '', pin: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (localStorage.getItem(TOKEN_KEY)) navigate('/staff', { replace: true }); }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const r = await axios.post(`${API_BASE}/staff/login`, form);
      localStorage.setItem(TOKEN_KEY, r.data.token);
      localStorage.setItem(INFO_KEY, JSON.stringify(r.data.data));
      navigate('/staff', { replace: true });
    } catch (err) { setError(err.response?.data?.message || 'Login failed. Check your details.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="sa-shell">
      <div className="sa-login">
        <div className="sa-login-brand">
          <div className="sa-login-icon">🧑‍🔧</div>
          <div className="sa-login-title">StayXPulse Staff</div>
          <div className="sa-login-sub">Sign in to see your assigned tasks</div>
        </div>
        {error && <div className="sa-error">⚠ {error}</div>}
        <form onSubmit={submit}>
          <label className="sa-label">Hotel Code</label>
          <input className="sa-input" placeholder="HTL001" autoCapitalize="characters" value={form.hotelCode}
            onChange={e=>setForm(f=>({...f,hotelCode:e.target.value.toUpperCase()}))} autoFocus />
          <label className="sa-label">Phone Number</label>
          <input className="sa-input" placeholder="9876543210" inputMode="numeric" value={form.phone}
            onChange={e=>setForm(f=>({...f,phone:e.target.value.replace(/\D/g,'')}))} />
          <label className="sa-label">4-digit PIN</label>
          <input className="sa-input" placeholder="••••" type="password" inputMode="numeric" maxLength={4} value={form.pin}
            onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,'')}))} />
          <button className="sa-btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In →'}</button>
        </form>
        <div className="sa-login-help">Don't have a PIN? Ask your hotel manager to add you as staff.</div>
      </div>
    </div>
  );
};

// ── Tasks ─────────────────────────────────────────────────────────────
export const StaffTasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks]   = useState(null);   // null = loading
  const [toastMsg, setToast]= useState('');
  const seen = useRef(null);                    // seeded set of task ids
  const info = JSON.parse(localStorage.getItem(INFO_KEY) || '{}');

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(INFO_KEY);
    navigate('/staff-login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const r = await staffApi.get('/staff/tasks');
      const list = r.data.data || [];
      if (seen.current === null) {
        seen.current = new Set(list.map(t => t.id));
      } else {
        const fresh = list.filter(t => !seen.current.has(t.id));
        fresh.forEach(t => seen.current.add(t.id));
        if (fresh.length) {
          playServiceChime();
          const first = fresh[0];
          const label = fresh.length === 1 ? `New task — Room ${first.room_number}: ${first.type}` : `${fresh.length} new tasks assigned`;
          setToast(label);
          setTimeout(() => setToast(''), 6000);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
            try { new Notification('StayXPulse Staff — new task', { body: label, tag: 'sxp-staff-task' }); } catch {}
          }
        }
      }
      setTasks(list);
    } catch (err) {
      if ([401, 403].includes(err.response?.status)) logout();
    }
  }, [logout]);

  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    load();
    const id = setInterval(load, POLL_MS);
    return () => { clearInterval(id); window.removeEventListener('pointerdown', unlock); };
  }, [load]);

  const setStatus = async (task, status) => {
    try {
      await staffApi.patch(`/staff/tasks/${task.id}/status`, { status });
      load();
    } catch { setToast('Failed to update — try again'); setTimeout(() => setToast(''), 4000); }
  };

  if (tasks === null) return <div className="sa-shell"><div className="sa-loading"><div className="sa-spinner" />Loading your tasks…</div></div>;

  const open = tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
  const done = tasks.filter(t => t.status === 'completed');

  return (
    <div className="sa-shell">
      <div className="sa-header">
        <div>
          <div className="sa-header-name">👋 {info.name || 'Staff'}</div>
          <div className="sa-header-sub">{info.hotelName || ''} · {info.department || ''}</div>
        </div>
        <button className="sa-logout" onClick={logout}>⏻</button>
      </div>

      {toastMsg && <div className="sa-toast">🛎 {toastMsg}</div>}

      <div className="sa-body">
        <div className="sa-live"><span className="sa-live-dot" /> Checking for new tasks automatically</div>

        <div className="sa-section">My Tasks · {open.length}</div>
        {open.length === 0 && (
          <div className="sa-empty">
            <div style={{fontSize:44,marginBottom:8}}>🎉</div>
            All caught up! New tasks will appear here with a sound.
          </div>
        )}
        {open.map(t => (
          <div key={t.id} className={`sa-task ${t.status === 'in-progress' ? 'active' : ''}`}>
            <div className="sa-task-top">
              <div className="sa-task-room">Room {t.room_number}</div>
              <span className={`sa-pill ${t.status}`}>{t.status === 'pending' ? 'New' : 'In Progress'}</span>
            </div>
            <div className="sa-task-type">{t.type}</div>
            {t.note && <div className="sa-task-note">“{t.note}”</div>}
            <div className="sa-task-time">Assigned {fmtTime(t.assigned_at)} · Requested {fmtTime(t.created_at)}</div>
            <div className="sa-task-actions">
              {t.status === 'pending' && <button className="sa-btn-start" onClick={() => setStatus(t, 'in-progress')}>▶ Start Task</button>}
              <button className="sa-btn-done" onClick={() => setStatus(t, 'completed')}>✓ Mark Completed</button>
            </div>
          </div>
        ))}

        {done.length > 0 && <>
          <div className="sa-section" style={{marginTop:22}}>Completed Today · {done.length}</div>
          {done.map(t => (
            <div key={t.id} className="sa-task done">
              <div className="sa-task-top">
                <div className="sa-task-room">Room {t.room_number}</div>
                <span className="sa-pill completed">✓ Done {fmtTime(t.completed_at)}</span>
              </div>
              <div className="sa-task-type">{t.type}</div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
};
