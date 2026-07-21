import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../utils/hooks';
import { StatCard, Card, CardHeader, Badge, PageSkeleton, Table } from '../../components/shared/UI';

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

  if (loading) return <PageSkeleton />;
  const s  = data?.data?.stats       || {};
  const ro = data?.data?.recentOrders || [];

  return (
    <div>
      <TrialBanner hotel={hotel} />

      {/* Hotel Hero Banner */}
      <div className="dash-hero">
        <div className={`dash-hero-logo ${hotel?.logoUrl ? 'has-img' : ''}`}>
          {hotel?.logoUrl ? <img src={hotel.logoUrl} alt="" /> : '🏨'}
        </div>
        <div className="dash-hero-body">
          <div className="dash-hero-eyebrow">Welcome back 👋</div>
          <div className="dash-hero-name">{hotel?.hotelName || 'Your Hotel'}</div>
          <div className="dash-hero-meta">
            {hotel?.gstNumber && <>GST {hotel.gstNumber}&nbsp;&nbsp;·&nbsp;&nbsp;</>}
            {hotel?.phone || '—'}
          </div>
        </div>
        <div className="dash-hero-side">
          <Badge status={hotel?.subscriptionStatus} label={hotel?.subscriptionStatus} />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="📋" label="Total Food Orders"   value={s.totalOrders   || 0} color="blue" />
        <StatCard icon="🍽" label="Today's Orders"      value={s.todayOrders   || 0} color="green" />
        <StatCard icon="💰" label="Today's Revenue"     value={fmtCur(s.todayRevenue)} color="amber" />
        <StatCard icon="🛎" label="Pending Requests"    value={s.pendingRequests || 0} color="red" change={s.pendingRequests > 0 ? 'action needed' : undefined} changeType="down" />
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="Recent Food Orders" action={<button className="btn btn-sm btn-outline" onClick={() => navigate('/hotel/food-orders')}>View All</button>} />
          <Table
            columns={[
              { label:'Ref',    render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.id}</code> },
              { label:'Room',   render: r => <strong>Room {r.room_number}</strong> },
              { label:'Amount', render: r => <strong style={{color:'var(--success)'}}>{fmtCur(r.total_amount)}</strong> },
              { label:'Time',   render: r => fmtTime(r.created_at) },
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
              { icon:'📱', label:'Add New Room & QR',    to:'/hotel/qr',               bg:'var(--brand-light)'   },
              { icon:'🍽', label:'Manage Food Menu',     to:'/hotel/food',             bg:'var(--success-light)' },
              { icon:'🛎', label:'View Service Requests',to:'/hotel/service-requests', bg:'var(--accent-light)'  },
              { icon:'📈', label:'View Analytics',       to:'/hotel/analytics',        bg:'var(--gray-100)'      },
            ].map(a => (
              <button key={a.to} className="qa-row" onClick={() => navigate(a.to)}>
                <span className="qa-icon" style={{background:a.bg}}>{a.icon}</span>
                <span className="qa-label">{a.label}</span>
                <span className="qa-chevron">›</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HotelDashboard;
