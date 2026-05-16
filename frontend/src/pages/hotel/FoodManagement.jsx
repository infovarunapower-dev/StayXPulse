import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Spinner, Modal, FilterBar } from '../../components/shared/UI';

const EMOJIS = ['🍽','🥘','🍜','🍛','🥗','🍱','🥞','🍚','🍖','🥩','🍗','🧀','🥚','🍳','🥙','🌮','🌯','🥪','🍔','🍟','🌭','🍕','🫔','🥨','🧆','🥓','🍿','🧂','🥫','🍱','🍣','🍤','🍙','🍘','🍥','🥮','🍡','🧁','🎂','🍰','🍦','🍧','🍨','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍶','🍷','🧉'];

const BLANK = { name:'', description:'', price:'', category:'', isVeg:true, imageEmoji:'🍽' };

const FoodCard = ({ item, onEdit, onToggle, onDelete }) => (
  <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:16,opacity:item.isAvailable?1:0.6,transition:'opacity 0.2s'}}>
    <div style={{fontSize:36,textAlign:'center',marginBottom:10,background:'var(--gray-50)',borderRadius:10,padding:'12px 0'}}>{item.imageEmoji}</div>
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
      <div style={{fontWeight:700,fontSize:14,color:'var(--gray-900)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
      <span style={{fontSize:11,color:item.isVeg?'#10B981':'#EF4444',fontWeight:700}}>{item.isVeg?'●VEG':'●NV'}</span>
    </div>
    <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:4}}>{item.category}</div>
    {item.description && <div style={{fontSize:12,color:'var(--gray-500)',marginBottom:8,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</div>}
    <div style={{fontSize:17,fontWeight:800,color:'var(--brand)',marginBottom:10}}>₹{item.price}</div>
    <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'var(--gray-500)',fontWeight:500}}>
        <div style={{position:'relative',width:36,height:20}}>
          <input type="checkbox" checked={item.isAvailable} onChange={e=>onToggle(item._id,e.target.checked)} style={{opacity:0,width:0,height:0,position:'absolute'}} />
          <div onClick={()=>onToggle(item._id,!item.isAvailable)} style={{position:'absolute',inset:0,background:item.isAvailable?'var(--success)':'var(--gray-300)',borderRadius:10,transition:'background 0.2s',cursor:'pointer'}}>
            <div style={{position:'absolute',width:16,height:16,background:'#fff',borderRadius:'50%',top:2,left:item.isAvailable?18:2,transition:'left 0.2s'}}/>
          </div>
        </div>
        {item.isAvailable ? 'Available' : 'Unavailable'}
      </label>
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-sm btn-outline" onClick={()=>onEdit(item)} style={{padding:'4px 10px'}}>Edit</button>
        <button className="btn btn-sm" style={{background:'var(--danger-light)',color:'var(--danger)',border:'1px solid var(--danger)',borderRadius:7,padding:'4px 10px',fontSize:12,cursor:'pointer'}} onClick={()=>onDelete(item)}>🗑</button>
      </div>
    </div>
  </div>
);

const FoodManagement = () => {
  const [items,    setItems]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [catFilter,setCat]     = useState('all');
  const [search,   setSearch]  = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing] = useState(null);
  const [form,     setForm]    = useState(BLANK);
  const [saving,   setSaving]  = useState(false);
  const [delItem,  setDelItem] = useState(null);
  const [showBulk, setShowBulk]= useState(false);
  const [bulkFile, setBulkFile]= useState(null);
  const [uploading,setUploading]=useState(false);
  const fileRef  = useRef(null);
  const bulkRef  = useRef(null);

  const load = async () => {
    try { const r = await api.get('/hotel/food'); setItems(r.data.data); }
    catch { toast.error('Failed to load menu'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const categories = ['all', ...new Set(items.map(i => i.category))];
  const visible = items.filter(i => {
    if (catFilter !== 'all' && i.category !== catFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openAdd  = () => { setEditing(null); setForm(BLANK); setShowForm(true); };
  const openEdit = (item) => { setEditing(item); setForm({ name:item.name, description:item.description, price:item.price, category:item.category, isVeg:item.isVeg, imageEmoji:item.imageEmoji }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) { toast.error('Name, price and category are required'); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/hotel/food/${editing._id}`, { ...form, price:Number(form.price) });
      else         await api.post('/hotel/food', { ...form, price:Number(form.price) });
      toast.success(editing ? 'Item updated!' : 'Item added to menu!');
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id, val) => {
    try {
      await api.patch(`/hotel/food/${id}/availability`, { isAvailable:val });
      setItems(prev => prev.map(i => i._id===id ? {...i,isAvailable:val} : i));
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/hotel/food/${delItem._id}`); toast.success('Item removed'); setDelItem(null); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      const res = await api.post('/hotel/food/bulk', fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success(res.data.message);
      setShowBulk(false); setBulkFile(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const catFilters = categories.map(c => ({ value:c, label: c==='all'?`All (${items.length})`:c }));

  return (
    <div>
      <PageHeader title="Food Management" subtitle="Manage your menu — add items, control availability, bulk upload"
        action={
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-outline" onClick={() => setShowBulk(true)}>⬆ Bulk Upload</button>
            <button className="btn btn-brand" onClick={openAdd}>+ Add Item</button>
          </div>
        }
      />

      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <FilterBar filters={catFilters} active={catFilter} onChange={setCat} />
        <div style={{position:'relative',flex:1,minWidth:180,maxWidth:280}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--gray-400)',fontSize:14}}>🔍</span>
          <input className="form-control" style={{paddingLeft:34}} placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <div style={{padding:'6px 14px',background:'var(--success-light)',color:'#065F46',borderRadius:20,fontSize:13,fontWeight:600}}>
          ● {items.filter(i=>i.isAvailable).length} Available
        </div>
        <div style={{padding:'6px 14px',background:'var(--gray-100)',color:'var(--gray-500)',borderRadius:20,fontSize:13,fontWeight:600}}>
          ○ {items.filter(i=>!i.isAvailable).length} Unavailable
        </div>
      </div>

      {loading ? <Spinner /> : visible.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <div style={{fontSize:48,marginBottom:12}}>🍽</div>
          <div style={{fontWeight:700,color:'var(--gray-600)',fontSize:16,marginBottom:6}}>
            {items.length===0 ? 'No menu items yet' : 'No items match your filter'}
          </div>
          {items.length===0 && <button className="btn btn-brand" onClick={openAdd}>+ Add First Item</button>}
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:16}}>
          {visible.map(item => <FoodCard key={item._id} item={item} onEdit={openEdit} onToggle={handleToggle} onDelete={setDelItem} />)}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Food Item' : 'Add Food Item'} width={540}>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className="form-control" placeholder="Masala Dosa" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹) *</label>
              <input className="form-control" type="number" placeholder="150" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category *</label>
              <input className="form-control" placeholder="e.g. South Indian, Beverages" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} list="cat-list" />
              <datalist id="cat-list">{['Breakfast','South Indian','North Indian','Chinese','Beverages','Desserts','Snacks','Fast Food'].map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-control" value={form.isVeg} onChange={e=>setForm(f=>({...f,isVeg:e.target.value==='true'}))}>
                <option value="true">🟢 Vegetarian</option>
                <option value="false">🔴 Non-Vegetarian</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-control" placeholder="Short description of the dish" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Emoji Icon</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,background:'var(--gray-50)',borderRadius:8,padding:10,maxHeight:120,overflowY:'auto'}}>
              {EMOJIS.map(em => (
                <span key={em} onClick={() => setForm(f=>({...f,imageEmoji:em}))}
                  style={{fontSize:22,cursor:'pointer',padding:4,borderRadius:6,background:form.imageEmoji===em?'var(--brand-light)':'transparent',border:form.imageEmoji===em?'2px solid var(--brand)':'2px solid transparent'}}>
                  {em}
                </span>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-brand" disabled={saving}>{saving?'Saving…':editing?'Update Item':'Add Item'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showBulk} onClose={() => { setShowBulk(false); setBulkFile(null); }} title="Bulk Upload Menu" width={480}>
        <div style={{background:'var(--brand-light)',borderRadius:10,padding:14,marginBottom:20,fontSize:13,color:'var(--brand)'}}>
          <div style={{fontWeight:700,marginBottom:6}}>📋 Required columns in your file:</div>
          <code style={{fontFamily:'var(--font-mono)',fontSize:12}}>name, price, category, description (opt), isVeg (opt), emoji (opt)</code>
          <div style={{marginTop:8,fontSize:12,color:'var(--gray-600)'}}>Supported formats: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong></div>
        </div>
        <input ref={bulkRef} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>setBulkFile(e.target.files[0])} />
        <div onClick={() => bulkRef.current.click()} style={{border:'2px dashed var(--gray-300)',borderRadius:10,padding:32,textAlign:'center',cursor:'pointer',transition:'border 0.2s',marginBottom:20}}
          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--gray-300)'}>
          {bulkFile ? (
            <div><div style={{fontSize:32,marginBottom:8}}>📄</div><div style={{fontWeight:600,color:'var(--gray-800)'}}>{bulkFile.name}</div><div style={{fontSize:12,color:'var(--gray-400)'}}>{(bulkFile.size/1024).toFixed(1)} KB</div></div>
          ) : (
            <div><div style={{fontSize:32,marginBottom:8}}>📁</div><div style={{color:'var(--gray-500)',fontSize:14}}>Click to select CSV or Excel file</div></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>{setShowBulk(false);setBulkFile(null);}}>Cancel</button>
          <button className="btn btn-brand" disabled={!bulkFile||uploading} onClick={handleBulkUpload}>{uploading?'Uploading…':'⬆ Upload Menu'}</button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!delItem} onClose={()=>setDelItem(null)} title="Remove Item?" width={380}>
        <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:24}}>Remove <strong>{delItem?.name}</strong> from your menu?</p>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setDelItem(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Remove</button>
        </div>
      </Modal>
    </div>
  );
};

export default FoodManagement;
