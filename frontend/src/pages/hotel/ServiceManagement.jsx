import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner } from '../../components/shared/UI';

const EMOJI_SUGGESTIONS = ['🛎','🛁','🧹','❄️','🛏','💡','📞','🔒','🚿','🍽','🧺','🔇','📡','🚕','🧴','🍹','🧊','🚑','🅿️','🐾','🎁','💧','🔧','🧼','👔','🚭','🩹','🌙'];

const ServiceManagement = () => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ icon: '🛎', label: '' });
  const [saving,  setSaving]  = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/hotel/service-options');
      setOptions(r.data.data || []);
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

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const r = await api.post('/hotel/service-options/seed-defaults');
      toast.success(r.data.message || 'Default services added');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSeeding(false); }
  };

  return (
    <div>
      <PageHeader
        title="Service Management"
        subtitle="Add or remove the Room-Service options your guests see on the QR page"
      />

      {/* Add form */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Add a service</div>
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

      {/* Current services */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title">Your services {options.length > 0 && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>· {options.length}</span>}</div>
          {options.length === 0 && (
            <button className="btn btn-sm btn-outline" onClick={seedDefaults} disabled={seeding}>
              {seeding ? 'Loading…' : '↺ Load default services'}
            </button>
          )}
        </div>

        {loading ? <Spinner /> : options.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛎</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>No custom services yet</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 16 }}>
              Your guests currently see the built-in default services. Add your own above, or load the defaults to start editing them.
            </div>
            <button className="btn btn-brand" onClick={seedDefaults} disabled={seeding}>{seeding ? 'Loading…' : '↺ Load default services'}</button>
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

        <div style={{ marginTop: 16, background: 'var(--brand-light)', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: 'var(--brand)', lineHeight: 1.6 }}>
          💡 Guests see these instantly on the QR page. Naming a service <strong>Wake-up Call</strong> or <strong>Cab Request</strong> keeps their special time / pickup pop-ups; any other service submits as a normal request.
        </div>
      </Card>
    </div>
  );
};

export default ServiceManagement;
