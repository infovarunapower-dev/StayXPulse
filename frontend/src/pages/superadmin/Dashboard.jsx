import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../utils/hooks';
import api from '../../utils/api';
import { PageHeader, StatCard, Card, CardHeader, Badge, BarChart, PageSkeleton, Table, Modal } from '../../components/shared/UI';
import '../../components/shared/UI.css';

const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true }) : '—';

// Friendly device/browser from a user-agent string (best-effort).
const deviceOf = (ua = '') => {
  const s = ua || '';
  const browser = /Edg/i.test(s) ? 'Edge' : /OPR|Opera/i.test(s) ? 'Opera' : /Chrome/i.test(s) ? 'Chrome'
    : /Firefox/i.test(s) ? 'Firefox' : /Safari/i.test(s) ? 'Safari' : 'Browser';
  const os = /Android/i.test(s) ? 'Android' : /iPhone|iPad|iOS/i.test(s) ? 'iOS'
    : /Windows/i.test(s) ? 'Windows' : /Mac OS/i.test(s) ? 'Mac' : /Linux/i.test(s) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
};
const sourceOf = (ref = '') => {
  if (!ref) return 'Direct';
  try { return new URL(ref).hostname.replace(/^www\./, ''); } catch { return ref.slice(0, 40); }
};

const Dashboard = () => {
  const { data, loading } = useFetch('/superadmin/summary');
  const navigate = useNavigate();

  // Visitor-detail modal (opened by clicking a Website Visitors card).
  const [visitModal, setVisitModal] = useState({ open: false, range: 'all', title: '' });
  const [visits, setVisits] = useState(null);
  const openVisits = async (range, title) => {
    setVisitModal({ open: true, range, title });
    setVisits(null);
    try {
      const res = await api.get('/superadmin/visits', { params: { range } });
      setVisits(res.data?.data || []);
    } catch { setVisits([]); }
  };

  if (loading) return <PageSkeleton />;
  const s = data?.data?.stats || {};
  const monthly = data?.data?.monthlyRevenue || [];
  const recent  = data?.data?.recentPayments || [];
  const expiring = data?.data?.expiringSoon  || [];
  const v = data?.data?.visitors || null;
  const activeHotels = data?.data?.activeHotels || [];

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chartData = monthly.map(m => ({
    label:  MONTHS[m.month - 1],
    label2: `₹${Math.round(m.revenue / 1000)}k`,
    value:  m.revenue,
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform-wide overview at a glance" />

      <div className="stats-grid">
        <StatCard icon="🏨" label="Total Hotels"   value={s.totalHotels   || 0} color="blue"  onClick={() => navigate('/admin/hotels')} />
        <StatCard icon="✅" label="Active Hotels"  value={s.activeHotels  || 0} color="green" change="subscribed" changeType="up" onClick={() => navigate('/admin/paid-hotels')} />
        <StatCard icon="⏳" label="On Trial"        value={s.trialHotels   || 0} color="amber" onClick={() => navigate('/admin/hotels')} />
        <StatCard icon="💰" label="Total Revenue"  value={fmtCurrency(s.totalRevenue)} color="green" onClick={() => navigate('/admin/payments')} />
      </div>

      {v && (
        <>
          <div style={{ margin: '22px 0 10px', fontWeight: 700, fontSize: 15, color: 'var(--gray-700)' }}>
            Website Visitors
          </div>
          <div className="stats-grid">
            <StatCard icon="👣" label="Total Visits"    value={v.total  || 0} color="blue"  onClick={() => openVisits('all', 'All visits')} />
            <StatCard icon="🧑" label="Unique Visitors"  value={v.unique || 0} color="green" onClick={() => openVisits('all', 'All visits')} />
            <StatCard icon="📅" label="Today"            value={v.today  || 0} color="amber" onClick={() => openVisits('today', "Today's visits")} />
            <StatCard icon="📈" label="Last 7 Days"      value={v.last7  || 0} color="blue"  onClick={() => openVisits('7d', 'Last 7 days')} />
          </div>

          <div className="grid-2">
            {/* Top pages */}
            <Card>
              <CardHeader title="Top Pages" />
              {(Array.isArray(v.topPaths) && v.topPaths.length > 0)
                ? v.topPaths.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{p.path}</span>
                    <span style={{ color: 'var(--gray-500)', fontVariantNumeric: 'tabular-nums' }}>{p.visits} visits</span>
                  </div>
                ))
                : <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray-400)', fontSize: 13 }}>No visits yet</div>}
            </Card>

            {/* Recently active hotels (name + email) */}
            <Card>
              <CardHeader title="Recently Active Hotels" />
              {(activeHotels.length > 0)
                ? activeHotels.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.hotelName}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.email}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap', marginLeft: 10 }}>{fmtDateTime(h.lastLogin)}</span>
                  </div>
                ))
                : <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray-400)', fontSize: 13 }}>No logins recorded yet</div>}
            </Card>
          </div>
        </>
      )}

      {/* Visitor-detail modal (anonymous — page, time, source, device) */}
      <Modal open={visitModal.open} onClose={() => setVisitModal({ ...visitModal, open: false })} title={`Visitor details — ${visitModal.title}`} width={720}>
        {visits === null
          ? <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray-400)' }}>Loading…</div>
          : visits.length === 0
            ? <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray-400)' }}>No visits in this range.</div>
            : (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>Visitors are anonymous — showing the latest {visits.length} page views.</div>
                <Table
                  columns={[
                    { key: 'created_at', label: 'Time', render: (r) => fmtDateTime(r.created_at) },
                    { key: 'path', label: 'Page' },
                    { key: 'referrer', label: 'Source', render: (r) => sourceOf(r.referrer) },
                    { key: 'user_agent', label: 'Device', render: (r) => deviceOf(r.user_agent) },
                  ]}
                  data={visits}
                />
              </div>
            )}
      </Modal>

      <div className="grid-2">
        {/* Monthly Revenue chart */}
        <Card>
          <CardHeader title="Monthly Revenue" action={
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/admin/payments')}>View All</button>
          }/>
          {chartData.length > 0
            ? <BarChart data={chartData} height={160} />
            : <div style={{textAlign:'center',padding:'40px 0',color:'var(--gray-400)'}}>No payment data yet</div>
          }
        </Card>

        {/* Expiring soon */}
        <Card>
          <CardHeader title="Expiring Soon" action={
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/admin/paid-hotels')}>View All</button>
          }/>
          {expiring.length === 0
            ? <div style={{textAlign:'center',padding:'30px 0',color:'var(--gray-400)',fontSize:13}}>🎉 No hotels expiring in 7 days</div>
            : expiring.map(h => (
              <div key={h.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{h.hotel_name}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)'}}>{h.email}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--danger)'}}>Expires {fmtDate(h.plan_valid_to)}</div>
                  <button className="btn btn-sm btn-brand" style={{marginTop:4}}
                    onClick={() => navigate(`/admin/hotels`)}>Remind</button>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader title="Recent Payments" action={
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/admin/payments')}>View All</button>
        }/>
        <Table
          columns={[
            { label: 'Hotel',    render: r => <strong>{r.hotel?.hotelName}</strong> },
            { label: 'Plan',     render: r => <Badge status="active" label={r.plan?.name} /> },
            { label: 'Amount',   render: r => <strong>{fmtCurrency(r.amount)}</strong> },
            { label: 'Valid To', render: r => fmtDate(r.valid_to) },
            { label: 'Invoice',  render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:12,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.invoice_number}</code> },
          ]}
          data={recent}
          emptyMessage="No payments yet"
        />
      </Card>
    </div>
  );
};

export default Dashboard;
