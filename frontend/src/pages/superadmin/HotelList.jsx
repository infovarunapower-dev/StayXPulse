import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useFetch } from '../../utils/hooks';
import { PageHeader, Badge, Card, Table, FilterBar, Spinner, TableSkeleton, Modal } from '../../components/shared/UI';
import '../../components/shared/UI.css';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

// ── Credentials Modal ─────────────────────────────────────────────────────────
const CredentialsModal = ({ hotel, open, onClose }) => {
  const [creds,    setCreds]   = useState(null);
  const [loading,  setLoading] = useState(false);
  const [resetting,setReset]   = useState(false);
  const [copied,   setCopied]  = useState('');

  useEffect(() => {
    if (!open || !hotel) return;
    setCreds(null);
    setLoading(true);
    api.get(`/superadmin/hotels/${hotel.id}/credentials`)
      .then(r => setCreds(r.data.data))
      .catch(() => toast.error('Failed to load credentials'))
      .finally(() => setLoading(false));
  }, [open, hotel]);

  const resetPassword = async () => {
    if (!window.confirm('Reset password for this hotel? The old password will stop working immediately.')) return;
    setReset(true);
    try {
      const r = await api.post(`/superadmin/hotels/${hotel.id}/reset-credentials`);
      setCreds(r.data.data);
      toast.success('Password reset! New credentials shown below.');
    } catch { toast.error('Failed to reset'); }
    finally { setReset(false); }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const copyAll = () => {
    if (!creds) return;
    const text = `Hotel: ${creds.hotelName}\nUser ID: ${creds.userId}\nEmail: ${creds.email}\nPassword: ${creds.password}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success('All credentials copied!');
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Hotel Login Credentials" width={460}>
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px 0' }}>
          <div style={{ width:32, height:32, border:'3px solid var(--gray-200)', borderTopColor:'var(--brand)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : creds ? (
        <div>
          <div style={{ background:'var(--brand-light)', borderRadius:10, padding:16, marginBottom:20, fontSize:13, color:'var(--brand)', fontWeight:500 }}>
            🔐 These are the login credentials for the hotel admin. Share them securely.
          </div>

          {[
            { label:'Hotel Name', value: creds.hotelName, key:'name' },
            { label:'User ID',    value: creds.userId,    key:'uid',  mono:true },
            { label:'Email',      value: creds.email,     key:'email' },
            { label:'Password',   value: creds.password,  key:'pass', mono:true, sensitive:true },
          ].map(row => (
            <div key={row.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>{row.label}</div>
                <div style={{ fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font)', fontSize:15, fontWeight:700, color: row.sensitive ? 'var(--brand)' : 'var(--gray-900)', letterSpacing: row.mono ? '0.5px' : 0 }}>
                  {row.value}
                </div>
              </div>
              <button
                onClick={() => copy(row.value, row.key)}
                style={{ padding:'5px 12px', background: copied===row.key ? 'var(--success-light)' : 'var(--gray-100)', color: copied===row.key ? '#065F46' : 'var(--gray-600)', border:'1px solid var(--border)', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap' }}>
                {copied === row.key ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ))}

          <div style={{ marginTop:20, display:'flex', gap:10 }}>
            <button className="btn btn-brand" style={{ flex:1 }} onClick={copyAll}>📋 Copy All</button>
            <button className="btn btn-outline" style={{ flex:1, color:'var(--danger)', borderColor:'var(--danger)' }}
              onClick={resetPassword} disabled={resetting}>
              {resetting ? 'Resetting…' : '🔄 Reset Password'}
            </button>
          </div>
          <div style={{ marginTop:12, fontSize:12, color:'var(--gray-400)', textAlign:'center' }}>
            Resetting will generate a new password immediately. Hotel admin must use the new password.
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

// ── Activate Plan Modal ───────────────────────────────────────────────────────
const ActivatePlanModal = ({ hotel, plans, open, onClose, onSuccess }) => {
  const [form, setForm] = useState({ planId:'', paymentId:'', amount:'', validFrom:'', validTo:'' });
  const [submitting, setSub] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handlePlanChange = (e) => {
    const plan = plans.find(p => p.id === e.target.value);
    if (plan) {
      const from = form.validFrom ? new Date(form.validFrom) : new Date();
      const to   = new Date(from); to.setDate(to.getDate() + plan.durationDays);
      setForm(f => ({ ...f, planId: e.target.value, amount: plan.price,
        validFrom: from.toISOString().split('T')[0], validTo: to.toISOString().split('T')[0] }));
    } else setForm(f => ({ ...f, planId: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.planId || !form.paymentId || !form.amount || !form.validFrom || !form.validTo) {
      toast.error('Please fill all required fields'); return;
    }
    setSub(true);
    try {
      await api.post(`/superadmin/hotels/${hotel.id}/activate`, form);
      toast.success('Plan activated!'); onSuccess(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to activate'); }
    finally { setSub(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Activate Plan — ${hotel?.hotelName}`} width={520}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Select Plan *</label>
          <select className="form-control" value={form.planId} onChange={handlePlanChange} required>
            <option value="">— Choose a plan —</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}/mo</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Valid From *</label>
            <input className="form-control" type="date" value={form.validFrom} onChange={set('validFrom')} required /></div>
          <div className="form-group"><label className="form-label">Valid To *</label>
            <input className="form-control" type="date" value={form.validTo} onChange={set('validTo')} required /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Amount (₹) *</label>
            <input className="form-control" type="number" value={form.amount} onChange={set('amount')} placeholder="2499" required /></div>
          <div className="form-group"><label className="form-label">Payment ID *</label>
            <input className="form-control" value={form.paymentId} onChange={set('paymentId')} placeholder="PAY_xxxx" style={{ fontFamily:'var(--font-mono)' }} required /></div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-brand" disabled={submitting}>{submitting ? 'Activating…' : '✅ Activate Plan'}</button>
        </div>
      </form>
    </Modal>
  );
};

// ── Main Hotel List page ──────────────────────────────────────────────────────
const HotelList = () => {
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [activating, setAct]      = useState(null);
  const [viewCreds, setViewCreds] = useState(null);
  const [plans, setPlans]         = useState([]);

  const q = `?${filter !== 'all' ? `status=${filter}&` : ''}${search ? `search=${encodeURIComponent(search)}&` : ''}`;
  const { data, loading, refetch } = useFetch(`/superadmin/hotels${q}`, [filter, search]);

  useEffect(() => {
    api.get('/superadmin/plans').then(r => setPlans(r.data.data)).catch(() => {});
  }, []);

  const sendReminder = async (hotel) => {
    try { await api.post(`/superadmin/reminders/${hotel.id}`); toast.success(`Reminder sent to ${hotel.email}`); }
    catch { toast.error('Failed to send reminder'); }
  };

  const hotels = data?.data || [];

  const STATUS_FILTERS = [
    { value:'all',     label:'All'     },
    { value:'trial',   label:'Trial'   },
    { value:'active',  label:'Active'  },
    { value:'expired', label:'Expired' },
  ];

  const columns = [
    { label:'User ID',  render: r => (
      <code style={{ fontFamily:'var(--font-mono)', fontSize:12, background:'var(--brand-light)', color:'var(--brand)', padding:'3px 8px', borderRadius:6, fontWeight:700 }}>
        {r.user_id || '—'}
      </code>
    )},
    { label:'Hotel', sort: r => r.hotel_name, render: r => (
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {r.logo_url
          ? <img src={r.logo_url} alt="" style={{ width:28, height:28, borderRadius:6, objectFit:'contain', border:'1px solid var(--border)' }} />
          : <div style={{ width:28, height:28, borderRadius:6, background:'var(--brand-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🏨</div>
        }
        <div>
          <div style={{ fontWeight:700 }}>{r.hotel_name}</div>
          <div style={{ fontSize:12, color:'var(--gray-400)' }}>{r.email}</div>
        </div>
      </div>
    )},
    { label:'Phone',  sort: r => r.phone, render: r => r.phone },
    { label:'Status', sort: r => r.subscription_status, render: r => <Badge status={r.subscription_status} label={
      r.subscription_status === 'trial'
        ? `Trial (${Math.max(0, Math.ceil((new Date(r.trial_end_date) - Date.now()) / 86400000))}d left)`
        : r.subscription_status
    } /> },
    { label:'Plan',   render: r => r.current_plan ? <Badge status="active" label={r.current_plan.name} /> : <span style={{ color:'var(--gray-300)' }}>—</span> },
    { label:'Registered', sort: r => new Date(r.created_at).getTime(), render: r => new Date(r.created_at).toLocaleDateString('en-IN') },
    { label:'Actions', render: r => (
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        <button className="btn btn-sm" style={{ background:'var(--brand-light)', color:'var(--brand)', border:'1px solid var(--brand)', borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:700, cursor:'pointer' }}
          onClick={() => setViewCreds(r)}>
          🔑 Credentials
        </button>
        <button className="btn btn-sm btn-brand" onClick={() => setAct(r)}>Activate</button>
        <button className="btn btn-sm btn-outline" onClick={() => sendReminder(r)}>Remind</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Hotel List" subtitle="All registered hotels — view credentials, activate plans, send reminders" />

      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <FilterBar filters={STATUS_FILTERS} active={filter} onChange={setFilter} />
        <div style={{ position:'relative', flex:1, minWidth:200, maxWidth:300 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)', fontSize:14 }}>🔍</span>
          <input className="form-control" style={{ paddingLeft:34 }} placeholder="Search hotel or email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        {loading ? <TableSkeleton cols={columns.length} /> : (
          <>
            <div style={{ fontSize:13, color:'var(--gray-400)', marginBottom:12 }}>{data?.total || 0} hotels found</div>
            <Table columns={columns} data={hotels} emptyMessage="No hotels found" pageSize={10} />
          </>
        )}
      </Card>

      <CredentialsModal hotel={viewCreds} open={!!viewCreds} onClose={() => setViewCreds(null)} />
      {activating && (
        <ActivatePlanModal hotel={activating} plans={plans} open={!!activating}
          onClose={() => setAct(null)} onSuccess={refetch} />
      )}
    </div>
  );
};

export default HotelList;
