// ─── Paid Hotels ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useFetch } from '../../utils/hooks';
import { PageHeader, Badge, Card, Table, Spinner, TableSkeleton, StatCard, BarChart } from '../../components/shared/UI';
import '../../components/shared/UI.css';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtCur  = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

export const PaidHotels = () => {
  const { data, loading } = useFetch('/superadmin/paid-hotels');
  const hotels = data?.data || [];

  const columns = [
    { label:'Hotel Name', render: r => <strong>{r.hotelName}</strong> },
    { label:'Email',      render: r => r.email },
    { label:'Plan',       render: r => r.currentPlan ? <Badge status="active" label={r.currentPlan.name}/> : '—' },
    { label:'Valid From', render: r => fmtDate(r.planValidFrom) },
    { label:'Valid To',   render: r => fmtDate(r.planValidTo) },
    { label:'Status',     render: r => {
      const daysLeft = r.planValidTo ? Math.ceil((new Date(r.planValidTo)-Date.now())/86400000) : 0;
      return <Badge status={r.subscriptionStatus} label={
        r.subscriptionStatus==='active' && daysLeft <= 7
          ? `Expiring in ${daysLeft}d` : r.subscriptionStatus
      }/>;
    }},
    { label:'Action', render: r => (
      <button className="btn btn-sm btn-outline" onClick={async () => {
        try { await api.post(`/superadmin/reminders/${r._id}`); toast.success('Reminder sent!'); }
        catch { toast.error('Failed'); }
      }}>Remind</button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Paid Hotels" subtitle="Hotels with active or expired subscription plans" />
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : <Table columns={columns} data={hotels} emptyMessage="No paid hotels yet" />}</Card>
    </div>
  );
};

// ─── Payment History ──────────────────────────────────────────────────────────
export const PaymentHistory = () => {
  const { data, loading } = useFetch('/superadmin/payments');
  const payments = data?.data || [];

  const columns = [
    { label:'Hotel',      render: r => <strong>{r.hotel?.hotelName}</strong> },
    { label:'Email',      render: r => r.hotel?.email },
    { label:'Amount',     render: r => <strong style={{color:'var(--success)'}}>{fmtCur(r.amount)}</strong> },
    { label:'Plan',       render: r => <Badge status="active" label={r.plan?.name}/> },
    { label:'Valid From', render: r => fmtDate(r.validFrom) },
    { label:'Valid To',   render: r => fmtDate(r.validTo) },
    { label:'Invoice',    render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.invoiceNumber}</code> },
    { label:'Payment ID', render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.paymentId}</code> },
    { label:'Date',       render: r => fmtDate(r.paidAt) },
    { label:'Invoice',    render: r => (
      <button className="btn btn-sm btn-outline" onClick={() => toast.success('Invoice download — connect PDF service')}>⬇ PDF</button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Payment History" subtitle="All transactions across the platform" />
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <StatCard icon="💰" label="Total Revenue"     value={fmtCur(data?.totalRevenue)} color="green" />
        <StatCard icon="🧾" label="Total Invoices"    value={data?.total || 0}           color="blue" />
        <StatCard icon="📅" label="This Month"        value={fmtCur(payments.filter(p=>new Date(p.paidAt).getMonth()===new Date().getMonth()).reduce((a,p)=>a+p.amount,0))} color="amber" />
      </div>
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : <Table columns={columns} data={payments} emptyMessage="No payments yet" />}</Card>
    </div>
  );
};

// ─── Manage Plans ─────────────────────────────────────────────────────────────
export const ManagePlans = () => {
  const { data, loading, refetch } = useFetch('/superadmin/plans');
  const plans = data?.data || [];
  const [editing, setEditing]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', price:'', durationDays:30, maxRooms:'', isPopular:false, features:'' });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name:'', price:'', durationDays:30, maxRooms:'', isPopular:false, features:'' });
    setShowForm(true);
  };
  const openEdit = (plan) => {
    setEditing(plan);
    setForm({ ...plan, features: plan.features?.join(', ') || '' });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, features: form.features.split(',').map(s=>s.trim()).filter(Boolean), price: Number(form.price), maxRooms: Number(form.maxRooms), durationDays: Number(form.durationDays) };
      if (editing) await api.put(`/superadmin/plans/${editing._id}`, payload);
      else         await api.post('/superadmin/plans', payload);
      toast.success(editing ? 'Plan updated!' : 'Plan created!');
      refetch(); setShowForm(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deletePlan = async (id) => {
    if (!window.confirm('Delete this plan?')) return;
    try { await api.delete(`/superadmin/plans/${id}`); toast.success('Plan deleted'); refetch(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <PageHeader title="Manage Plans" subtitle="Configure subscription plans for hotels"
        action={<button className="btn btn-brand" onClick={openAdd}>+ Add Plan</button>} />

      {loading ? <Spinner /> : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:20}}>
          {plans.map(plan => (
            <div key={plan._id} className="card" style={{border: plan.isPopular?'2px solid var(--accent)':undefined, position:'relative'}}>
              {plan.isPopular && <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#fff',padding:'3px 14px',borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>MOST POPULAR</div>}
              <div style={{fontSize:18,fontWeight:800,color:'var(--gray-900)',marginBottom:4}}>{plan.name}</div>
              <div style={{fontSize:30,fontWeight:800,color:'var(--brand)',marginBottom:4}}>₹{plan.price}<span style={{fontSize:14,color:'var(--gray-400)',fontWeight:400}}>/mo</span></div>
              <div style={{fontSize:12,color:'var(--gray-400)',marginBottom:12}}>{plan.durationDays} days · up to {plan.maxRooms >= 999999 ? 'unlimited' : plan.maxRooms} rooms</div>
              <div style={{marginBottom:16}}>
                {plan.features?.map((f,i) => <div key={i} style={{fontSize:13,color:'var(--gray-600)',padding:'3px 0'}}>✓ {f}</div>)}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-sm btn-outline" style={{flex:1}} onClick={() => openEdit(plan)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deletePlan(plan._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Edit Plan' : 'Add New Plan'}</div>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Plan Name *</label>
                    <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">Price (₹/mo) *</label>
                    <input className="form-control" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Duration (days)</label>
                    <input className="form-control" type="number" value={form.durationDays} onChange={e=>setForm(f=>({...f,durationDays:e.target.value}))} /></div>
                  <div className="form-group"><label className="form-label">Max Rooms</label>
                    <input className="form-control" type="number" value={form.maxRooms} onChange={e=>setForm(f=>({...f,maxRooms:e.target.value}))} /></div>
                </div>
                <div className="form-group"><label className="form-label">Features (comma separated)</label>
                  <textarea className="form-control" rows={3} value={form.features} onChange={e=>setForm(f=>({...f,features:e.target.value}))} placeholder="Up to 50 rooms, QR Management, Analytics" /></div>
                <label className="checkbox-row" style={{marginBottom:20}}>
                  <input type="checkbox" checked={form.isPopular} onChange={e=>setForm(f=>({...f,isPopular:e.target.checked}))} /> Mark as Most Popular
                </label>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-brand" disabled={saving}>{saving?'Saving…':'Save Plan'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Email Reminders ──────────────────────────────────────────────────────────
export const EmailReminders = () => {
  const { data, loading } = useFetch('/superadmin/hotels?status=trial');
  const { data: expData }  = useFetch('/superadmin/paid-hotels');

  const trialHotels  = (data?.data   || []).filter(h => h.subscriptionStatus === 'trial');
  const expiringHotels = (expData?.data || []).filter(h => {
    if (!h.planValidTo) return false;
    const days = Math.ceil((new Date(h.planValidTo)-Date.now())/86400000);
    return days <= 7 && days >= 0;
  });

  const sendReminder = async (hotel) => {
    try { await api.post(`/superadmin/reminders/${hotel._id}`); toast.success(`Reminder sent to ${hotel.email}`); }
    catch { toast.error('Failed'); }
  };

  const sendAll = async (list) => {
    let count = 0;
    for (const h of list) {
      try { await api.post(`/superadmin/reminders/${h._id}`); count++; } catch {}
    }
    toast.success(`Sent ${count} reminder(s)`);
  };

  return (
    <div>
      <PageHeader title="Email Reminders" subtitle="Manually trigger reminder emails to hotels" />

      <Card>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div className="card-title">Trial Ending Hotels ({trialHotels.length})</div>
          {trialHotels.length > 0 && <button className="btn btn-sm btn-brand" onClick={()=>sendAll(trialHotels)}>Send All</button>}
        </div>
        {loading ? <Spinner /> : (
          <Table
            columns={[
              { label:'Hotel',       render: r => <strong>{r.hotelName}</strong> },
              { label:'Email',       render: r => r.email },
              { label:'Trial Ends',  render: r => {
                const d = Math.max(0,Math.ceil((new Date(r.trialEndDate)-Date.now())/86400000));
                return <span style={{color:d<=1?'var(--danger)':'var(--warning)',fontWeight:700}}>{d} days left</span>;
              }},
              { label:'Action', render: r => <button className="btn btn-sm btn-brand" onClick={()=>sendReminder(r)}>Send Reminder</button> },
            ]}
            data={trialHotels}
            emptyMessage="No hotels on trial"
          />
        )}
      </Card>

      <Card>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div className="card-title">Subscriptions Expiring in 7 Days ({expiringHotels.length})</div>
          {expiringHotels.length > 0 && <button className="btn btn-sm btn-brand" onClick={()=>sendAll(expiringHotels)}>Send All</button>}
        </div>
        <Table
          columns={[
            { label:'Hotel',      render: r => <strong>{r.hotelName}</strong> },
            { label:'Email',      render: r => r.email },
            { label:'Plan',       render: r => r.currentPlan?.name || '—' },
            { label:'Expires',    render: r => {
              const d = Math.max(0,Math.ceil((new Date(r.planValidTo)-Date.now())/86400000));
              return <span style={{color:d<=3?'var(--danger)':'var(--warning)',fontWeight:700}}>{d} days left</span>;
            }},
            { label:'Action', render: r => <button className="btn btn-sm btn-brand" onClick={()=>sendReminder(r)}>Send Reminder</button> },
          ]}
          data={expiringHotels}
          emptyMessage="No subscriptions expiring soon 🎉"
        />
      </Card>
    </div>
  );
};

// ─── Overall Summary ─────────────────────────────────────────────────────────
export const OverallSummary = () => {
  const { data, loading } = useFetch('/superadmin/summary');
  if (loading) return <Spinner />;
  const s = data?.data?.stats || {};
  const monthly = data?.data?.monthlyRevenue || [];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chartData = monthly.map(m => ({ label: MONTHS[m._id.month-1], label2: `₹${Math.round(m.revenue/1000)}k`, value: m.revenue }));

  return (
    <div>
      <PageHeader title="Overall Summary" subtitle="Platform-wide performance metrics" />
      <div className="stats-grid">
        <StatCard icon="🏨" label="Total Hotels"      value={s.totalHotels || 0}          color="blue" />
        <StatCard icon="✅" label="Active Hotels"     value={s.activeHotels || 0}         color="green" />
        <StatCard icon="⏳" label="On Trial"          value={s.trialHotels || 0}          color="amber" />
        <StatCard icon="❌" label="Expired Hotels"    value={s.expiredHotels || 0}        color="red" />
      </div>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
        <StatCard icon="💰" label="Total Revenue"    value={fmtCur(s.totalRevenue)}       color="green" />
        <StatCard icon="📊" label="Active Rate"      value={s.totalHotels ? `${Math.round((s.activeHotels/s.totalHotels)*100)}%` : '0%'} color="blue" />
      </div>
      <Card>
        <div className="card-title" style={{marginBottom:16}}>Revenue by Month</div>
        {chartData.length > 0 ? <BarChart data={chartData} height={180} /> : <div style={{textAlign:'center',padding:'40px 0',color:'var(--gray-400)'}}>No revenue data yet</div>}
      </Card>
    </div>
  );
};
