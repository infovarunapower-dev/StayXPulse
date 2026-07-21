import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, Spinner, Modal, FilterBar } from '../../components/shared/UI';
import { STARTER_MENUS } from '../../data/starterMenus';

// Downscale a menu photo before upload: smaller request (Vercel body limit)
// and fewer AI vision tokens, with no real loss of text legibility.
const downscaleImage = (file, maxDim = 1600) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return resolve(file);
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b => resolve(b || file), 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

const EMOJIS = ['🍽','🥘','🍜','🍛','🥗','🍱','🥞','🍚','🍖','🥩','🍗','🧀','🥚','🍳','🥙','🌮','🌯','🥪','🍔','🍟','🌭','🍕','🫔','🥨','🧆','🥓','🍿','🧂','🥫','🍱','🍣','🍤','🍙','🍘','🍥','🥮','🍡','🧁','🎂','🍰','🍦','🍧','🍨','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍶','🍷','🧉'];

const BLANK = { name:'', description:'', price:'', category:'', isVeg:true, imageEmoji:'🍽' };

const FoodCard = ({ item, onEdit, onToggle, onDelete }) => (
  <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:16,opacity:item.is_available?1:0.6,transition:'opacity 0.2s'}}>
    <div style={{fontSize:36,textAlign:'center',marginBottom:10,background:'var(--gray-50)',borderRadius:10,padding:'12px 0'}}>{item.image_emoji}</div>
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
      <div style={{fontWeight:700,fontSize:14,color:'var(--gray-900)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
      <span style={{fontSize:11,color:item.is_veg?'#10B981':'#EF4444',fontWeight:700}}>{item.is_veg?'●VEG':'●NV'}</span>
    </div>
    <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:4}}>{item.category}</div>
    {item.description && <div style={{fontSize:12,color:'var(--gray-500)',marginBottom:8,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{item.description}</div>}
    <div style={{fontSize:17,fontWeight:800,color:'var(--brand)',marginBottom:10}}>₹{item.price}</div>
    <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'var(--gray-500)',fontWeight:500}}>
        <div style={{position:'relative',width:36,height:20}}>
          <input type="checkbox" checked={item.is_available} onChange={e=>onToggle(item.id,e.target.checked)} style={{opacity:0,width:0,height:0,position:'absolute'}} />
          <div onClick={()=>onToggle(item.id,!item.is_available)} style={{position:'absolute',inset:0,background:item.is_available?'var(--success)':'var(--gray-300)',borderRadius:10,transition:'background 0.2s',cursor:'pointer'}}>
            <div style={{position:'absolute',width:16,height:16,background:'#fff',borderRadius:'50%',top:2,left:item.is_available?18:2,transition:'left 0.2s'}}/>
          </div>
        </div>
        {item.is_available ? 'Available' : 'Unavailable'}
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
  const [showStarter, setShowStarter] = useState(false);
  const [showScan,  setShowScan]  = useState(false);
  const [scanFile,  setScanFile]  = useState(null);
  const [scanning,  setScanning]  = useState(false);
  const [preview,   setPreview]   = useState(null);   // { title, items } — shared by starter & scan
  const [importing, setImporting] = useState(false);
  const fileRef  = useRef(null);
  const bulkRef  = useRef(null);
  const scanRef  = useRef(null);

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
  const openEdit = (item) => { setEditing(item); setForm({ name:item.name, description:item.description, price:item.price, category:item.category, isVeg:item.is_veg, imageEmoji:item.image_emoji }); setShowForm(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) { toast.error('Name, price and category are required'); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/hotel/food/${editing.id}`, { ...form, price:Number(form.price) });
      else         await api.post('/hotel/food', { ...form, price:Number(form.price) });
      toast.success(editing ? 'Item updated!' : 'Item added to menu!');
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id, val) => {
    try {
      await api.patch(`/hotel/food/${id}/availability`, { isAvailable:val });
      setItems(prev => prev.map(i => i.id===id ? {...i,is_available:val} : i));
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/hotel/food/${delItem.id}`); toast.success('Item removed'); setDelItem(null); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleScan = async () => {
    if (!scanFile) return;
    setScanning(true);
    try {
      const blob = await downscaleImage(scanFile);
      const fd = new FormData();
      fd.append('image', blob, 'menu.jpg');
      const res = await api.post('/hotel/food/scan-menu', fd, { headers:{'Content-Type':'multipart/form-data'}, timeout: 120000 });
      const found = res.data.data || [];
      if (!found.length) { toast.error('No menu items found in this photo. Try a clearer, closer shot.'); return; }
      setShowScan(false); setScanFile(null);
      setPreview({ title: `Scanned menu — ${found.length} items found`, items: found });
    } catch (err) { toast.error(err.response?.data?.message || 'Scan failed. Try again.'); }
    finally { setScanning(false); }
  };

  const updatePreviewItem = (idx, patch) =>
    setPreview(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  const removePreviewItem = (idx) =>
    setPreview(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleImport = async () => {
    if (!preview?.items?.length) return;
    setImporting(true);
    try {
      const res = await api.post('/hotel/food/bulk-json', { items: preview.items });
      toast.success(res.data.message);
      setPreview(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
    finally { setImporting(false); }
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
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button className="btn btn-outline" onClick={() => setShowStarter(true)}>✨ Starter Menu</button>
            <button className="btn btn-outline" onClick={() => setShowScan(true)}>📷 Scan Menu Card</button>
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
        <div style={{padding:'6px 14px',background:'var(--success-light)',color:'var(--success)',borderRadius:20,fontSize:13,fontWeight:700}}>
          ● {items.filter(i=>i.is_available).length} Available
        </div>
        <div style={{padding:'6px 14px',background:'var(--gray-100)',color:'var(--gray-500)',borderRadius:20,fontSize:13,fontWeight:600}}>
          ○ {items.filter(i=>!i.is_available).length} Unavailable
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
          {visible.map(item => <FoodCard key={item.id} item={item} onEdit={openEdit} onToggle={handleToggle} onDelete={setDelItem} />)}
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

      {/* Starter Menu picker */}
      <Modal open={showStarter} onClose={() => setShowStarter(false)} title="Start with a Ready-Made Menu" width={560}>
        <p style={{fontSize:13,color:'var(--gray-500)',marginBottom:16}}>
          Pick a starter menu, then review the list — remove items you don't serve and adjust prices before importing.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:8}}>
          {STARTER_MENUS.map(t => (
            <div key={t.id}
              onClick={() => { setShowStarter(false); setPreview({ title: `${t.icon} ${t.name} — ${t.items.length} items`, items: t.items.map(i => ({...i})) }); }}
              style={{display:'flex',alignItems:'center',gap:14,border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',cursor:'pointer',transition:'border-color 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{fontSize:30}}>{t.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--gray-900)'}}>{t.name} <span style={{fontWeight:600,fontSize:12,color:'var(--brand)'}}>· {t.items.length} items</span></div>
                <div style={{fontSize:12,color:'var(--gray-500)',marginTop:2}}>{t.description}</div>
              </div>
              <div style={{color:'var(--gray-400)',fontSize:18}}>›</div>
            </div>
          ))}
        </div>
      </Modal>

      {/* AI Menu Card Scan */}
      <Modal open={showScan} onClose={() => { setShowScan(false); setScanFile(null); }} title="Scan Your Menu Card (AI)" width={480}>
        <div style={{background:'var(--brand-light)',borderRadius:10,padding:14,marginBottom:20,fontSize:13,color:'var(--brand)'}}>
          📷 Photograph your printed menu card — the AI reads out the items, prices and categories for you to review and import.
          For best results: good light, hold the camera straight, one page per photo.
        </div>
        <input ref={scanRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>setScanFile(e.target.files[0])} />
        <div onClick={() => scanRef.current.click()} style={{border:'2px dashed var(--gray-300)',borderRadius:10,padding:28,textAlign:'center',cursor:'pointer',marginBottom:20}}
          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--gray-300)'}>
          {scanFile ? (
            <div>
              <img src={URL.createObjectURL(scanFile)} alt="menu preview" style={{maxHeight:160,maxWidth:'100%',borderRadius:8,marginBottom:8}} />
              <div style={{fontWeight:600,color:'var(--gray-800)',fontSize:13}}>{scanFile.name}</div>
            </div>
          ) : (
            <div><div style={{fontSize:32,marginBottom:8}}>📸</div><div style={{color:'var(--gray-500)',fontSize:14}}>Tap to take a photo or choose an image</div></div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>{setShowScan(false);setScanFile(null);}}>Cancel</button>
          <button className="btn btn-brand" disabled={!scanFile||scanning} onClick={handleScan}>
            {scanning ? <><span className="spinner" /> Reading menu… (up to a minute)</> : '✨ Scan with AI'}
          </button>
        </div>
      </Modal>

      {/* Import preview (shared by starter menus & AI scan) */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || 'Review items'} width={640}>
        <p style={{fontSize:13,color:'var(--gray-500)',marginBottom:12}}>
          Check the list below — edit names, prices and categories, remove anything you don't serve, then import.
        </p>
        <div style={{maxHeight:'50vh',overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,marginBottom:16}}>
          {(preview?.items || []).map((it, idx) => (
            <div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:18,flexShrink:0}}>{it.emoji || '🍽'}</span>
              <input className="form-control" style={{flex:'2 1 120px',minWidth:0,padding:'6px 8px',fontSize:13}} value={it.name}
                onChange={e=>updatePreviewItem(idx,{name:e.target.value})} />
              <input className="form-control" type="number" style={{flex:'0 0 76px',padding:'6px 8px',fontSize:13}} value={it.price}
                onChange={e=>updatePreviewItem(idx,{price:e.target.value})} />
              <input className="form-control" style={{flex:'1 1 100px',minWidth:0,padding:'6px 8px',fontSize:13}} value={it.category}
                onChange={e=>updatePreviewItem(idx,{category:e.target.value})} />
              <span onClick={()=>updatePreviewItem(idx,{isVeg:!it.isVeg})} title={it.isVeg?'Vegetarian — tap to change':'Non-veg — tap to change'}
                style={{cursor:'pointer',fontSize:11,fontWeight:700,flexShrink:0,color:it.isVeg?'#10B981':'#EF4444'}}>
                {it.isVeg?'●VEG':'●NV'}
              </span>
              <button onClick={()=>removePreviewItem(idx)} title="Remove"
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontSize:14,flexShrink:0,padding:2}}>✕</button>
            </div>
          ))}
          {preview?.items?.length === 0 && <div style={{padding:20,textAlign:'center',fontSize:13,color:'var(--gray-400)'}}>All items removed — close and start again.</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={()=>setPreview(null)}>Cancel</button>
          <button className="btn btn-brand" disabled={importing || !preview?.items?.length} onClick={handleImport}>
            {importing ? 'Importing…' : `⬇ Import ${preview?.items?.length || 0} Items`}
          </button>
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
