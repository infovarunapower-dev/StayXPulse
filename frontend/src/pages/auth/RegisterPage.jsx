import React, { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '../../components/auth/AuthLayout';
import Input from '../../components/common/Input';
import api from '../../utils/api';

const STEPS = ['Hotel Details', 'Contact & Location', 'Review & Submit'];

const RegisterPage = () => {
  const navigate  = useNavigate();
  const logoRef   = useRef(null);
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent') === 'buy' ? 'buy' : 'trial';   // ?intent=buy → no trial, choose a plan

  const [step, setStep]       = useState(0);
  const [submitting, setSub]  = useState(false);
  const [errors, setErrors]   = useState({});
  const [logoPreview, setLP]  = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    hotelName: '', phone: '', email: '', address: '', gstNumber: '', logo: null,
  });

  const set = (field) => (e) => {
    const v = e.target.value;
    setForm(f => ({ ...f, [field]: v }));
    setErrors(errs => (errs[field] ? { ...errs, [field]: undefined } : errs));
  };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return; }
    setForm(f => ({ ...f, logo: file }));
    setLP(URL.createObjectURL(file));
  };

  const validateStep = (s) => {
    const errs = {};
    if (s === 0) {
      if (!form.hotelName.trim()) errs.hotelName = 'Hotel name is required';
      if (!form.gstNumber.trim()) errs.gstNumber = 'GST number is required';
    }
    if (s === 1) {
      if (!form.phone.trim()) errs.phone = 'Phone is required';
      if (!form.email.trim()) errs.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
      if (!form.address.trim()) errs.address = 'Address is required';
    }
    return errs;
  };

  const nextStep = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSub(true);
    try {
      const fd = new FormData();
      fd.append('hotelName', form.hotelName);
      fd.append('phone',     form.phone);
      fd.append('email',     form.email);
      fd.append('address',   form.address);
      fd.append('gstNumber', form.gstNumber.toUpperCase());
      fd.append('intent', intent);
      if (form.logo) fd.append('logo', form.logo);

      const { data } = await api.post('/auth/register', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(data);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setSub(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
          <div className="auth-card-title" style={{ fontSize: '22px' }}>{intent === 'buy' ? "You're registered!" : "You're all set!"}</div>
          <div className="auth-card-sub" style={{ marginBottom: '28px' }}>
            <strong>{success.data.hotelName}</strong> has been registered.{' '}
            {success.data.emailSent === false
              ? <>We could not deliver the welcome email to <strong>{success.data.emailedTo}</strong>, so your login details are below — <strong>save them now</strong>, this is the only time they are shown.</>
              : <>Login credentials have been sent to <strong>{success.data.emailedTo}</strong>.{intent === 'buy' ? ' Log in and choose a plan to activate your account.' : ''}</>}
          </div>

          {/* Fallback delivery. The password exists in plaintext only in this
              response — the database keeps a bcrypt hash — so if the email did
              not go out, this screen is the account's only way in. */}
          {success.data.credentials && (
            <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '12px', padding: '18px', textAlign: 'left', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 12 }}>⚠️ Save these login details now</div>
              {[['User ID', success.data.credentials.userId], ['Email', success.data.credentials.email], ['Password', success.data.credentials.password]].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: '#92400E', fontWeight: 600 }}>{label}</span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#78350F', wordBreak: 'break-all' }}>{value}</code>
                </div>
              ))}
              <button
                className="btn btn-sm"
                style={{ width: '100%', marginTop: 8, background: '#92400E', color: '#fff' }}
                onClick={() => {
                  const { userId, email, password } = success.data.credentials;
                  navigator.clipboard?.writeText(`StayXPulse login\nUser ID: ${userId}\nEmail: ${email}\nPassword: ${password}`)
                    .then(() => toast.success('Login details copied'))
                    .catch(() => toast.error('Could not copy — please write them down'));
                }}>
                Copy login details
              </button>
            </div>
          )}
          <div style={{ background: 'var(--brand-light)', borderRadius: '12px', padding: '20px', textAlign: 'left', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px' }}>
              <span style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Your User ID</span>
              <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand)' }}>{success.data.userId}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ color: 'var(--gray-500)', fontWeight: 600 }}>{intent === 'buy' ? 'Next step' : 'Trial Ends'}</span>
              <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{intent === 'buy' ? 'Choose a plan' : new Date(success.data.trialEndDate).toDateString()}</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            {intent === 'buy' ? 'Log in & Choose Plan →' : 'Go to Login →'}
          </button>
        </div>
      </AuthLayout>
    );
  }

  // ── Step indicators ────────────────────────────────────────────────────────
  const StepBar = () => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', alignItems: 'center' }}>
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: i < 2 ? 'none' : 1 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: i < step ? 'var(--success)' : i === step ? 'var(--brand)' : 'var(--gray-200)',
              color: i <= step ? '#fff' : 'var(--gray-400)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, flexShrink: 0,
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: i === step ? 'var(--gray-900)' : 'var(--gray-400)', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: '2px', background: i < step ? 'var(--success)' : 'var(--gray-200)', borderRadius: '1px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <AuthLayout>
      <div className="auth-card-title">Register Your Hotel</div>
      <div className="auth-card-sub">{intent === 'buy' ? 'Register your hotel, then choose a plan to activate' : 'Get started with a 3-day free trial — no credit card needed'}</div>

      <StepBar />

      <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()}>

        {/* ── Step 0: Hotel Details ── */}
        {step === 0 && (
          <>
            <Input label="Hotel Name *" placeholder="The Grand Palace" value={form.hotelName}
              onChange={set('hotelName')} error={errors.hotelName} autoFocus />
            <div className="form-group">
              <label className="form-label">GST Number *</label>
              <input className={`form-control${errors.gstNumber ? ' error' : ''}`}
                placeholder="29ABCDE1234F1Z5" value={form.gstNumber}
                onChange={e => { const v = e.target.value.toUpperCase(); setForm(f => ({ ...f, gstNumber: v })); setErrors(errs => (errs.gstNumber ? { ...errs, gstNumber: undefined } : errs)); }}
                maxLength={20} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px' }} />
              {errors.gstNumber && <div className="form-error">⚠ {errors.gstNumber}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Hotel Logo (optional)</label>
              <input type="file" ref={logoRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
              <div
                onClick={() => logoRef.current.click()}
                style={{
                  border: '2px dashed var(--gray-300)', borderRadius: '10px',
                  padding: '20px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border 0.2s', background: 'var(--gray-50)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-300)'}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" style={{ height: '70px', objectFit: 'contain', borderRadius: '8px' }} />
                ) : (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '6px' }}>🏨</div>
                    <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Click to upload PNG / JPG / SVG (max 2 MB)</div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: Contact & Location ── */}
        {step === 1 && (
          <>
            <Input label="Phone Number *" placeholder="+91 98765 43210" value={form.phone}
              onChange={set('phone')} error={errors.phone} autoFocus />
            <Input label="Email Address *" type="email" placeholder="info@hotel.com" value={form.email}
              onChange={set('email')} error={errors.email} />
            <div className="form-group">
              <label className="form-label">Full Address *</label>
              <textarea className={`form-control${errors.address ? ' error' : ''}`}
                placeholder="Street, City, State, PIN code" value={form.address}
                onChange={set('address')} rows={3} style={{ resize: 'vertical' }} />
              {errors.address && <div className="form-error">⚠ {errors.address}</div>}
            </div>
          </>
        )}

        {/* ── Step 2: Review ── */}
        {step === 2 && (
          <div style={{ background: 'var(--gray-50)', borderRadius: '12px', padding: '20px', marginBottom: '8px' }}>
            {[
              { label: 'Hotel Name',  value: form.hotelName },
              { label: 'GST Number',  value: form.gstNumber, mono: true },
              { label: 'Phone',       value: form.phone },
              { label: 'Email',       value: form.email },
              { label: 'Address',     value: form.address },
              { label: 'Logo',        value: logoPreview ? '✅ Uploaded' : '— (skipped)' },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '14px', gap: '12px' }}>
                <span style={{ color: 'var(--gray-500)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--gray-800)', textAlign: 'right', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {step > 0 && (
            <button type="button" className="btn btn-outline" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>
              ← Back
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={nextStep}>
              Continue →
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              {submitting ? <><span className="spinner" /> Registering…</> : '🏨 Register Hotel'}
            </button>
          )}
        </div>
      </form>

      <div className="auth-switch">
        Already registered? <Link to="/login" className="btn-link" style={{ fontSize: '14px' }}>Sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
