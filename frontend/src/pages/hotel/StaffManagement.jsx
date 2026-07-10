import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Modal, Spinner } from '../../components/shared/UI';

const DEPARTMENTS = ['Housekeeping', 'Room Service', 'Maintenance', 'Front Desk', 'Kitchen', 'Other'];
const BLANK = { name: '', phone: '', pin: '', department: 'Housekeeping' };

const StaffManagement = () => {
  const { user } = useAuth();
  const hotelCode = user?.hotel?.user_id || user?.hotel?.userId || '';

  const [staff,   setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(false);
  const [editing, setEditing] = useState(null);   // staff being PIN-reset / edited
  const [form,    setForm]    = useState(BLANK);
  const [saving,  setSaving]  = useState(false);
  const [delItem, setDelItem] = useState(null);

  const load = async () => {
    try { const r = await api.get('/hotel/staff'); setStaff(r.data.data || []); }
    catch (err) {
      const msg = err.response?.data?.message || '';
      if (/staff/.test(msg) && /not exist|schema cache/i.test(msg))
        toast.error('Staff table missing — run the staff migration in Supabase first.', { duration: 8000 });
      else toast.error('Failed to load staff');
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditing(null); setForm(BLANK); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, phone: s.phone, pin: '', department: s.department }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || (!editing && !form.pin)) { toast.error('Name, phone and PIN are required'); return; }
    if (form.pin && !/^\d{4}$/.test(form.pin)) { toast.error('PIN must be exactly 4 digits'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/hotel/staff/${editing.id}`, { name: form.name, department: form.department, ...(form.pin ? { pin: form.pin } : {}) });
        toast.success('Staff member updated');
      } else {
        await api.post('/hotel/staff', form);
        toast.success(`${form.name} added — share the hotel code, their phone number and PIN with them`);
      }
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    try {
      await api.patch(`/hotel/staff/${s.id}`, { isActive: !s.is_active });
      setStaff(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x));
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/hotel/staff/${delItem.id}`); toast.success('Staff member removed'); setDelItem(null); load(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader title="Staff" subtitle="Add your staff and assign guest service requests to them"
        action={<button className="btn btn-brand" onClick={openAdd}>+ Add Staff Member</button>}
      />

      {/* Staff app how-to */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{fontSize:32}}>📱</div>
          <div style={{flex:1,minWidth:220}}>
            <div style={{fontWeight:700,fontSize:14,color:'var(--gray-900)'}}>StayXPulse Staff App</div>
            <div style={{fontSize:13,color:'var(--gray-500)',marginTop:2}}>
              Staff sign in with hotel code <strong style={{color:'var(--brand)'}}>{hotelCode || 'your hotel code'}</strong>, their phone number and 4-digit PIN.
              Assigned tasks appear instantly with a sound alert.
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a className="btn btn-sm btn-outline" href="/staff-login" target="_blank" rel="noreferrer">🌐 Open Web App</a>
            <a className="btn btn-sm btn-brand" href="/stayxpulse-staff.apk" download="StayXPulse-Staff.apk">🤖 Download Android App</a>
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : staff.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <div style={{fontSize:48,marginBottom:12}}>🧑‍🔧</div>
          <div style={{fontWeight:700,color:'var(--gray-600)',fontSize:16,marginBottom:6}}>No staff members yet</div>
          <div style={{fontSize:13,color:'var(--gray-400)',marginBottom:16}}>Add your housekeeping and service staff to start assigning guest requests</div>
          <button className="btn btn-brand" onClick={openAdd}>+ Add First Staff Member</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
          {staff.map(s => (
            <Card key={s.id} style={{opacity:s.is_active?1:0.6}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'var(--brand-gradient)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:15,flexShrink:0}}>
                  {s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--gray-900)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)'}}>{s.department} · 📞 {s.phone}</div>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:s.is_active?'var(--success)':'var(--gray-400)'}}>{s.is_active?'● Active':'○ Disabled'}</span>
              </div>
              <div style={{display:'flex',gap:6,borderTop:'1px solid var(--border)',paddingTop:10}}>
                <button className="btn btn-sm btn-outline" onClick={()=>openEdit(s)}>Edit / Reset PIN</button>
                <button className="btn btn-sm btn-outline" onClick={()=>toggleActive(s)}>{s.is_active?'Disable':'Enable'}</button>
                <button className="btn btn-sm" style={{background:'var(--danger-light)',color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:7,cursor:'pointer'}} onClick={()=>setDelItem(s)}>🗑</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing ? `Edit ${editing.name}` : 'Add Staff Member'} width={460}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-control" placeholder="Ramesh Kumar" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input className="form-control" placeholder="9876543210" value={form.phone} disabled={!!editing}
                onChange={e=>setForm(f=>({...f,phone:e.target.value.replace(/\D/g,'')}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-control" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}>
                {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{editing ? 'New 4-digit PIN (leave blank to keep current)' : '4-digit PIN *'}</label>
            <input className="form-control" placeholder="e.g. 4321" inputMode="numeric" maxLength={4} value={form.pin}
              onChange={e=>setForm(f=>({...f,pin:e.target.value.replace(/\D/g,'')}))} />
            <div style={{fontSize:12,color:'var(--gray-400)',marginTop:5}}>They'll sign in with hotel code <strong>{hotelCode}</strong> + phone + this PIN</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-brand" disabled={saving}>{saving?'Saving…':editing?'Save Changes':'Add Staff Member'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delItem} onClose={()=>setDelItem(null)} title="Remove Staff Member?" width={380}>
        <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:24}}>Remove <strong>{delItem?.name}</strong>? Their assigned tasks will become unassigned.</p>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setDelItem(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Remove</button>
        </div>
      </Modal>
    </div>
  );
};

export default StaffManagement;
