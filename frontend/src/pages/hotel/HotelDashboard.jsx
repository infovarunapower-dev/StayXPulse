import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../utils/hooks';
import { PageHeader, StatCard, Card, CardHeader, Badge, Spinner, Table } from '../../components/shared/UI';

const fmtCur  = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';

const TrialBanner = ({ hotel }) => {
  const navigate = useNavigate();
  if (!hotel) return null;
  if (hotel.subscriptionStatus === 'active') {
    const days = hotel.planValidTo ? Math.ceil((new Date(hotel.planValidTo)-Date.now())/86400000) : 0;
    if (days > 7) return null;
    return (
      <div className="trial-banner">
        <span style={{fontSize:20}}>⚠️</span>
        <div className="trial-banner-text">Your plan expires in <strong>{days} day(s)</strong> on {fmtDate(hotel.planValidTo)}. Renew now to avoid interruption.</div>
        <button className="btn btn-sm btn-brand" style={{whiteSpace:'nowrap'}} onClick={() => navigate('/hotel/upgrade')}>Renew Plan</button>
      </div>
    );
  }
  if (hotel.subscriptionStatus === 'trial') {
    const days = Math.max(0,Math.ceil((new Date(hotel.trialEndDate)-Date.now())/86400000));
    return (
      <div className="trial-banner">
        <span style={{fontSize:20}}>⏰</span>
        <div className="trial-banner-text">Free trial active — <strong>{days} day(s) remaining</strong>. Upgrade to keep full access.</div>
        <button className="btn btn-sm btn-brand" style={{whiteSpace:'nowrap'}} onClick={() => navigate('/hotel/upgrade')}>Upgrade Now</button>
      </div>
    );
  }
  if (hotel.subscriptionStatus === 'expired') {
    return (
      <div className="trial-banner" style={{background:'var(--danger-light)',borderColor:'var(--danger)'}}>
        <span style={{fontSize:20}}>🔒</span>
        <div className="trial-banner-text" style={{color:'#991B1B'}}>Your subscription has <strong>expired</strong>. Please renew to restore access.</div>
        <button className="btn btn-sm btn-danger" style={{whiteSpace:'nowrap'}} onClick={() => navigate('/hotel/upgrade')}>Renew Now</button>
      </div>
    );
  }
  return null;
};

const HotelDashboard = () => {
  const { user }           = useAuth();
  const { data, loading }  = useFetch('/hotel/analytics');
  const navigate           = useNavigate();
  const hotel              = user?.hotel;

  if (loading) return <Spinner />;
  const s  = data?.data?.stats       || {};
  const ro = data?.data?.recentOrders || [];

  return (
    <div>
      <TrialBanner hotel={hotel} />

      {/* Hotel Info Card */}
      <div style={{display:'flex',alignItems:'center',gap:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:20,marginBottom:24}}>
        <div style={{width:60,height:60,background:'var(--brand)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>
          {hotel?.logoUrl
            ? <img src={`http://localhost:5000${hotel.logoUrl}`} alt="logo" style={{width:60,height:60,borderRadius:14,objectFit:'cover'}} />
            : '🏨'}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:800,color:'var(--gray-900)'}}>{hotel?.hotelName}</div>
          <div style={{fontSize:13,color:'var(--gray-500)',marginTop:2}}>GST: {hotel?.gstNumber} &nbsp;·&nbsp; {hotel?.phone}</div>
        </div>
        <Badge status={hotel?.subscriptionStatus} label={hotel?.subscriptionStatus} />
      </div>

      <div className="stats-grid">
        <StatCard icon="📋" label="Total Food Orders"   value={s.totalOrders   || 0} color="blue" />
        <StatCard icon="🍽" label="Today's Orders"      value={s.todayOrders   || 0} color="green" />
        <StatCard icon="💰" label="Today's Revenue"     value={fmtCur(s.todayRevenue)} color="amber" />
        <StatCard icon="🛎" label="Pending Requests"    value={s.pendingRequests || 0} color="red" change={s.pendingRequests > 0 ? 'action needed' : undefined} changeType="down" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <Card>
          <CardHeader title="Recent Food Orders" action={<button className="btn btn-sm btn-outline" onClick={() => navigate('/hotel/food-orders')}>View All</button>} />
          <Table
            columns={[
              { label:'Ref',    render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.orderRef}</code> },
              { label:'Room',   render: r => <strong>Room {r.roomNumber}</strong> },
              { label:'Amount', render: r => <strong style={{color:'var(--success)'}}>{fmtCur(r.totalAmount)}</strong> },
              { label:'Time',   render: r => fmtTime(r.createdAt) },
              { label:'Status', render: r => <Badge status={r.status} /> },
            ]}
            data={ro}
            emptyMessage="No orders yet today"
          />
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              { icon:'📱', label:'Add New Room & QR',    to:'/hotel/qr',              color:'var(--brand-light)',    tc:'var(--brand)' },
              { icon:'🍽', label:'Manage Food Menu',     to:'/hotel/food',             color:'var(--success-light)', tc:'#065F46' },
              { icon:'🛎', label:'View Service Requests',to:'/hotel/service-requests', color:'var(--accent-light)',  tc:'#92400E' },
              { icon:'📈', label:'View Analytics',       to:'/hotel/analytics',        color:'var(--gray-100)',       tc:'var(--gray-700)' },
            ].map(a => (
              <button key={a.to} onClick={() => navigate(a.to)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:a.color,border:'none',borderRadius:10,cursor:'pointer',textAlign:'left',transition:'opacity 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.8'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <span style={{fontSize:20}}>{a.icon}</span>
                <span style={{fontFamily:'var(--font)',fontSize:14,fontWeight:600,color:a.tc}}>{a.label}</span>
                <span style={{marginLeft:'auto',color:a.tc,opacity:0.5}}>›</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HotelDashboard;
