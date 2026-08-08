import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Card, Spinner } from '../../components/shared/UI';
import '../../components/shared/UI.css';

// Per-category presentation. `key` matches the backend event.category.
const CATS = {
  registration: { label: 'Registrations', color: '#0EA5A5', icon: '🏨' },
  payment:      { label: 'Payments',      color: '#16A34A', icon: '💰' },
  food:         { label: 'Food Orders',   color: '#EA580C', icon: '🍽️' },
  service:      { label: 'Service',       color: '#2563EB', icon: '🛎️' },
  room:         { label: 'Rooms',         color: '#7C3AED', icon: '🚪' },
  login:        { label: 'Logins',        color: '#64748B', icon: '🔑' },
  system:       { label: 'System',        color: '#4F46E5', icon: '📱' },
};

const relTime = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 7200) return '1 hr ago';
  if (s < 86400) return `${Math.floor(s / 3600)} hrs ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const absTime = (iso) => new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const dayKey = (iso) => {
  const d = new Date(iso), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return 'Today';
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const ActivityLogs = () => {
  const [feed,    setFeed]    = useState([]);
  const [counts,  setCounts]  = useState({});
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cat,     setCat]     = useState('all');
  const [search,  setSearch]  = useState('');
  const [from,    setFrom]    = useState('');
  const [to,      setTo]      = useState('');
  const [limit,   setLimit]   = useState(300);
  const [auto,    setAuto]    = useState(false);
  const timer = useRef(null);

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    try {
      const params = { limit };
      if (from) params.from = new Date(from).toISOString();
      if (to)   params.to   = new Date(new Date(to).getTime() + 86399999).toISOString(); // include the whole "to" day
      const r = await api.get('/superadmin/logs', { params });
      setFeed(r.data.data || []);
      setCounts(r.data.counts || {});
      setTotal(r.data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load logs');
    } finally { soft ? setRefreshing(false) : setLoading(false); }
  }, [limit, from, to]);

  useEffect(() => { load(); }, [load]);

  // Optional live auto-refresh
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(() => load(true), 20000);
    return () => timer.current && clearInterval(timer.current);
  }, [auto, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feed.filter(e => {
      if (cat !== 'all' && e.category !== cat) return false;
      if (!q) return true;
      return [e.action, e.detail, e.hotel].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [feed, cat, search]);

  // Group the visible feed by day for readable section headers.
  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    visible.forEach(e => {
      const k = dayKey(e.ts);
      if (!cur || cur.key !== k) { cur = { key: k, items: [] }; out.push(cur); }
      cur.items.push(e);
    });
    return out;
  }, [visible]);

  const chip = (key, label, n) => {
    const active = cat === key;
    const c = key === 'all' ? '#111827' : (CATS[key]?.color || '#6B7280');
    return (
      <button key={key} onClick={() => setCat(key)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
        border: '1.5px solid', borderColor: active ? c : 'var(--border)',
        background: active ? c : 'transparent', color: active ? '#fff' : 'var(--gray-600)',
        transition: 'all 0.15s',
      }}>
        {key !== 'all' && <span>{CATS[key].icon}</span>}
        {label}
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 10,
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--gray-100)',
          color: active ? '#fff' : 'var(--gray-500)',
        }}>{n}</span>
      </button>
    );
  };

  const inputStyle = { padding: '8px 10px', fontSize: 13 };

  return (
    <div>
      <PageHeader
        title="Logs"
        subtitle="Everything happening across StayXPulse — newest first"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
              <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
              Live (20s)
            </label>
            <button className="btn btn-outline btn-sm" onClick={() => load(true)} disabled={refreshing}>
              {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        {/* Category chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {chip('all', 'All', total)}
          {Object.keys(CATS).filter(k => counts[k]).map(k => chip(k, CATS[k].label, counts[k] || 0))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Search</label>
            <input className="input" style={inputStyle} placeholder="Hotel, room, action…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>From</label>
            <input className="input" style={inputStyle} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>To</label>
            <input className="input" style={inputStyle} type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Depth</label>
            <select className="input" style={inputStyle} value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={100}>Last 100</option>
              <option value={300}>Last 300</option>
              <option value={600}>Last 600</option>
              <option value={1000}>Last 1000</option>
            </select>
          </div>
          {(search || from || to || cat !== 'all') && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setFrom(''); setTo(''); setCat('all'); }}>
              Clear
            </button>
          )}
        </div>
      </Card>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><Spinner /></div>
      ) : visible.length === 0 ? (
        <Card><div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗒️</div>
          No activity matches these filters.
        </div></Card>
      ) : (
        <Card>
          <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 12 }}>
            Showing <strong>{visible.length}</strong> event{visible.length === 1 ? '' : 's'}
            {cat !== 'all' && <> in <strong>{CATS[cat]?.label}</strong></>}
          </div>

          {groups.map(g => (
            <div key={g.key} style={{ marginBottom: 18 }}>
              <div style={{
                position: 'sticky', top: 0, zIndex: 1, background: 'var(--card, #fff)',
                fontSize: 11.5, fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase',
                letterSpacing: '0.5px', padding: '4px 0 8px',
              }}>{g.key}</div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.items.map((e, i) => {
                  const meta = CATS[e.category] || { color: '#6B7280', icon: 'ℹ️' };
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      {/* icon rail */}
                      <div style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: 9,
                        background: meta.color + '18', color: meta.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>{meta.icon}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{e.action}</span>
                          {e.hotel && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: meta.color,
                              background: meta.color + '14', borderRadius: 6, padding: '1px 7px',
                            }}>{e.hotel}</span>
                          )}
                        </div>
                        {e.detail && (
                          <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2, wordBreak: 'break-word' }}>{e.detail}</div>
                        )}
                      </div>

                      <div title={absTime(e.ts)} style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--gray-400)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {relTime(e.ts)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default ActivityLogs;
