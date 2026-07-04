import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import useRazorpay from '../../utils/useRazorpay';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/shared/UI';
import './UpgradePlan.css';

const CYCLES = [
  { key: 'monthly',   label: 'Monthly',   badge: null       },
  { key: 'quarterly', label: 'Quarterly', badge: 'Save 10%' },
  { key: 'yearly',    label: 'Yearly',    badge: 'Save 20%' },
];

const fmtCur = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const PaymentSuccess = ({ result, onDone }) => (
  <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', padding:'0 20px' }}>
    <div style={{ fontSize:72, marginBottom:16 }}>🎉</div>
    <div style={{ fontSize:26, fontWeight:800, color:'var(--gray-900)', marginBottom:8 }}>Payment Successful!</div>
    <div style={{ fontSize:15, color:'var(--gray-500)', marginBottom:28 }}>
      Your <strong>{result.planName}</strong> plan is now active. Invoice sent to your email.
    </div>
    <div style={{ background:'var(--brand-light)', borderRadius:14, padding:20, marginBottom:28, textAlign:'left' }}>
      {[
        { label:'Plan',        value:`${result.planName} — ${result.cycle.charAt(0).toUpperCase()+result.cycle.slice(1)}` },
        { label:'Amount Paid', value:fmtCur(result.amount) },
        { label:'Invoice No.', value:result.invoiceNumber, mono:true },
        { label:'Valid From',  value:new Date(result.validFrom).toDateString() },
        { label:'Valid To',    value:new Date(result.validTo).toDateString() },
      ].map(r => (
        <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(13,148,136,0.1)', fontSize:14 }}>
          <span style={{ color:'var(--brand)', fontWeight:600 }}>{r.label}</span>
          <span style={{ fontWeight:700, fontFamily:r.mono?'var(--font-mono)':'inherit', color:'var(--gray-900)' }}>{r.value}</span>
        </div>
      ))}
    </div>
    <button className="btn btn-brand" style={{ width:'100%', padding:14, fontSize:15 }} onClick={onDone}>Go to Dashboard →</button>
  </div>
);

const MyPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  useEffect(() => {
    api.get('/payment/my-payments').then(r => setPayments(r.data.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading || payments.length === 0) return null;
  return (
    <div className="my-payments">
      <h3>Payment History</h3>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'var(--gray-50)' }}>
            {['Invoice','Plan','Amount','Valid From','Valid To','Download'].map(h=>(
              <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'var(--gray-500)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{payments.map(p=>(
            <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'12px 14px' }}><code style={{ fontFamily:'var(--font-mono)', fontSize:12, background:'var(--gray-100)', padding:'2px 6px', borderRadius:4 }}>{p.invoice_number}</code></td>
              <td style={{ padding:'12px 14px', fontWeight:600 }}>{p.plan?.name}</td>
              <td style={{ padding:'12px 14px', fontWeight:700, color:'var(--success)' }}>₹{p.amount?.toLocaleString('en-IN')}</td>
              <td style={{ padding:'12px 14px' }}>{fmtDate(p.valid_from)}</td>
              <td style={{ padding:'12px 14px' }}>{fmtDate(p.valid_to)}</td>
              <td style={{ padding:'12px 14px' }}>
                <button className="btn btn-sm btn-outline" onClick={async()=>{
                  try {
                    const res = await api.get(`/payment/invoice/${p.payment_id}`,{responseType:'blob'});
                    const url = URL.createObjectURL(new Blob([res.data],{type:'application/pdf'}));
                    const a   = document.createElement('a'); a.href=url; a.download=`Invoice_${p.invoice_number}.pdf`; a.click(); URL.revokeObjectURL(url);
                  } catch { toast.error('Download failed'); }
                }}>⬇ PDF</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

const UpgradePlan = () => {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const openRazorpay = useRazorpay();
  const [plans,    setPlans]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [cycle,    setCycle]   = useState('monthly');
  const [paying,   setPaying]  = useState(null);
  const [success,  setSuccess] = useState(null);

  useEffect(() => {
    api.get('/payment/plans').then(r=>setPlans(r.data.data)).catch(()=>toast.error('Failed to load plans')).finally(()=>setLoading(false));
  }, []);

  const hotel = user?.hotel;

  const handlePay = async (plan) => {
    setPaying(plan.id);
    try {
      const { data } = await api.post('/payment/create-order', { planId: plan.id, cycle });
      await openRazorpay({
        orderId: data.data.orderId, amount: data.data.amount, keyId: data.data.keyId,
        description: `${data.data.planName} — ${cycle}`,
        email: data.data.email, phone: data.data.phone,
        onSuccess: async (response) => {
          try {
            const verify = await api.post('/payment/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            setSuccess(verify.data.data);
            toast.success('🎉 Subscription activated!');
          } catch(err) { toast.error(err.response?.data?.message || 'Verification failed. Contact support.'); }
          finally { setPaying(null); }
        },
        onFailure: (msg) => { toast.error(msg || 'Payment failed.'); setPaying(null); },
      });
    } catch(err) { toast.error(err.response?.data?.message || 'Could not initiate payment.'); setPaying(null); }
  };

  if (success) return <PaymentSuccess result={success} onDone={() => navigate('/hotel/dashboard', { replace:true })} />;
  if (loading) return <Spinner />;

  return (
    <div className="upgrade-page">
      {hotel?.subscriptionStatus === 'active' && (
        <div className="current-banner">
          <span>✅</span>
          <div>Active subscription · Valid until <strong>{new Date(hotel.plan_valid_to).toDateString()}</strong> · Renewing extends from your current expiry.</div>
        </div>
      )}
      {hotel?.subscriptionStatus === 'expired' && (
        <div className="current-banner expired"><span>🔒</span><div>Your subscription has <strong>expired</strong>. Choose a plan to reactivate.</div></div>
      )}
      {hotel?.subscriptionStatus === 'trial' && (
        <div className="current-banner trial">
          <span>⏰</span>
          <div>Free trial · <strong>{Math.max(0,Math.ceil((new Date(hotel.trial_end_date)-Date.now())/86400000))} days left</strong>. Upgrade to keep all your data.</div>
        </div>
      )}

      <div className="upgrade-header">
        <h1>Choose Your Plan</h1>
        <p>Simple, transparent pricing. Instant activation. Cancel anytime.</p>
      </div>

      <div className="cycle-toggle">
        {CYCLES.map(c => (
          <button key={c.key} className={`cycle-btn ${cycle===c.key?'active':''}`} onClick={()=>setCycle(c.key)}>
            {c.label}{c.badge && <span className="cycle-badge">{c.badge}</span>}
          </button>
        ))}
      </div>

      <div className="plans-grid">
        {plans.map(plan => {
          const pricing = plan.pricing[cycle];
          const isBusy  = paying === plan.id;
          return (
            <div key={plan.id} className={`plan-card ${plan.is_popular?'popular':''}`}>
              {plan.is_popular && <div className="popular-badge">MOST POPULAR</div>}
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                {fmtCur(pricing.amount)}<span className="plan-cycle">{pricing.label}</span>
              </div>
              {cycle !== 'monthly' && (
                <div className="plan-savings">Save {pricing.discount}% vs monthly · {pricing.days} days</div>
              )}
              <div className="plan-rooms">Up to {plan.max_rooms >= 999999 ? 'unlimited' : plan.max_rooms} rooms</div>
              <ul className="plan-features">
                {plan.features?.map((f,i) => <li key={i}><span className="feat-check">✓</span> {f}</li>)}
              </ul>
              <button className={`plan-btn ${plan.is_popular?'plan-btn-popular':''}`} onClick={()=>handlePay(plan)} disabled={!!paying}>
                {isBusy ? <><span className="spinner-sm"/> Processing…</> : `Get ${plan.name} →`}
              </button>
              <div className="plan-note">Secured by Razorpay · Instant activation</div>
            </div>
          );
        })}
      </div>

      <MyPayments />

      <div className="faq-section">
        <h3>Frequently Asked Questions</h3>
        {[
          { q:'When does my plan activate?',        a:'Immediately after payment — no waiting, no manual steps.' },
          { q:'Will I get an invoice?',              a:'Yes, a PDF invoice is automatically emailed to your registered address.' },
          { q:'What happens when my plan expires?',  a:'Your dashboard goes read-only. Renew anytime to restore full access.' },
          { q:'Is my payment secure?',               a:'Yes. All payments are processed by Razorpay — PCI DSS compliant, bank-grade security.' },
        ].map((item,i) => (
          <div key={i} className="faq-item">
            <div className="faq-q">Q: {item.q}</div>
            <div className="faq-a">A: {item.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpgradePlan;
