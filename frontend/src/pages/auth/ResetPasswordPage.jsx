import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/common/Input';
import api from '../../utils/api';

const rules = [
  { test: (p) => p.length >= 8,        label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p),      label: 'One uppercase letter' },
  { test: (p) => /[0-9]/.test(p),      label: 'One number' },
];

// 0–4 score → strength meter
const strength = (p) => {
  if (!p) return { pct: 0, label: '', color: 'var(--gray-300)' };
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  const levels = [
    { pct: 25,  label: 'Weak',   color: 'var(--danger)' },
    { pct: 55,  label: 'Fair',   color: '#F59E0B' },
    { pct: 80,  label: 'Good',   color: 'var(--brand)' },
    { pct: 100, label: 'Strong', color: 'var(--success)' },
  ];
  return levels[Math.max(0, s - 1)];
};

const ResetPasswordPage = () => {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const [form, setF] = useState({ password: '', confirm: '' });
  const [errors, setE] = useState({});
  const [submitting, setSub] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8)        errs.password = 'Minimum 8 characters';
    else if (!/[A-Z]/.test(form.password))    errs.password = 'Must include an uppercase letter';
    else if (!/[0-9]/.test(form.password))    errs.password = 'Must include a number';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setE(errs); return; }
    setE({});
    setSub(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setDone(true);
      toast.success('Password reset! Redirecting…');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Link invalid or expired.';
      setE({ general: msg });
    } finally {
      setSub(false);
    }
  };

  const st = strength(form.password);

  if (done) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
          <div className="auth-card-title">Password Reset!</div>
          <div className="auth-card-sub">Redirecting you to login…</div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card-title">Set New Password</div>
      <div className="auth-card-sub">Choose a strong password for your account</div>

      {errors.general && <div className="alert alert-danger">⚠ {errors.general}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="New Password"
          type="password"
          placeholder="Min 8 characters"
          value={form.password}
          onChange={e => setF(f => ({ ...f, password: e.target.value }))}
          error={errors.password}
          autoFocus
        />

        {/* Strength meter */}
        {form.password && (
          <div style={{ marginTop: '-12px', marginBottom: '12px' }}>
            <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${st.pct}%`, background: st.color, borderRadius: '4px', transition: 'width 0.25s var(--ease), background 0.25s var(--ease)' }} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: st.color, marginTop: '5px' }}>{st.label} password</div>
          </div>
        )}

        {/* Password strength rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '20px', marginTop: '4px' }}>
          {rules.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px',
              color: r.test(form.password) ? 'var(--success)' : 'var(--gray-400)' }}>
              <span>{r.test(form.password) ? '✓' : '○'}</span> {r.label}
            </div>
          ))}
        </div>

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Repeat your password"
          value={form.confirm}
          onChange={e => setF(f => ({ ...f, confirm: e.target.value }))}
          error={errors.confirm}
        />

        {form.confirm && form.password === form.confirm && !errors.confirm && (
          <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700, marginTop: '-12px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            ✓ Passwords match
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Resetting…</> : 'Reset Password →'}
        </button>
      </form>

      <div className="auth-switch">
        <Link to="/login" className="btn-link" style={{ fontSize: '14px' }}>← Back to Login</Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
