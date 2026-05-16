import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/common/Input';
import api from '../../utils/api';

const ForgotPasswordPage = () => {
  const [email, setEmail]       = useState('');
  const [error, setError]       = useState('');
  const [submitted, setDone]    = useState(false);
  const [submitting, setSub]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return; }
    setError('');
    setSub(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch {
      setDone(true); // Always show success to prevent user enumeration
    } finally {
      setSub(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>📧</div>
          <div className="auth-card-title" style={{ fontSize: '22px' }}>Check your inbox</div>
          <div className="auth-card-sub" style={{ marginBottom: '28px' }}>
            If <strong>{email}</strong> is registered, you'll receive a password reset link within a few minutes.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            The link expires in <strong>15 minutes</strong>. Check your spam folder if you don't see it.
          </div>
          <Link to="/login" className="btn btn-outline" style={{ display: 'inline-flex' }}>
            ← Back to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-card-title">Forgot Password</div>
      <div className="auth-card-sub">Enter your email and we'll send you a reset link</div>

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Email Address"
          type="email"
          placeholder="admin@yourhotel.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={error}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Sending…</> : 'Send Reset Link →'}
        </button>
      </form>

      <div className="auth-switch">
        Remembered it? <Link to="/login" className="btn-link" style={{ fontSize: '14px' }}>Back to login</Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
