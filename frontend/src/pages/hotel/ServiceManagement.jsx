import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner } from '../../components/shared/UI';

const EMOJI_SUGGESTIONS = ['🛎','🩺','💆','💇','🧖','🏊','🍹','🚗','✈️','🎫','🧴','🍼','👶','🧊','🛍️','🎁','💧','🔧','🧼','👔','🚭','🩹','🌙','🧳','🚿','🧺','🐾','📶'];

// One editable/toggleable row.
const ServiceRow = ({ o, onToggle, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [icon,  setIcon]  = useState(o.icon);
  const [label, setLabel] = useState(o.label);

  const save = () => {
    if (!label.trim()) { toast.error('Name cannot be empty'); return; }
    onSave(o, { icon: icon.trim() || '🛎', label: label.trim() });
    setEditing(false);
  };
  const cancel = () => { setIcon(o.icon); setLabel(o.label); setEditing(false); };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
      background: o.is_active ? 'var(--gray-50)' : 'var(--gray-100)', border: '1px solid var(--border)', borderRadius: 10,
      opacity: o.is_active ? 1 : 0.7 }}>
      {editing ? (
        <>
          <input value={icon} maxLength={4} onChange={e => setIcon(e.target.value)}
            style={{ width: 46, textAlign: 'center', fontSize: 18, padding: '6px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <input value={label} onChange={e => setLabel(e.target.value)} autoFocus
            style={{ flex: 1, minWidth: 80, fontSize: 14, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <button className="btn btn-sm btn-brand" onClick={save}>Save</button>
          <button className="btn btn-sm btn-outline" onClick={cancel}>Cancel</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 22 }}>{o.icon}</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
            {o.label} {!o.is_active && <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 500 }}>· hidden</span>}
          </span>
          <label className="sw" title={o.is_active ? 'Available — tap to hide' : 'Hidden — tap to show'}>
            <input type="checkbox" checked={o.is_active} onChange={e => onToggle(o, e.target.checked)} />
            <span />
          </label>
          <button onClick={() => setEditing(true)} title="Edit"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px', fontSize: 14, cursor: 'pointer' }}>✏️</button>
          {!o.is_default && (
            <button onClick={() => onDelete(o)} title="Remove"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 8, padding: '5px 9px', fontSize: 13, cursor: 'pointer' }}>🗑</button>
          )}
        </>
      )}
    </div>
  );
};

const ServiceManagement = () => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ icon: '🛎', label: '' });
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/hotel/service-options');
      setOptions(r.data.data || []);
    } catch { toast.error('Failed to load services'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchLocal = (id, patch) => setOptions(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));

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

  const onToggle = async (o, active) => {
    patchLocal(o.id, { is_active: active });   // optimistic
    try { await api.patch(`/hotel/service-options/${o.id}`, { is_active: active }); }
    catch { patchLocal(o.id, { is_active: !active }); toast.error('Failed to update'); }
  };

  const onSave = async (o, { icon, label }) => {
    patchLocal(o.id, { icon, label });         // optimistic
    try { await api.patch(`/hotel/service-options/${o.id}`, { icon, label }); toast.success('Saved'); }
    catch { toast.error('Failed to save'); load(); }
  };

  const onDelete = async (o) => {
    if (!window.confirm(`Remove "${o.label}"?`)) return;
    try { await api.delete(`/hotel/service-options/${o.id}`); toast.success('Removed'); load(); }
    catch { toast.error('Failed to remove'); }
  };

  const standards = options.filter(o => o.is_default);
  const extras    = options.filter(o => !o.is_default);

  return (
    <div>
      <PageHeader
        title="Service Management"
        subtitle="Turn services on/off, edit them, and add your own — this is exactly what guests see on the QR page"
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

      {loading ? <Spinner /> : (
        <>
          {/* Standard services */}
          <Card style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Standard services</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 14 }}>
              The built-in options. Toggle to show/hide on the guest page, or edit the name/icon. Naming one <strong>Wake-up Call</strong> or <strong>Cab Request</strong> keeps its special pop-up.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {standards.map(o => <ServiceRow key={o.id} o={o} onToggle={onToggle} onSave={onSave} onDelete={onDelete} />)}
            </div>
          </Card>

          {/* Extra services */}
          <Card>
            <div className="card-title" style={{ marginBottom: 4 }}>
              Your extra services {extras.length > 0 && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>· {extras.length}</span>}
            </div>
            {extras.length === 0 ? (
              <div style={{ fontSize: 13.5, color: 'var(--gray-400)', padding: '10px 0 4px' }}>
                No extra services yet — add your own above.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {extras.map(o => <ServiceRow key={o.id} o={o} onToggle={onToggle} onSave={onSave} onDelete={onDelete} />)}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default ServiceManagement;
