import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, CardHeader, Btn, PageSkeleton } from '../../components/shared/UI';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 6 }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 5 }}>{hint}</div>}
  </div>
);

const inputStyle = {
  width: '100%', padding: '10px 13px', border: '1.5px solid var(--border)',
  borderRadius: 8, fontFamily: 'inherit', fontSize: 14, color: 'var(--gray-800)',
  background: 'var(--card-bg, #fff)',
};

const HotelProfile = () => {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ hotelName: '', phone: '', address: '', gstNumber: '' });
  const [meta,    setMeta]    = useState({ email: '', userId: '', logoUrl: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [preview,  setPreview]  = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/hotel/profile')
      .then(({ data }) => {
        if (cancelled) return;
        const d = data.data || {};
        setForm({ hotelName: d.hotelName || '', phone: d.phone || '', address: d.address || '', gstNumber: d.gstNumber || '' });
        setMeta({ email: d.email || '', userId: d.userId || '', logoUrl: d.logoUrl || '' });
      })
      .catch(() => !cancelled && toast.error('Could not load your profile'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // Object URLs leak if they are not revoked when the choice changes.
  useEffect(() => {
    if (!logoFile) return setPreview('');
    const url = URL.createObjectURL(logoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mirror the server's rules so the user finds out here, not after upload.
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Logo must be a JPG, PNG or WEBP image');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be under 2MB');
      e.target.value = '';
      return;
    }
    setLogoFile(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.hotelName.trim() || !form.phone.trim() || !form.address.trim() || !form.gstNumber.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('hotelName', form.hotelName);
      fd.append('phone',     form.phone);
      fd.append('address',   form.address);
      fd.append('gstNumber', form.gstNumber.toUpperCase());
      if (logoFile) fd.append('logo', logoFile);

      const { data } = await api.put('/hotel/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMeta(m => ({ ...m, logoUrl: data.data?.logoUrl || m.logoUrl }));
      setLogoFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await refreshUser();          // repaint the sidebar logo and name
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  const shownLogo = preview || meta.logoUrl;

  return (
    <div>
      <PageHeader
        title="Hotel Profile"
        subtitle="Your logo, name and GST details — these appear on guest pages and on every invoice"
      />

      <form onSubmit={save}>
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Logo" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {shownLogo
              ? <img src={shownLogo} alt="Hotel logo" style={{ width: 84, height: 84, borderRadius: 14, objectFit: 'contain', border: '1px solid var(--border)', background: '#fff' }} />
              : <div style={{ width: 84, height: 84, borderRadius: 14, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'var(--gray-400)' }}>🏨</div>}
            <div style={{ flex: 1, minWidth: 220 }}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickLogo} style={{ display: 'none' }} />
              <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {shownLogo ? 'Change logo' : 'Upload logo'}
              </Btn>
              {logoFile && (
                <Btn variant="outline" size="sm" style={{ marginLeft: 8 }} onClick={() => { setLogoFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  Cancel
                </Btn>
              )}
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                JPG, PNG or WEBP · up to 2MB · a square image works best.<br />
                Shown to guests on the QR page and in your dashboard sidebar.
              </div>
              {logoFile && <div style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600, marginTop: 6 }}>New logo selected — click Save to apply</div>}
            </div>
          </div>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Hotel details" />
          <Field label="Hotel Name *" hint="Shown to guests on the QR page and used as the billing name on invoices.">
            <input style={inputStyle} value={form.hotelName} onChange={set('hotelName')} placeholder="e.g. Gayatri Gavi" />
          </Field>
          <Field label="Phone *" hint="Guests see this on the QR page to contact your front desk.">
            <input style={inputStyle} value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="10-digit number" />
          </Field>
          <Field label="Address *">
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} value={form.address} onChange={set('address')} rows={2} />
          </Field>
          <Field label="GST Number *" hint="Appears on every tax invoice and drives the CGST/SGST vs IGST split. Double-check before saving.">
            <input style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }} value={form.gstNumber} onChange={set('gstNumber')} placeholder="29ABCDE1234F1Z5" />
          </Field>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Login details" />
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 14 }}>
            These identify your account and cannot be changed here. Contact support if your email address needs to change.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[['User ID', meta.userId], ['Email', meta.email]].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', wordBreak: 'break-all' }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 30 }}>
          <Btn type="submit" variant="brand" disabled={saving} loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

export default HotelProfile;
