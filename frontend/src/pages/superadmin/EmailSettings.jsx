import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner, Modal } from '../../components/shared/UI';
import '../../components/shared/UI.css';

const EMAIL_TYPES = [
  { key: 'welcome',         icon: '🎉', label: 'Welcome Email',              desc: 'Sent after hotel registration with login credentials' },
  { key: 'forgot-password', icon: '🔒', label: 'Forgot Password',            desc: 'Password reset link email' },
  { key: 'trial-reminder',  icon: '⏰', label: 'Trial Reminder',             desc: 'Sent when trial is ending soon' },
  { key: 'expiry-reminder', icon: '⚠️', label: 'Subscription Expiry Reminder', desc: 'Sent before subscription expires' },
  { key: 'payment-success', icon: '✅', label: 'Payment Confirmation',        desc: 'Sent after successful payment with invoice' },
  { key: 'password-reset',  icon: '🔑', label: 'Password Reset by Admin',     desc: 'Sent when super admin resets hotel password' },
];

const StatusDot = ({ ok }) => (
  <span style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
    background: ok ? 'var(--success)' : 'var(--danger)',
    marginRight: 7, flexShrink: 0,
  }} />
);

const EmailSettings = () => {
  const [status,   setStatus]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [testTo,   setTestTo]   = useState('');
  const [sending,  setSending]  = useState(null);
  const [results,  setResults]  = useState({});

  // Editable email content
  const [templates, setTemplates] = useState([]);
  const [editTpl,   setEditTpl]   = useState(null);   // the template object being edited
  const [editForm,  setEditForm]  = useState({ subject: '', heading: '', intro: '', notice: '' });
  const [savingTpl, setSavingTpl] = useState(false);

  const loadTemplates = async () => {
    try { const r = await api.get('/email/templates'); setTemplates(r.data.data || []); } catch { /* silent */ }
  };
  const openEdit = (type) => {
    const t = templates.find(x => x.type === type);
    if (!t) { toast.error('Template not loaded yet'); return; }
    setEditForm({ ...t.current });
    setEditTpl(t);
  };
  const saveTpl = async () => {
    setSavingTpl(true);
    try {
      await api.put(`/email/templates/${editTpl.type}`, editForm);
      toast.success('Email content saved');
      setEditTpl(null);
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSavingTpl(false); }
  };
  const resetTpl = async () => {
    if (!window.confirm('Reset this email to its default wording?')) return;
    try {
      await api.delete(`/email/templates/${editTpl.type}`);
      toast.success('Reset to default');
      setEditTpl(null);
      loadTemplates();
    } catch { toast.error('Failed to reset'); }
  };

  // App-update broadcast
  const [appVersion,    setAppVersion]    = useState('');
  const [appNotes,      setAppNotes]      = useState('');
  const [notifying,     setNotifying]     = useState(false);
  const [confirmNotify, setConfirmNotify] = useState(false);
  const [notifyResult,  setNotifyResult]  = useState(null);

  const sendAppUpdate = async () => {
    setNotifying(true);
    try {
      const notes = appNotes.split('\n').map(s => s.trim()).filter(Boolean);
      const r = await api.post('/superadmin/notify-app-update', { version: appVersion.trim(), notes });
      setNotifyResult({ success: true, message: r.data.message });
      toast.success(r.data.message);
      setConfirmNotify(false);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send';
      setNotifyResult({ success: false, message: msg });
      toast.error(msg);
    } finally { setNotifying(false); }
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await api.get('/email/status');
      setStatus(r.data.data);
    } catch { toast.error('Failed to load email status'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); loadTemplates(); }, []);

  const sendTest = async (type) => {
    if (!testTo.trim()) { toast.error('Enter a test email address first'); return; }
    if (!/\S+@\S+\.\S+/.test(testTo)) { toast.error('Enter a valid email address'); return; }
    setSending(type);
    try {
      const r = await api.post('/email/test', { type, to: testTo });
      setResults(prev => ({ ...prev, [type]: { success: true, message: r.data.message } }));
      toast.success(r.data.testMode ? '📋 Logged to backend console' : `📧 Sent to ${testTo}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed';
      setResults(prev => ({ ...prev, [type]: { success: false, message: msg } }));
      toast.error(msg);
    } finally { setSending(null); }
  };

  const sendAllTests = async () => {
    if (!testTo.trim() || !/\S+@\S+\.\S+/.test(testTo)) { toast.error('Enter a valid email address'); return; }
    for (const et of EMAIL_TYPES) {
      await sendTest(et.key);
      await new Promise(r => setTimeout(r, 300));
    }
    toast.success('All test emails sent!');
  };

  if (loading) return <Spinner />;

  const isLive     = !status?.testMode;
  const smtpOk     = status?.connection?.success;
  const isBrevo    = status?.provider === 'brevo';
  // Brevo needs an API key and a verified sender; SMTP needs a real user.
  const configured = isBrevo
    ? !!status?.brevoKeySet
    : status?.smtpUser && !status.smtpUser.includes('your_gmail');

  return (
    <div>
      <PageHeader
        title="Email Settings"
        subtitle="Configure SMTP, test all email templates, and monitor delivery"
        action={<button className="btn btn-sm btn-outline" onClick={loadStatus}>↻ Refresh</button>}
      />

      {/* Status Card */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title">SMTP Status</div>
          <span style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: isLive ? 'var(--success-light)' : 'var(--accent-light)',
            color: isLive ? '#065F46' : '#92400E',
          }}>
            {isLive ? '🟢 LIVE MODE' : '🟡 TEST MODE'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { label: 'Mode',       value: status?.testMode ? 'Test (console only)' : 'Live (real emails)',  ok: true },
            { label: 'Provider',   value: isBrevo ? 'Brevo (HTTP API)' : 'SMTP', ok: true },
            isBrevo
              ? { label: 'API Key',   value: status?.brevoKeySet ? 'Configured' : 'MISSING', ok: !!status?.brevoKeySet }
              : { label: 'SMTP Host', value: status?.smtpHost || '—',  ok: !!status?.smtpHost },
            isBrevo
              ? { label: 'Sender',    value: status?.fromEmail || '— (FROM_EMAIL not set)', ok: !!status?.fromEmail }
              : { label: 'SMTP User', value: status?.smtpUser || '—',  ok: configured },
            { label: 'From Name',  value: status?.fromName || '—',    ok: !!status?.fromName },
            { label: 'Connection', value: status?.connection?.message, ok: smtpOk || status?.testMode },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>
                <StatusDot ok={item.ok} />
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Setup instructions */}
        {!configured && (
          <div style={{ marginTop: 16, background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#92400E', marginBottom: 8 }}>⚙️ Gmail Setup Required</div>
            <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.8 }}>
              1. Open <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code><br/>
              2. Set <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>SMTP_USER</code> = your Gmail address<br/>
              3. Go to <strong>myaccount.google.com</strong> → Security → 2-Step Verification → App passwords<br/>
              4. Generate an app password for <strong>Mail</strong><br/>
              5. Set <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>SMTP_PASS</code> = that 16-character password (no spaces)<br/>
              6. Set <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>EMAIL_TEST_MODE=false</code> to go live<br/>
              7. Restart backend
            </div>
          </div>
        )}
      </Card>

      {/* Notify hotels of a new app version */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 6 }}>📱 Notify Hotels — New App Version</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
          Emails every hotel a “new app is ready” message with the download link. Send this right after you release a new APK.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 150 }}>
            <label className="form-label">Version (optional)</label>
            <input className="form-control" placeholder="e.g. 1.2" value={appVersion} onChange={e => setAppVersion(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="form-label">What’s new (optional — one per line)</label>
            <textarea className="form-control" rows={3}
              placeholder={"Wake-up call reminders\nCab request option"}
              value={appNotes} onChange={e => setAppNotes(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>
        {!confirmNotify ? (
          <button className="btn btn-brand" onClick={() => setConfirmNotify(true)} disabled={notifying}>📣 Notify all hotels</button>
        ) : (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: '#92400E', marginBottom: 12 }}>
              This will email <strong>every hotel</strong> the download link{status?.testMode ? ' (TEST MODE — logged to backend console only)' : ''}. Continue?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setConfirmNotify(false)} disabled={notifying}>Cancel</button>
              <button className="btn btn-sm btn-brand" onClick={sendAppUpdate} disabled={notifying}>{notifying ? 'Sending…' : 'Yes, send to all hotels'}</button>
            </div>
          </div>
        )}
        {notifyResult && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: notifyResult.success ? 'var(--success)' : 'var(--danger)' }}>
            {notifyResult.success ? '✅ ' : '❌ '}{notifyResult.message}
          </div>
        )}
      </Card>

      {/* Test Emails */}
      <Card>
        <div className="card-title" style={{ marginBottom: 16 }}>Test Email Templates</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Send test emails to</label>
            <input
              className="form-control"
              type="email"
              placeholder="your@email.com"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
            />
          </div>
          <button className="btn btn-brand" onClick={sendAllTests} disabled={!!sending} style={{ whiteSpace: 'nowrap' }}>
            {sending ? 'Sending…' : '🚀 Send All Tests'}
          </button>
        </div>

        {status?.testMode && (
          <div style={{ background: 'var(--accent-light)', border: '1.5px solid var(--accent)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E', fontWeight: 500 }}>
            🟡 <strong>Test Mode ON</strong> — Emails won't actually be sent. Check your <strong>backend terminal</strong> to see the email output.
            To send real emails, set <code>EMAIL_TEST_MODE=false</code> in <code>backend/.env</code> and restart.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {EMAIL_TYPES.map(et => {
            const result = results[et.key];
            const busy   = sending === et.key;
            const tpl    = templates.find(t => t.type === et.key);
            return (
              <div key={et.key} style={{
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                padding: '14px 16px',
                background: result ? (result.success ? 'var(--success-light)' : 'var(--danger-light)') : 'var(--gray-50)',
                borderRadius: 10, border: '1px solid',
                borderColor: result ? (result.success ? '#A7F3D0' : '#FECACA') : 'var(--border)',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{et.icon}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {et.label}
                    {tpl?.customized && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#92600A', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 20, padding: '2px 8px', letterSpacing: '0.3px' }}>
                        ✎ CUSTOMIZED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                    {result ? result.message : et.desc}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => openEdit(et.key)}
                  disabled={!templates.length}
                >
                  ✏️ Edit content
                </button>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => sendTest(et.key)}
                  disabled={!!sending}
                >
                  {busy ? '⏳ Sending…' : '▶ Send Test'}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {editTpl && (
        <Modal open onClose={() => setEditTpl(null)} title={`✏️ Edit — ${editTpl.label}`} width={640}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
              Edit the wording guests see. Leave a field blank to fall back to the built-in default.
              {editTpl.placeholders?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: 'var(--gray-600)' }}>Available placeholders</span>
                  {' '}(inserted automatically):
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {editTpl.placeholders.map(p => (
                      <code key={p} style={{ fontSize: 11, background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE', borderRadius: 6, padding: '2px 7px' }}>
                        {`{{${p}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {[
              { k: 'subject', label: 'Subject line',    rows: 1, hint: 'The email subject' },
              { k: 'heading', label: 'Heading',         rows: 1, hint: 'Big title inside the email' },
              { k: 'intro',   label: 'Intro message',   rows: 3, hint: 'Opening line(s) of the body' },
              { k: 'notice',  label: 'Notice / callout', rows: 2, hint: 'Highlighted note (optional)' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 5 }}>
                  {f.label} <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>— {f.hint}</span>
                </label>
                <textarea
                  className="input"
                  rows={f.rows}
                  value={editForm[f.k] || ''}
                  onChange={e => setEditForm(s => ({ ...s, [f.k]: e.target.value }))}
                  placeholder={editTpl.defaults[f.k] || '(not used for this email)'}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-outline" onClick={resetTpl} style={{ color: 'var(--danger)' }}>
                ↺ Reset to default
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" onClick={() => setEditTpl(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveTpl} disabled={savingTpl}>
                  {savingTpl ? 'Saving…' : '💾 Save changes'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EmailSettings;
