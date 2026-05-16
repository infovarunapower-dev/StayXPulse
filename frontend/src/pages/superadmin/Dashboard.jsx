import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../utils/hooks';
import { PageHeader, StatCard, Card, CardHeader, Badge, BarChart, Spinner, Table } from '../../components/shared/UI';
import '../../components/shared/UI.css';

const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const Dashboard = () => {
  const { data, loading } = useFetch('/superadmin/summary');
  const navigate = useNavigate();

  if (loading) return <Spinner />;
  const s = data?.data?.stats || {};
  const monthly = data?.data?.monthlyRevenue || [];
  const recent  = data?.data?.recentPayments || [];
  const expiring = data?.data?.expiringSoon  || [];

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chartData = monthly.map(m => ({
    label:  MONTHS[m._id.month - 1],
    label2: `₹${Math.round(m.revenue / 1000)}k`,
    value:  m.revenue,
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform-wide overview at a glance" />

      <div className="stats-grid">
        <StatCard icon="🏨" label="Total Hotels"   value={s.totalHotels   || 0} color="blue" />
        <StatCard icon="✅" label="Active Hotels"  value={s.activeHotels  || 0} color="green" change="subscribed" changeType="up" />
        <StatCard icon="⏳" label="On Trial"        value={s.trialHotels   || 0} color="amber" />
        <StatCard icon="💰" label="Total Revenue"  value={fmtCurrency(s.totalRevenue)} color="green" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
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
              <div key={h._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{h.hotelName}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)'}}>{h.email}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--danger)'}}>Expires {fmtDate(h.planValidTo)}</div>
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
            { label: 'Valid To', render: r => fmtDate(r.validTo) },
            { label: 'Invoice',  render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:12,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.invoiceNumber}</code> },
          ]}
          data={recent}
          emptyMessage="No payments yet"
        />
      </Card>
    </div>
  );
};

export default Dashboard;
