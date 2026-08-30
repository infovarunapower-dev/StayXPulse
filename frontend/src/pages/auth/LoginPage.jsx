import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

// Reads the startup diagnostic the AuthProvider records, so this screen can
// explain WHY the user is here — did a saved session exist at launch or not.
const bootInfo = () => { try { return JSON.parse(localStorage.getItem('sxp-boot') || 'null'); } catch { return null; } };

const LoginPage = () => {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const boot = bootInfo();

  const [form, setForm]               = useState({ email: '', password: '', rememberMe: false });
  const [submitting, setSubmitting]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const isUserId = (v) => /^HTL\d+$/i.test(v.trim());
  const isEmail  = (v) => /\S+@\S+\.\S+/.test(v.trim());

  const validate = () => {
    const e = {};
    if (!form.email.trim())
      e.email = 'Email or User ID is required';
    else if (!isEmail(form.email) && !isUserId(form.email))
      e.email = 'Enter a valid email or User ID (e.g. HTL001)';
    if (!form.password)
      e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    clearError();

    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setSubmitting(true);

    const result = await login(form);
    setSubmitting(false);

    if (result.success) {
      // Navigate directly — no useEffect, no race condition
      navigate(
        result.role === 'superadmin' ? '/admin/dashboard' : '/hotel/dashboard',
        { replace: true }
      );
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card-title">Welcome back</div>
      <div className="auth-card-sub">Sign in with your email or Hotel User ID</div>

      {error && (
        <div className="alert alert-danger">
          <span>⚠</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label">Email Address or User ID</label>
          <input
            className={`form-control${fieldErrors.email ? ' error' : ''}`}
            type="text"
            placeholder="admin@hotel.com  or  HTL001"
            value={form.email}
            onChange={e => { setForm(f => ({ ...f, email: e.target.value })); clearError(); setFieldErrors(fe => (fe.email ? { ...fe, email: undefined } : fe)); }}
            autoComplete="username"
            autoFocus
          />
          {fieldErrors.email
            ? <div className="form-error">⚠ {fieldErrors.email}</div>
            : <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:5 }}>
                Hotel admins can use <strong>HTL001</strong> or their registered email
              </div>
          }
        </div>

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={form.password}
          onChange={e => { setForm(f => ({ ...f, password: e.target.value })); clearError(); setFieldErrors(fe => (fe.password ? { ...fe, password: undefined } : fe)); }}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={e => setForm(f => ({ ...f, rememberMe: e.target.checked }))}
            />
            Remember me for 30 days
          </label>
          <Link to="/forgot-password" className="btn-link">Forgot password?</Link>
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? <><span className="spinner" /> Signing in…</>
            : 'Sign In →'
          }
        </button>
      </form>

      <div className="auth-switch">
        New hotel?{' '}
        <Link to="/register" className="btn-link" style={{ fontSize:14 }}>
          Register your hotel
        </Link>
      </div>

      {boot && (
        <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
          background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', textAlign: 'left' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>Startup diagnostic</div>
          <div>• Native app: <b>{String(boot.native)}</b></div>
          <div>• Session file survived close: <b>{String(boot.fileSurvived)}</b></div>
          <div>• Session token found: <b>{String(boot.token)}</b> · saved login: <b>{String(boot.cachedUser)}</b></div>
        </div>
      )}
    </AuthLayout>
  );
};

export default LoginPage;
