import React from 'react';
import { useFetch } from '../../utils/hooks';
import { PageHeader, StatCard, Card, CardHeader, Spinner, BarChart } from '../../components/shared/UI';

const fmtCur = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

const Analytics = () => {
  const { data, loading, refetch } = useFetch('/hotel/analytics');
  if (loading) return <Spinner />;
  const s    = data?.data?.stats         || {};
  const top  = data?.data?.topItems      || [];
  const daily= data?.data?.dailyOrders   || [];
  const cats = data?.data?.categoryRevenue || [];

  const maxTop = Math.max(...top.map(t=>t.total),1);
  const maxCat = Math.max(...cats.map(c=>c.revenue),1);

  // Build 7-day chart (fill gaps with 0)
  const dayLabels = [];
  for (let i=6;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    dayLabels.push(d.toISOString().split('T')[0]);
  }
  const dailyMap = {};
  daily.forEach(d => { dailyMap[d._id] = { count:d.count, revenue:d.revenue }; });
  const ordersChart  = dayLabels.map(d => ({ label: d.slice(5).replace('-','/'), label2: String(dailyMap[d]?.count||0), value: dailyMap[d]?.count||0 }));
  const revenueChart = dayLabels.map(d => ({ label: d.slice(5).replace('-','/'), label2: dailyMap[d]?.revenue ? `₹${Math.round(dailyMap[d].revenue/1000)}k` : '₹0', value: dailyMap[d]?.revenue||0 }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Performance metrics for your hotel"
        action={<button className="btn btn-sm btn-outline" onClick={refetch}>↻ Refresh</button>}
      />

      <div className="stats-grid">
        <StatCard icon="📋" label="Total Orders"      value={s.totalOrders    || 0} color="blue" />
        <StatCard icon="🍽" label="Today's Orders"    value={s.todayOrders    || 0} color="green" />
        <StatCard icon="💰" label="Total Revenue"     value={fmtCur(s.totalRevenue)} color="amber" />
        <StatCard icon="💵" label="Today's Revenue"   value={fmtCur(s.todayRevenue)} color="green" />
      </div>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
        <StatCard icon="🛎" label="Total Service Requests" value={s.totalRequests   || 0} color="blue" />
        <StatCard icon="⚠️" label="Pending Requests"       value={s.pendingRequests || 0} color="red" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
        <Card>
          <CardHeader title="Daily Orders (Last 7 Days)" />
          <BarChart data={ordersChart} height={160} color="var(--brand)" />
        </Card>
        <Card>
          <CardHeader title="Daily Revenue (Last 7 Days)" />
          <BarChart data={revenueChart} height={160} color="var(--accent)" />
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <Card>
          <CardHeader title="Top 5 Food Items" />
          {top.length === 0
            ? <div style={{textAlign:'center',padding:'30px 0',color:'var(--gray-400)',fontSize:13}}>No order data yet</div>
            : top.map((item,i) => (
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
                  <span style={{fontWeight:600}}>{item._id}</span>
                  <span style={{color:'var(--gray-500)'}}>{item.total} ordered</span>
                </div>
                <div style={{height:7,background:'var(--gray-100)',borderRadius:4}}>
                  <div style={{height:7,background:'var(--brand)',borderRadius:4,width:`${(item.total/maxTop)*100}%`,transition:'width 0.5s'}} />
                </div>
              </div>
            ))
          }
        </Card>

        <Card>
          <CardHeader title="Revenue by Category" />
          {cats.length === 0
            ? <div style={{textAlign:'center',padding:'30px 0',color:'var(--gray-400)',fontSize:13}}>No revenue data yet</div>
            : cats.map((cat,i) => (
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
                  <span style={{fontWeight:600}}>{cat._id}</span>
                  <span style={{color:'var(--success)',fontWeight:600}}>{fmtCur(cat.revenue)}</span>
                </div>
                <div style={{height:7,background:'var(--gray-100)',borderRadius:4}}>
                  <div style={{height:7,background:'var(--accent)',borderRadius:4,width:`${(cat.revenue/maxCat)*100}%`,transition:'width 0.5s'}} />
                </div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
