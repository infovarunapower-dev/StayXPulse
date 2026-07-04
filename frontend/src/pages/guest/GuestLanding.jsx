import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './GuestLanding.css';

const BASE = '/api';

const SERVICE_OPTIONS = [
  { icon:'🛁', label:'Extra Towels / Toiletries' },
  { icon:'🧹', label:'Room Cleaning'             },
  { icon:'❄️', label:'AC / Heating Issue'        },
  { icon:'🛏', label:'Extra Pillow / Blanket'    },
  { icon:'💡', label:'Electrical Issue'           },
  { icon:'📞', label:'Wake-up Call'              },
  { icon:'🔒', label:'Room Key Issue'            },
  { icon:'🚿', label:'Hot Water Issue'           },
  { icon:'🍽', label:'Dining Table Setup'        },
  { icon:'🧺', label:'Laundry Service'           },
  { icon:'🔇', label:'Noise Complaint'           },
  { icon:'📡', label:'TV / WiFi Issue'           },
];

const GuestLanding = () => {
  const { qrToken }      = useParams();
  const [page,   setPage] = useState(null); // null=loading, 'error', 'app'
  const [hotel,  setHotel]= useState(null);
  const [room,   setRoom] = useState(null);
  const [menu,   setMenu] = useState({});
  const [tab,    setTab]  = useState('service');
  const [cart,   setCart] = useState([]);      // [{foodItem,name,price,quantity}]
  const [orders, setOrders]= useState({ orders:[], requests:[] });
  const [placing,setPlace] = useState(false);
  const [success,setSuccess]=useState('');
  const [guestNote,setNote]=useState('');
  const [showCart,setShowCart]=useState(false);

  useEffect(() => {
    axios.get(`${BASE}/hotel/guest/${qrToken}`)
      .then(r => { setHotel(r.data.data.hotel); setRoom(r.data.data.room); setMenu(r.data.data.menu); setPage('app'); })
      .catch(() => setPage('error'));
  }, [qrToken]);

  const loadOrders = () => {
    axios.get(`${BASE}/hotel/guest/${qrToken}/orders`)
      .then(r => setOrders(r.data.data))
      .catch(() => {});
  };

  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab]);

  // Cart helpers
  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.foodItem === item.id);
      if (ex) return prev.map(c => c.foodItem===item.id ? {...c,quantity:c.quantity+1} : c);
      return [...prev, { foodItem:item.id, name:item.name, price:item.price, quantity:1 }];
    });
  };
  const removeFromCart = (id) => setCart(prev => prev.filter(c=>c.foodItem!==id));
  const changeQty = (id, delta) => {
    setCart(prev => prev.map(c => c.foodItem===id ? {...c,quantity:Math.max(1,c.quantity+delta)} : c));
  };
  const cartTotal  = cart.reduce((s,c) => s + c.price*c.quantity, 0);
  const cartCount  = cart.reduce((s,c) => s + c.quantity, 0);
  const getQty     = (id) => cart.find(c=>c.foodItem===id)?.quantity || 0;

  const placeOrder = async () => {
    if (cart.length===0) return;
    setPlace(true);
    try {
      await axios.post(`${BASE}/hotel/guest/${qrToken}/order`, { items:cart, guestNote });
      setCart([]); setNote(''); setShowCart(false);
      setSuccess('Your order has been placed! We\'ll bring it to your room shortly. 🍽');
      setTimeout(()=>setSuccess(''), 5000);
      setTab('orders'); loadOrders();
    } catch(err) {
      const msg = err.response?.data?.message || err.message || 'Failed to place order';
      console.error('Order error:', msg, err);
      setSuccess(`❌ ${msg}`);
      setTimeout(()=>setSuccess(''), 4000);
    }
    finally { setPlace(false); }
  };

  const placeService = async (type) => {
    try {
      await axios.post(`${BASE}/hotel/guest/${qrToken}/service`, { type });
      setSuccess(`✅ "${type}" request submitted! Our team will assist you shortly.`);
      setTimeout(()=>setSuccess(''),5000);
    } catch(err) {
      const msg = err.response?.data?.message || err.message || 'Failed';
      console.error('Service request error:', msg, err);
      setSuccess(`❌ ${msg}`);
      setTimeout(()=>setSuccess(''),4000);
    }
  };

  if (!page) return <div className="gl-loading"><div className="gl-spinner"/><div>Loading…</div></div>;
  if (page==='error') return (
    <div className="gl-error">
      <div style={{fontSize:56,marginBottom:16}}>🔗</div>
      <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Invalid QR Code</div>
      <div style={{fontSize:14,color:'#9CA3AF'}}>This QR code is inactive or invalid. Please ask the hotel staff for assistance.</div>
    </div>
  );

  const fmtCur = n => `₹${Number(n||0).toLocaleString('en-IN')}`;
  const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';

  const STATUS_COLOR = { pending:'#F59E0B', preparing:'#3B7DD8', delivered:'#10B981', cancelled:'#EF4444', 'in-progress':'#3B7DD8', completed:'#10B981' };

  return (
    <div className="gl-shell">
      {/* Header */}
      <div className="gl-header">
        <div className="gl-header-inner">
          {hotel.logoUrl
            ? <img src={`http://localhost:5000${hotel.logoUrl}`} alt="logo" className="gl-logo"/>
            : <div className="gl-logo-placeholder">🏨</div>}
          <div>
            <div className="gl-hotel-name">{hotel.hotelName}</div>
            <div className="gl-room-info">Room {room.number} &nbsp;·&nbsp; {room.type}</div>
            <div className="gl-hotel-phone">📞 {hotel.phone}</div>
          </div>
        </div>
      </div>

      {/* Success toast */}
      {success && <div className="gl-toast">{success}</div>}

      {/* Tabs */}
      <div className="gl-tabs">
        {[
          { id:'service', icon:'🛎', label:'Room Service' },
          { id:'menu',    icon:'🍽', label:'Food Menu'    },
          { id:'orders',  icon:'📋', label:'My Orders'    },
        ].map(t => (
          <button key={t.id} className={`gl-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="gl-body">
        {/* ── Room Service ── */}
        {tab==='service' && (
          <div>
            <div className="gl-section-title">How can we help you?</div>
            <div className="gl-service-grid">
              {SERVICE_OPTIONS.map(s => (
                <button key={s.label} className="gl-service-btn" onClick={()=>placeService(s.label)}>
                  <span className="gl-service-icon">{s.icon}</span>
                  <span className="gl-service-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Food Menu ── */}
        {tab==='menu' && (
          <div>
            {Object.keys(menu).length === 0
              ? <div className="gl-empty">🍽<br/>Menu not available yet</div>
              : Object.entries(menu).map(([cat, items]) => (
                <div key={cat} className="gl-menu-cat">
                  <div className="gl-cat-title">{cat}</div>
                  {items.map(item => {
                    const qty = getQty(item.id);
                    return (
                      <div key={item.id} className="gl-menu-item">
                        <div style={{display:'flex',alignItems:'center',gap:12,flex:1}}>
                          <span style={{fontSize:28,flexShrink:0}}>{item.image_emoji}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span className="gl-item-name">{item.name}</span>
                              <span style={{fontSize:10,color:item.is_veg?'#10B981':'#EF4444',fontWeight:700}}>{item.is_veg?'●':'●'}</span>
                            </div>
                            {item.description && <div className="gl-item-desc">{item.description}</div>}
                            <div className="gl-item-price">{fmtCur(item.price)}</div>
                          </div>
                        </div>
                        <div className="gl-qty-control">
                          {qty === 0
                            ? <button className="gl-add-btn" onClick={()=>addToCart(item)}>Add</button>
                            : <div className="gl-stepper">
                                <button onClick={()=>qty===1?removeFromCart(item.id):changeQty(item.id,-1)}>−</button>
                                <span>{qty}</span>
                                <button onClick={()=>changeQty(item.id,1)}>+</button>
                              </div>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            }
          </div>
        )}

        {/* ── My Orders ── */}
        {tab==='orders' && (
          <div>
            <button className="gl-refresh-btn" onClick={loadOrders}>↻ Refresh</button>

            <div className="gl-section-title" style={{marginTop:8}}>Food Orders</div>
            {orders.orders.length===0
              ? <div className="gl-empty-small">No food orders yet</div>
              : orders.orders.map(o => (
                <div key={o.id} className="gl-order-card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <code style={{fontSize:12,color:'var(--gray-500)',fontFamily:'monospace'}}>{o.id}</code>
                    <span style={{fontSize:12,fontWeight:700,color:STATUS_COLOR[o.status]||'#374151',textTransform:'capitalize',padding:'2px 10px',background:'#F3F4F6',borderRadius:20}}>
                      {o.status}
                    </span>
                  </div>
                  {o.items?.map((i,idx)=>(
                    <div key={idx} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0'}}>
                      <span>{i.name} × {i.quantity}</span>
                      <span style={{fontWeight:600}}>₹{i.price*i.quantity}</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #E5E7EB',marginTop:8,paddingTop:8,display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700}}>
                    <span>Total</span><span style={{color:'#0D9488'}}>₹{o.total_amount}</span>
                  </div>
                  <div style={{fontSize:11,color:'#9CA3AF',marginTop:4}}>{fmtTime(o.created_at)}</div>
                </div>
              ))
            }

            <div className="gl-section-title" style={{marginTop:20}}>Service Requests</div>
            {orders.requests.length===0
              ? <div className="gl-empty-small">No service requests yet</div>
              : orders.requests.map(r => (
                <div key={r.id} className="gl-order-card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14}}>{r.type}</div>
                      <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{fmtTime(r.created_at)}</div>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:STATUS_COLOR[r.status]||'#374151',textTransform:'capitalize',padding:'2px 10px',background:'#F3F4F6',borderRadius:20}}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !showCart && (
        <button className="gl-cart-float" onClick={()=>setShowCart(true)}>
          🛒 View Cart &nbsp;·&nbsp; {cartCount} item{cartCount>1?'s':''} &nbsp;·&nbsp; {fmtCur(cartTotal)}
        </button>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <div className="gl-cart-overlay" onClick={e=>e.target===e.currentTarget&&setShowCart(false)}>
          <div className="gl-cart-sheet">
            <div className="gl-cart-header">
              <div style={{fontWeight:700,fontSize:17}}>Your Cart</div>
              <button className="gl-cart-close" onClick={()=>setShowCart(false)}>✕</button>
            </div>
            {cart.map(c => (
              <div key={c.foodItem} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid #F3F4F6'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:13,color:'#6B7280'}}>₹{c.price} each</div>
                </div>
                <div className="gl-stepper" style={{marginRight:8}}>
                  <button onClick={()=>c.quantity===1?removeFromCart(c.foodItem):changeQty(c.foodItem,-1)}>−</button>
                  <span>{c.quantity}</span>
                  <button onClick={()=>changeQty(c.foodItem,1)}>+</button>
                </div>
                <div style={{fontWeight:700,fontSize:14,color:'#0D9488',minWidth:56,textAlign:'right'}}>₹{c.price*c.quantity}</div>
              </div>
            ))}
            <div style={{padding:'12px 0'}}>
              <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>Special instructions (optional)</label>
              <textarea rows={2} style={{width:'100%',padding:'8px 12px',border:'1.5px solid #E5E7EB',borderRadius:8,fontFamily:'inherit',fontSize:13,resize:'none'}}
                placeholder="e.g. less spicy, no onions…" value={guestNote} onChange={e=>setNote(e.target.value)} />
            </div>
            <div style={{borderTop:'2px solid #E5E7EB',paddingTop:14}}>
              <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:16,marginBottom:14}}>
                <span>Total</span><span style={{color:'#0D9488'}}>{fmtCur(cartTotal)}</span>
              </div>
              <button className="gl-place-btn" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing Order…' : `Place Order · ${fmtCur(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestLanding;
