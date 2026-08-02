import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Spinner, Modal } from '../../components/shared/UI';

const ROOM_TYPES = ['Standard','Deluxe','Suite','Executive Suite','Villa'];
// QR codes get physically printed and stuck on doors, so a wrong base URL is
// unrecoverable. Mirror the backend guard: ignore an unset value or a
// vercel.app/localhost preview URL and fall back to the real domain.
const _envUrl = process.env.REACT_APP_CLIENT_URL;
const CLIENT_URL = (_envUrl && !/vercel\.app|localhost/i.test(_envUrl))
  ? _envUrl.replace(/\/+$/, '')
  : 'https://stayxpulse.sunver.in';

// Single QR Card component
const QRCard = ({ room, hotel, onDelete, onView }) => {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const url = `${CLIENT_URL}/guest/${room.qr_token}`;
    QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#0F766E', light: '#FFFFFF' },
    }).then(setQrDataUrl).catch(console.error);
  }, [room.qr_token]);

  const downloadQR = async () => {
    if (!qrDataUrl) return;

    const W = 480, H = 680;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx = W / 2;

    const loadImg = (src, cors) => new Promise(resolve => {
      const im = new Image();
      if (cors) im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Emerald header
    const grad = ctx.createLinearGradient(0, 0, W, 190);
    grad.addColorStop(0, '#0A3B34');
    grad.addColorStop(0.55, '#0F766E');
    grad.addColorStop(1, '#14B8A6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 190);

    // Logo circle (hotel logo if reachable, else the hotel's initial)
    const r = 36, cyLogo = 66;
    const logo = (hotel?.logoUrl && /^https?:\/\//.test(hotel.logoUrl)) ? await loadImg(hotel.logoUrl, true) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cyLogo, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    if (logo) { ctx.clip(); ctx.drawImage(logo, cx - r, cyLogo - r, r * 2, r * 2); }
    ctx.restore();
    if (!logo) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((hotel?.hotelName || 'H').trim().charAt(0).toUpperCase(), cx, cyLogo + 1);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.beginPath();
    ctx.arc(cx, cyLogo, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hotel name + phone
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 25px Arial';
    ctx.fillText(hotel?.hotelName || 'Your Hotel', cx, 141);
    if (hotel?.phone) {
      ctx.font = '14px Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`Call ${hotel.phone}`, cx, 167);
    }

    // Room
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`Room ${room.number}`, cx, 246);
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px Arial';
    ctx.fillText([room.floor && `Floor ${room.floor}`, room.type].filter(Boolean).join('   ·   '), cx, 271);

    // QR framed
    const qrSize = 250, qrX = (W - qrSize) / 2, qrY = 300;
    ctx.fillStyle = '#F5F8F7';
    roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 18); ctx.fill();
    ctx.strokeStyle = '#D9E7E3'; ctx.lineWidth = 1.5;
    roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 18); ctx.stroke();
    const qr = await loadImg(qrDataUrl, false);
    if (qr) ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

    // Instruction
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Scan to Order Food & Request Services', cx, qrY + qrSize + 54);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '13px Arial';
    ctx.fillText('Point your phone camera at the code above', cx, qrY + qrSize + 78);

    // Footer
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Powered by StayXPulse', cx, H - 26);

    const link = document.createElement('a');
    link.download = `QR_Room_${room.number}_${(hotel?.hotelName || 'Hotel').replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success(`QR for Room ${room.number} downloaded!`);
  };

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:20,textAlign:'center',position:'relative'}}>
      <button onClick={() => onView(room)} title="View this room's orders & requests"
        style={{display:'inline-block',padding:'4px 14px',background:'var(--brand-light)',color:'var(--brand)',border:'none',borderRadius:20,fontSize:13,fontWeight:700,marginBottom:12,cursor:'pointer'}}>
        Room {room.number} ›
      </button>
      <div style={{width:160,height:160,margin:'0 auto 12px',border:'2px solid var(--border)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:'#fff'}}>
        {qrDataUrl
          ? <img src={qrDataUrl} alt="QR" style={{width:148,height:148}} />
          : <Spinner size={32} />}
      </div>
      <div style={{fontSize:13,fontWeight:600,color:'var(--gray-700)'}}>{room.floor || '—'} · {room.type}</div>
      <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:12}}>
        <button className="btn btn-sm btn-brand" onClick={downloadQR} disabled={!qrDataUrl}>⬇ Download</button>
        <button className="btn btn-sm btn-outline"
          onClick={() => window.open(`/guest/${room.qr_token}`, '_blank')}>Preview</button>
        <button className="btn btn-sm" style={{background:'var(--danger-light)',color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:8,padding:'5px 10px',fontSize:12,cursor:'pointer'}}
          onClick={() => onDelete(room)}>🗑</button>
      </div>
    </div>
  );
};

const QRManagement = () => {
  const [rooms,   setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [hotel,   setHotel]   = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [delRoom, setDelRoom] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ number:'', floor:'', type:'Standard' });

  // Per-room activity viewer
  const [viewRoom,     setViewRoom]     = useState(null);
  const [activity,     setActivity]     = useState({ orders: [], requests: [] });
  const [actLoading,   setActLoading]   = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing,     setClearing]     = useState(false);

  const openActivity = async (room) => {
    setViewRoom(room); setConfirmClear(false); setActLoading(true);
    setActivity({ orders: [], requests: [] });
    try {
      const r = await api.get(`/hotel/rooms/${room.id}/activity`);
      setActivity({ orders: r.data.data.orders || [], requests: r.data.data.requests || [] });
    } catch { toast.error('Failed to load room activity'); }
    finally { setActLoading(false); }
  };

  const handleClearGuest = async () => {
    setClearing(true);
    try {
      await api.post(`/hotel/rooms/${viewRoom.id}/clear-guest`);
      toast.success(`Room ${viewRoom.number}: guest's My Orders cleared (your records are kept)`);
      setConfirmClear(false);
    } catch { toast.error('Failed to clear'); }
    finally { setClearing(false); }
  };

  const fmtDT = d => d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';
  const inr   = n => `₹${Number(n||0).toLocaleString('en-IN')}`;

  const loadRooms = async () => {
    try {
      const [rRes, meRes] = await Promise.all([api.get('/hotel/rooms'), api.get('/auth/me')]);
      setRooms(rRes.data.data);
      setHotel(meRes.data.user?.hotel);
    } catch { toast.error('Failed to load rooms'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadRooms(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.number.trim()) { toast.error('Room number is required'); return; }
    setSaving(true);
    try {
      await api.post('/hotel/rooms', form);
      toast.success(`Room ${form.number} created! QR generated.`);
      setForm({ number:'', floor:'', type:'Standard' });
      setShowAdd(false);
      loadRooms();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add room'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/hotel/rooms/${delRoom.id}`);
      toast.success(`Room ${delRoom.number} deleted`);
      setDelRoom(null);
      loadRooms();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader
        title="QR Management"
        subtitle="Each room gets a unique QR code guests scan to order or request services"
        action={<button className="btn btn-brand" onClick={() => setShowAdd(true)}>+ Add Room</button>}
      />

      {loading ? <Spinner /> : rooms.length === 0 ? (
        <div style={{textAlign:'center',padding:'80px 20px'}}>
          <div style={{fontSize:56,marginBottom:12}}>📱</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--gray-700)',marginBottom:6}}>No rooms yet</div>
          <div style={{fontSize:14,color:'var(--gray-400)',marginBottom:20}}>Add your first room to generate a QR code</div>
          <button className="btn btn-brand" onClick={() => setShowAdd(true)}>+ Add First Room</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16}}>
          {rooms.map(r => <QRCard key={r.id} room={r} hotel={hotel} onDelete={setDelRoom} onView={openActivity} />)}
        </div>
      )}

      {/* Add Room Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Room & Generate QR">
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label">Room Number *</label>
            <input className="form-control" placeholder="e.g. 101, Suite-A, PH1" autoFocus
              value={form.number} onChange={e => setForm(f=>({...f,number:e.target.value}))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Floor</label>
              <input className="form-control" placeholder="e.g. Ground, 1st, 2nd"
                value={form.floor} onChange={e => setForm(f=>({...f,floor:e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Room Type</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{background:'var(--brand-light)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'var(--brand)',marginBottom:20}}>
            💡 A unique QR code will be generated automatically. The QR will open a guest ordering page with your hotel name and room number.
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn btn-brand" disabled={saving}>{saving ? 'Generating…' : '📱 Generate QR'}</button>
          </div>
        </form>
      </Modal>

      {/* Room Activity + Clear */}
      <Modal open={!!viewRoom} onClose={() => setViewRoom(null)} title={viewRoom ? `Room ${viewRoom.number} · Orders & Requests` : ''}>
        {actLoading ? <div style={{padding:'30px 0',textAlign:'center'}}><Spinner /></div> : (
          <div>
            {/* Food Orders */}
            <div style={{fontSize:13,fontWeight:700,color:'var(--gray-700)',textTransform:'uppercase',letterSpacing:'.04em',margin:'0 0 8px'}}>🍽 Food Orders</div>
            {activity.orders.length === 0
              ? <div style={{fontSize:13,color:'var(--gray-400)',padding:'4px 0 16px'}}>No food orders.</div>
              : <div style={{marginBottom:18}}>{activity.orders.map(o => (
                  <div key={o.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:13.5,fontWeight:600}}>{(o.items||[]).map(i=>`${i.name} ×${i.quantity}`).join(', ') || 'Order'}</div>
                      <div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>{fmtDT(o.created_at)} · {o.status}</div>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:700,color:'var(--brand)',whiteSpace:'nowrap',marginLeft:10}}>{inr(o.total_amount)}</div>
                  </div>
                ))}</div>}

            {/* Service Requests */}
            <div style={{fontSize:13,fontWeight:700,color:'var(--gray-700)',textTransform:'uppercase',letterSpacing:'.04em',margin:'8px 0 8px'}}>🛎 Service Requests</div>
            {activity.requests.length === 0
              ? <div style={{fontSize:13,color:'var(--gray-400)',padding:'4px 0 8px'}}>No service requests.</div>
              : <div>{activity.requests.map(s => (
                  <div key={s.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{fontSize:13.5,fontWeight:600}}>{s.type}</div>
                    <div style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>
                      {fmtDT(s.created_at)} · {s.status}
                      {s.scheduled_for && <span style={{color:'#B45309',fontWeight:700}}> · ⏰ {fmtDT(s.scheduled_for)}</span>}
                    </div>
                  </div>
                ))}</div>}

            {/* Clear guest view */}
            <div style={{marginTop:22,borderTop:'1px solid var(--border)',paddingTop:16}}>
              {!confirmClear ? (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{fontSize:12.5,color:'var(--gray-400)',lineHeight:1.5,flex:1,minWidth:180}}>
                    Emptying the guest's <strong>My Orders</strong> gives the next guest a clean slate. Your dashboard, analytics and revenue keep everything.
                  </div>
                  <button className="btn btn-sm" style={{background:'var(--danger-light)',color:'var(--danger)',border:'1px solid var(--danger)'}}
                    onClick={() => setConfirmClear(true)}>Clear guest view</button>
                </div>
              ) : (
                <div style={{background:'var(--danger-light)',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:13,color:'var(--gray-700)',marginBottom:12}}>
                    Clear the guest's My Orders for <strong>Room {viewRoom?.number}</strong>? This only resets what the guest sees — nothing is deleted from your side.
                  </div>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button className="btn btn-sm btn-outline" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</button>
                    <button className="btn btn-sm btn-danger" onClick={handleClearGuest} disabled={clearing}>{clearing ? 'Clearing…' : 'Yes, clear guest view'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!delRoom} onClose={() => setDelRoom(null)} title="Delete Room?" width={400}>
        <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:24}}>
          Are you sure you want to delete <strong>Room {delRoom?.number}</strong>? The QR code will stop working immediately.
        </p>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setDelRoom(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete</button>
        </div>
      </Modal>
    </div>
  );
};

export default QRManagement;
