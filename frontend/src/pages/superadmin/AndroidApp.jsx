import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner } from '../../components/shared/UI';

const APK_URL = '/stayxpulse.apk';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const AndroidApp = () => {
  const [versions, setVersions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // add-version form
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ version: '', versionCode: '', notes: '' });
  const [saving,  setSaving]  = useState(false);

  // notify state (per version id)
  const [confirmId, setConfirmId] = useState(null);
  const [notifying, setNotifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/superadmin/app-versions');
      setVersions(r.data.data || []);
    } catch { toast.error('Failed to load app versions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addVersion = async (e) => {
    e.preventDefault();
    if (!form.version.trim()) { toast.error('Version is required'); return; }
    setSaving(true);
    try {
      const notes = form.notes.split('\n').map(s => s.trim()).filter(Boolean);
      await api.post('/superadmin/app-versions', {
        version: form.version.trim(),
        versionCode: form.versionCode.trim(),
        notes,
      });
      toast.success(`Version ${form.version.trim()} added`);
      setForm({ version: '', versionCode: '', notes: '' });
      setShowAdd(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add version'); }
    finally { setSaving(false); }
  };

  const notifyHotels = async (v) => {
    setNotifying(true);
    try {
      const notes = Array.isArray(v.notes) ? v.notes : [];
      const r = await api.post('/superadmin/notify-app-update', { version: v.version, notes });
      toast.success(r.data.message || 'Hotels notified');
      setConfirmId(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to notify'); }
    finally { setNotifying(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Android APK"
        subtitle="Version history, what's new, and notify hotels about a release"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn btn-outline" href={APK_URL} download>⬇ Download current APK</a>
            <button className="btn btn-brand" onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Close' : '+ Add version'}</button>
          </div>
        }
      />

      {/* Add version form */}
      {showAdd && (
        <Card style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Add a new version</div>
          <form onSubmit={addVersion}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ width: 150 }}>
                <label className="form-label">Version *</label>
                <input className="form-control" placeholder="e.g. 1.3" value={form.version}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div style={{ width: 150 }}>
                <label className="form-label">Version code</label>
                <input className="form-control" placeholder="e.g. 4" value={form.versionCode}
                  onChange={e => setForm(f => ({ ...f, versionCode: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">What's new (one per line)</label>
              <textarea className="form-control" rows={4}
                placeholder={"Faster menu loading\nNew report export\nBug fixes"}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-brand" disabled={saving}>{saving ? 'Saving…' : 'Save version'}</button>
            </div>
          </form>
        </Card>
      )}

      {versions.length === 0 ? (
        <Card><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>No versions yet. Add your first release.</div></Card>
      ) : versions.map((v, i) => {
        const isCurrent = i === 0;
        const notes = Array.isArray(v.notes) ? v.notes : [];
        return (
          <Card key={v.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-900)' }}>🤖 v{v.version}</span>
                  {v.version_code != null && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>code {v.version_code}</span>}
                  {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46', background: 'var(--success-light)', padding: '3px 10px', borderRadius: 20 }}>CURRENT</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Released {fmtDate(v.released_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isCurrent && <a className="btn btn-sm btn-outline" href={APK_URL} download>⬇ Download</a>}
                {confirmId === v.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#92400E' }}>Email all hotels?</span>
                    <button className="btn btn-sm btn-outline" onClick={() => setConfirmId(null)} disabled={notifying}>No</button>
                    <button className="btn btn-sm btn-brand" onClick={() => notifyHotels(v)} disabled={notifying}>{notifying ? 'Sending…' : 'Yes, send'}</button>
                  </div>
                ) : (
                  <button className="btn btn-sm btn-brand" onClick={() => setConfirmId(v.id)}>📣 Notify hotels</button>
                )}
              </div>
            </div>

            {notes.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>What's new</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {notes.map((n, idx) => (
                    <li key={idx} style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.7 }}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default AndroidApp;
