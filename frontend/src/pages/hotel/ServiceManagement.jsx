import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner } from '../../components/shared/UI';

const EMOJI_SUGGESTIONS = ['🛎','🩺','💆','💇','🧖','🏊','🍹','🚗','✈️','🎫','🧴','🍼','👶','🧊','🛍️','🎁','💧','🔧','🧼','👔','🚭','🩹','🌙','🧳','🚿','🧺','🐾','📶'];

const ServiceManagement = () => {
  const [options,  setOptions]  = useState([]);   // hotel's EXTRA services
  const [defaults, setDefaults] = useState([]);   // built-in, always shown (read-only)
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ icon: '🛎', label: '' });
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/hotel/service-options');
      setOptions(r.data.data || []);
      setDefaults(r.data.defaults || []);
    } catch { toast.error('Failed to load services'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addService = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) { toast.error('Enter a service name'); return; }
    setSaving(true);
    try {
      await api.post('/hotel/service-options', { icon: form.icon, label: form.label.trim() });
      toast.success(`"${form.label.trim()}" added`);
      setForm({ icon: '🛎', label: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const del = async (o) => {
    if (!window.confirm(`Remove "${o.label}" from the guest page?`)) return;
    try { await api.delete(`/hotel/service-options/${o.id}`); toast.success('Removed'); load(); }
    catch { toast.error('Failed to remove'); }
  };

  return (
    <div>
      <PageHeader
        title="Service Management"
        subtitle="Add your own extra Room-Service options — guests always see the standard services, plus these"
      />

      {/* Add form */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Add an extra service</div>
        <form onSubmit={addService}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 90 }}>
              <label className="form-label">Icon</label>
              <input className="form-control" value={form.icon} maxLength={4}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                style={{ textAlign: 'center', fontSize: 22, padding: '8px' }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Service name</label>
              <input className="form-control" placeholder="e.g. Doctor on Call, Spa Booking, Airport Pickup"
                value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-brand" disabled={saving} style={{ whiteSpace: 'nowrap' }}>
              {saving ? 'Adding…' : '+ Add service'}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>Pick an icon:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJI_SUGGESTIONS.map(e => (
                <button type="button" key={e} onClick={() => setForm(f => ({ ...f, icon: e }))}
                  style={{ fontSize: 20, width: 38, height: 38, borderRadius: 9, cursor: 'pointer',
                    border: form.icon === e ? '2px solid var(--brand)' : '1px solid var(--border)',
                    background: form.icon === e ? 'var(--brand-light)' : 'var(--surface)' }}>{e}</button>
              ))}
            </div>
          </div>
        </form>
      </Card>

      {loading ? <Spinner /> : (
        <>
          {/* Your extra services */}
          <Card style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>
              Your extra services {options.length > 0 && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>· {options.length}</span>}
            </div>
            {options.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '26px 16px', color: 'var(--gray-400)', fontSize: 13.5, lineHeight: 1.6 }}>
                No extra services yet. Add your own above — they'll appear on the guest page <strong>alongside</strong> the standard services below.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
                {options.map(o => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ fontSize: 22 }}>{o.icon}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{o.label}</span>
                    <button onClick={() => del(o)} title="Remove"
                      style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 8, padding: '5px 9px', fontSize: 13, cursor: 'pointer' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Built-in defaults (always shown, read-only) */}
          <Card>
            <div className="card-title" style={{ marginBottom: 4 }}>Standard services <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>· always shown</span></div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 14 }}>Every guest always sees these built-in options. Your extra services appear after them.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {defaults.map((d, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                  <span style={{ fontSize: 15 }}>{d.icon}</span> {d.label}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 16, background: 'var(--brand-light)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: 'var(--brand)', lineHeight: 1.6 }}>
              💡 Extra services appear on the guest QR page instantly. Naming one <strong>Wake-up Call</strong> or <strong>Cab Request</strong> gives it the special time / pickup pop-up; any other name submits as a normal request.
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default ServiceManagement;
