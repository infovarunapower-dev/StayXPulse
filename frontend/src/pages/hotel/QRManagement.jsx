import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Spinner, Modal } from '../../components/shared/UI';

const ROOM_TYPES = ['Standard','Deluxe','Suite','Executive Suite','Villa'];
const CLIENT_URL = process.env.REACT_APP_CLIENT_URL || 'http://localhost:3000';

// Single QR Card component
const QRCard = ({ room, hotel, onDelete }) => {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const url = `${CLIENT_URL}/guest/${room.qr_token}`;
    QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#1A4D8F', light: '#FFFFFF' },
    }).then(setQrDataUrl).catch(console.error);
  }, [room.qr_token]);

  const downloadQR = async () => {
    if (!qrDataUrl) return;
    // Create a canvas to compose QR + hotel info label
    const canvas  = document.createElement('canvas');
    const W = 320, H = 380;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Header bar
    ctx.fillStyle = '#1A4D8F';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(hotel?.hotelName || 'Hotel', W/2, 28);
    ctx.font = '13px Arial';
    ctx.fillText(`Room ${room.number}  ·  ${hotel?.phone || ''}`, W/2, 46);

    // QR Image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 60, 64, 200, 200);

      // Footer
      ctx.fillStyle = '#F0F4F8';
      ctx.fillRect(0, 280, W, H-280);
      ctx.fillStyle = '#1A4D8F';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Scan to Order & Request Services', W/2, 310);
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px Arial';
      ctx.fillText(room.type, W/2, 332);
      ctx.fillText(`${hotel?.hotelName}`, W/2, 352);

      const link = document.createElement('a');
      link.download = `QR_Room_${room.number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrDataUrl;
    toast.success(`QR for Room ${room.number} downloaded!`);
  };

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,padding:20,textAlign:'center',position:'relative'}}>
      <div style={{display:'inline-block',padding:'4px 14px',background:'var(--brand-light)',color:'var(--brand)',borderRadius:20,fontSize:13,fontWeight:700,marginBottom:12}}>
        Room {room.number}
      </div>
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
      await api.delete(`/hotel/rooms/${delRoom._id}`);
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
          {rooms.map(r => <QRCard key={r._id} room={r} hotel={hotel} onDelete={setDelRoom} />)}
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
