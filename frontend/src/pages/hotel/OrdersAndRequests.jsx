import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Badge, Card, Table, FilterBar, TableSkeleton } from '../../components/shared/UI';

const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—';

// Icon per service-request type + a status colour for the premium card's rail.
const REQ_ICON = {
  'Extra Towels / Toiletries':'🛁','Room Cleaning':'🧹','AC / Heating Issue':'❄️','Extra Pillow / Blanket':'🛏',
  'Electrical Issue':'💡','Wake-up Call':'⏰','Room Key Issue':'🔒','Hot Water Issue':'🚿',
  'Dining Table Setup':'🍽','Laundry Service':'🧺','Noise Complaint':'🔇','TV / WiFi Issue':'📡','Cab Request':'🚕',
};
const reqIcon = t => REQ_ICON[t] || '🛎';
const railColor = s =>
  s === 'pending' ? '#F59E0B'
  : (s === 'in-progress' || s === 'preparing') ? '#2563EB'
  : (s === 'completed' || s === 'delivered') ? '#059669'
  : s === 'cancelled' ? '#DC2626' : '#9CA3AF';

const DATE_FILTERS = [
  { value:'all',       label:'📅 All Dates' },
  { value:'today',     label:'Today'     },
  { value:'yesterday', label:'Yesterday' },
];
const STATUS_FILTERS = [
  { value:'all',       label:'Any Status' },
  { value:'pending',   label:'Pending'   },
  { value:'completed', label:'Completed' },
];
// Food orders never have status 'completed' — they go pending → preparing →
// delivered. A "Completed" filter would query status=completed and always
// return nothing, so food orders get their own set.
const FOOD_STATUS_FILTERS = [
  { value:'all',       label:'Any Status' },
  { value:'pending',   label:'Pending'   },
  { value:'preparing', label:'Preparing' },
  { value:'delivered', label:'Delivered' },
];

// ── Service Requests ──────────────────────────────────────────────────────────
export const ServiceRequests = () => {
  const [data,       setData]      = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [dateFilter, setDateF]     = useState('today');
  const [statusFilter,setStatusF] = useState('all');
  const [customFrom, setFrom]      = useState('');
  const [customTo,   setTo]        = useState('');
  const [pending,    setPending]   = useState(0);
  const [total,      setTotal]     = useState(0);
  const REFRESH_MS = 5000;

  const load = useCallback(async () => {
    try {
      let url = `/hotel/service-requests?filter=${dateFilter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (customFrom && customTo)  url += `&from=${customFrom}&to=${customTo}`;
      const r = await api.get(url);
      setData(r.data.data);
      setTotal(r.data.total);
      setPending(r.data.pendingCount);
    } catch { /* silent on auto-refresh */ }
    finally { setLoading(false); }
  }, [dateFilter, statusFilter, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 30s
  useEffect(() => { const id = setInterval(load, REFRESH_MS); return () => clearInterval(id); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/hotel/service-requests/${id}/status`, { status });
      toast.success(`Marked as ${status}`);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const columns = [
    { label:'Ref',     render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4}}>{r.id}</code> },
    { label:'Room',    sort: r => r.room_number, render: r => <strong>Room {r.room_number}</strong> },
    { label:'Request', sort: r => r.type, render: r => (
      <div>
        <div style={{fontWeight:600}}>{r.type}</div>
        {r.scheduled_for
          ? <div style={{display:'inline-block',marginTop:3,fontSize:12,fontWeight:700,color:'#B45309',background:'#FEF3C7',padding:'2px 8px',borderRadius:6}}>
              ⏰ {new Date(r.scheduled_for).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})}
            </div>
          : r.note && <div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>{r.note}</div>}
      </div>
    )},
    { label:'Time',    sort: r => new Date(r.created_at).getTime(), render: r => <div style={{fontSize:12}}><div>{fmtDate(r.created_at)}</div><div style={{color:'var(--gray-400)'}}>{fmtTime(r.created_at)}</div></div> },
    { label:'Status',  sort: r => r.status, render: r => <Badge status={r.status} /> },
    { label:'Action',  render: r => (
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {r.status === 'pending' && <>
          <button className="btn btn-sm btn-outline" style={{borderColor:'var(--brand)',color:'var(--brand)'}} onClick={()=>updateStatus(r.id,'in-progress')}>In Progress</button>
          <button className="btn btn-sm btn-success" onClick={()=>updateStatus(r.id,'completed')}>✓ Done</button>
        </>}
        {r.status === 'in-progress' && <button className="btn btn-sm btn-success" onClick={()=>updateStatus(r.id,'completed')}>✓ Complete</button>}
        {r.status === 'completed' && <span style={{fontSize:12,color:'var(--gray-400)'}}>Completed {r.completed_at ? fmtTime(r.completed_at) : ''}</span>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Service Requests"
        subtitle={<span>Auto-refreshes every 5s &nbsp;·&nbsp; <span style={{color:pending>0?'var(--danger)':'var(--success)',fontWeight:700}}>{pending} pending</span></span>}
        action={<button className="btn btn-sm btn-outline" onClick={load}>↻ Refresh</button>}
      />
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
        <FilterBar filters={DATE_FILTERS}   active={dateFilter}   onChange={v=>{setDateF(v);setFrom('');setTo('');}} />
        <FilterBar filters={STATUS_FILTERS} active={statusFilter} onChange={setStatusF} />
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customFrom} onChange={e=>{setFrom(e.target.value);setDateF('custom');}} />
          <span style={{color:'var(--gray-400)',fontSize:13}}>to</span>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customTo} onChange={e=>{setTo(e.target.value);setDateF('custom');}} />
        </div>
      </div>
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : (
        <>
          <div style={{fontSize:13,color:'var(--gray-400)',marginBottom:10}}>{total} requests found</div>
          {/* Desktop: table */}
          <div className="sxp-only-desktop">
            <Table columns={columns} data={data} emptyMessage="No service requests found" pageSize={10} />
          </div>
          {/* Mobile: tap-friendly cards — no sideways scrolling to reach actions */}
          <div className="sxp-only-mobile">
            {data.length === 0
              ? <div style={{textAlign:'center',padding:'24px 0',color:'var(--gray-400)'}}>No service requests found</div>
              : data.map(r => (
                <div key={r.id} className="sxp-pcard">
                  <div className="sxp-prail" style={{background:railColor(r.status)}} />
                  <div className="sxp-ptop">
                    <div className="sxp-pav"><span className="rn">{r.room_number}</span><span className="rl">Room</span></div>
                    <div className="sxp-pmid">
                      <div className="sxp-preq">{reqIcon(r.type)} {r.type}</div>
                      <div className="sxp-ptime">{fmtDate(r.created_at)} · {fmtTime(r.created_at)}</div>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  {r.scheduled_for
                    ? <div className="sxp-pchip">⏰ Due {new Date(r.scheduled_for).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})}</div>
                    : r.note && <div className="sxp-pnote">{r.note}</div>}
                  <div className="sxp-pdiv" />
                  <div className="sxp-pactions">
                    {r.status === 'pending' && <>
                      <button className="btn btn-sm sxp-pghost" onClick={()=>updateStatus(r.id,'in-progress')}>In Progress</button>
                      <button className="btn btn-sm btn-success" onClick={()=>updateStatus(r.id,'completed')}>✓ Done</button>
                    </>}
                    {r.status === 'in-progress' && <button className="btn btn-sm btn-success" onClick={()=>updateStatus(r.id,'completed')}>✓ Complete</button>}
                    {r.status === 'completed' && <span style={{fontSize:12,color:'var(--gray-400)',alignSelf:'center',flex:1,textAlign:'center'}}>✓ Completed {r.completed_at ? fmtTime(r.completed_at) : ''}</span>}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}</Card>
    </div>
  );
};

// ── Food Orders ───────────────────────────────────────────────────────────────
export const FoodOrders = () => {
  const [data,        setData]     = useState([]);
  const [loading,     setLoading]  = useState(true);
  const [dateFilter,  setDateF]    = useState('today');
  const [statusFilter,setStatusF] = useState('all');
  const [customFrom,  setFrom]     = useState('');
  const [customTo,    setTo]       = useState('');
  const [pending,     setPending]  = useState(0);
  const [total,       setTotal]    = useState(0);
  const [expanded,    setExpanded] = useState(null);
  const REFRESH_MS = 30000;

  const load = useCallback(async () => {
    try {
      let url = `/hotel/food-orders?filter=${dateFilter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (customFrom && customTo)  url += `&from=${customFrom}&to=${customTo}`;
      const r = await api.get(url);
      setData(r.data.data);
      setTotal(r.data.total);
      setPending(r.data.pendingCount);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [dateFilter, statusFilter, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, REFRESH_MS); return () => clearInterval(id); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/hotel/food-orders/${id}/status`, { status });
      toast.success(`Order marked as ${status}`);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const STATUS_OPTS = ['pending','preparing','delivered','cancelled'];
  const fmtCur = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

  const columns = [
    { label:'Order Ref', render: r => <code style={{fontFamily:'var(--font-mono)',fontSize:11,background:'var(--gray-100)',padding:'2px 6px',borderRadius:4,cursor:'pointer'}} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>{r.id} {expanded===r.id?'▲':'▼'}</code> },
    { label:'Room',    sort: r => r.room_number, render: r => <strong>Room {r.room_number}</strong> },
    { label:'Items',   render: r => (
      <div>
        <div style={{fontSize:13}}>{r.items?.slice(0,2).map(i=>`${i.name} ×${i.quantity}`).join(', ')}{r.items?.length>2?` +${r.items.length-2} more`:''}</div>
        {expanded===r.id && (
          <div style={{marginTop:8,background:'var(--gray-50)',borderRadius:8,padding:10}}>
            {r.items?.map((i,idx)=>(
              <div key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0',borderBottom:idx<r.items.length-1?'1px solid var(--border)':'none'}}>
                <span>{i.name} × {i.quantity}</span>
                <span style={{fontWeight:600}}>{fmtCur(i.price*i.quantity)}</span>
              </div>
            ))}
            {r.guest_note && <div style={{marginTop:8,fontSize:12,color:'var(--gray-500)'}}>Note: {r.guest_note}</div>}
          </div>
        )}
      </div>
    )},
    { label:'Amount',  sort: r => r.total_amount, render: r => <strong style={{color:'var(--success)'}}>{fmtCur(r.total_amount)}</strong> },
    { label:'Time',    sort: r => new Date(r.created_at).getTime(), render: r => <div style={{fontSize:12}}><div>{fmtDate(r.created_at)}</div><div style={{color:'var(--gray-400)'}}>{fmtTime(r.created_at)}</div></div> },
    { label:'Status',  sort: r => r.status, render: r => <Badge status={r.status} /> },
    { label:'Action',  render: r => (
      <select className="form-control" style={{padding:'5px 8px',fontSize:12,width:120}} value={r.status}
        onChange={e=>updateStatus(r.id,e.target.value)}>
        {STATUS_OPTS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
      </select>
    )},
  ];

  return (
    <div>
      <PageHeader title="Food Orders"
        subtitle={<span>Auto-refreshes every 30s &nbsp;·&nbsp; <span style={{color:pending>0?'var(--danger)':'var(--success)',fontWeight:700}}>{pending} pending</span></span>}
        action={<button className="btn btn-sm btn-outline" onClick={load}>↻ Refresh</button>}
      />
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
        <FilterBar filters={DATE_FILTERS}   active={dateFilter}   onChange={v=>{setDateF(v);setFrom('');setTo('');}} />
        <FilterBar filters={FOOD_STATUS_FILTERS} active={statusFilter} onChange={setStatusF} />
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customFrom} onChange={e=>{setFrom(e.target.value);setDateF('custom');}} />
          <span style={{color:'var(--gray-400)',fontSize:13}}>to</span>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customTo} onChange={e=>{setTo(e.target.value);setDateF('custom');}} />
        </div>
      </div>
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : (
        <>
          <div style={{fontSize:13,color:'var(--gray-400)',marginBottom:10}}>{total} orders found</div>
          {/* Desktop: table */}
          <div className="sxp-only-desktop">
            <Table columns={columns} data={data} emptyMessage="No food orders found" pageSize={10} />
          </div>
          {/* Mobile: tap-friendly cards */}
          <div className="sxp-only-mobile">
            {data.length === 0
              ? <div style={{textAlign:'center',padding:'24px 0',color:'var(--gray-400)'}}>No food orders found</div>
              : data.map(r => (
                <div key={r.id} className="sxp-pcard">
                  <div className="sxp-prail" style={{background:railColor(r.status)}} />
                  <div className="sxp-ptop">
                    <div className="sxp-pav"><span className="rn">{r.room_number}</span><span className="rl">Room</span></div>
                    <div className="sxp-pmid" onClick={()=>setExpanded(expanded===r.id?null:r.id)}>
                      <div className="sxp-preq" style={{fontWeight:600,fontSize:13.5}}>🍽 {r.items?.slice(0,2).map(i=>`${i.name} ×${i.quantity}`).join(', ')}{r.items?.length>2?` +${r.items.length-2}`:''} <span style={{color:'var(--gray-400)'}}>{expanded===r.id?'▲':'▼'}</span></div>
                      <div className="sxp-ptime">{fmtDate(r.created_at)} · {fmtTime(r.created_at)}</div>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  {expanded===r.id && (
                    <div style={{marginTop:10,background:'var(--gray-50)',borderRadius:10,padding:12}}>
                      {r.items?.map((i,idx)=>(
                        <div key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0',borderBottom:idx<r.items.length-1?'1px solid var(--border)':'none'}}>
                          <span>{i.name} × {i.quantity}</span><span style={{fontWeight:600}}>{fmtCur(i.price*i.quantity)}</span>
                        </div>
                      ))}
                      {r.guest_note && <div style={{marginTop:8,fontSize:12,color:'var(--gray-500)'}}>Note: {r.guest_note}</div>}
                    </div>
                  )}
                  <div className="sxp-pdiv" />
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
                    <span className="sxp-preq" style={{fontSize:13,color:'var(--gray-500)',fontWeight:600}}>Total</span>
                    <strong style={{color:'var(--success)',fontSize:17}}>{fmtCur(r.total_amount)}</strong>
                  </div>
                  <div className="sxp-pactions">
                    <select className="form-control" value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>
                      {STATUS_OPTS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}</Card>
    </div>
  );
};
