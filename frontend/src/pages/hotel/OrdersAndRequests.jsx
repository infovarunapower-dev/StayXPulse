import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Badge, Card, Table, FilterBar, TableSkeleton } from '../../components/shared/UI';

const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—';

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
    { label:'Request', sort: r => r.type, render: r => <div><div style={{fontWeight:600}}>{r.type}</div>{r.note&&<div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>{r.note}</div>}</div> },
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
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : <><div style={{fontSize:13,color:'var(--gray-400)',marginBottom:10}}>{total} requests found</div><Table columns={columns} data={data} emptyMessage="No service requests found" pageSize={10} /></>}</Card>
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
        <FilterBar filters={STATUS_FILTERS} active={statusFilter} onChange={setStatusF} />
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customFrom} onChange={e=>{setFrom(e.target.value);setDateF('custom');}} />
          <span style={{color:'var(--gray-400)',fontSize:13}}>to</span>
          <input type="date" className="form-control" style={{width:140,padding:'6px 10px',fontSize:13}} value={customTo} onChange={e=>{setTo(e.target.value);setDateF('custom');}} />
        </div>
      </div>
      <Card>{loading ? <TableSkeleton cols={columns.length} /> : <><div style={{fontSize:13,color:'var(--gray-400)',marginBottom:10}}>{total} orders found</div><Table columns={columns} data={data} emptyMessage="No food orders found" pageSize={10} /></>}</Card>
    </div>
  );
};
