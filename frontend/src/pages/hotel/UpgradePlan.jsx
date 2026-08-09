import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/shared/UI';
import './UpgradePlan.css';

const CYCLES = [
  { key: 'monthly',   label: 'Monthly',   badge: null       },
  { key: 'quarterly', label: 'Quarterly', badge: 'Save 10%' },
  { key: 'yearly',    label: 'Yearly',    badge: 'Save 20%' },
];

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const fmtCur = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const EMPTY_BILLING = {
  firstName: '', lastName: '', company: '', country: 'India',
  address1: '', address2: '', city: '', state: '', pincode: '', phone: '', email: '', notes: '',
};

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
    api.get('/payments/my-payments').then(r => setPayments(r.data.data)).catch(()=>{}).finally(()=>setLoading(false));
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
              <td style={{ padding:'12px 14px', fontWeight:600 }}>{p.plans?.name || '—'}</td>
              <td style={{ padding:'12px 14px', fontWeight:700, color:'var(--success)' }}>₹{p.amount?.toLocaleString('en-IN')}</td>
              <td style={{ padding:'12px 14px' }}>{fmtDate(p.valid_from)}</td>
              <td style={{ padding:'12px 14px' }}>{fmtDate(p.valid_to)}</td>
              <td style={{ padding:'12px 14px' }}>
                <button className="btn btn-sm btn-outline" onClick={async()=>{
                  try {
                    const res = await api.get(`/payments/invoice/${p.payment_id}`,{responseType:'blob'});
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
  const { user, refreshUser } = useAuth();
  const navigate     = useNavigate();
  const [plans,    setPlans]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [cycle,    setCycle]   = useState('monthly');
  const [paying,   setPaying]  = useState(null);
  const [success,  setSuccess] = useState(null);
  const [gatewayReady, setGatewayReady] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Billing-details step shown before hand-off to the gateway.
  const [billingFor, setBillingFor] = useState(null);   // the plan being purchased
  const [billing,    setBilling]    = useState(EMPTY_BILLING);

  useEffect(() => {
    api.get('/payments/plans')
      .then(r => { setPlans(r.data.data); setGatewayReady(r.data.configured !== false); })
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  // Easebuzz returns the customer here with ?payment=success|failed|invalid after
  // its hosted checkout. The subscription was already activated server-side by
  // the callback, so this only reports the outcome and refreshes the profile.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('payment');
    if (!outcome) return;
    if (outcome === 'success') {
      toast.success('🎉 Payment successful — your subscription is active!');
      refreshUser?.();
      navigate('/hotel/subscription', { replace: true });
    } else if (outcome === 'invalid') {
      toast.error('We could not verify that payment. Please contact support before paying again.');
    } else {
      toast.error('Payment was not completed. You have not been charged.');
    }
  }, []);   // once on mount: this reads the redirect result, not live state

  const hotel = user?.hotel;

  // Hosted checkout: we ask the backend for a payment URL and hand the browser
  // over to Easebuzz. There is no client-side secret and no signature handling
  // here — the result comes back server-to-server to /easebuzz/callback.
  // Step 1 — open the billing form, pre-filled from what we already know about
  // the hotel so the customer only fills the gaps.
  const openBilling = (plan) => {
    if (!termsAccepted) {
      toast.error('Please accept the Terms & Privacy Policy first.');
      return;
    }
    const digits = String(hotel?.phone || '').replace(/\D/g, '').slice(-10);
    setBilling({
      ...EMPTY_BILLING,
      company:  hotel?.hotelName || '',
      address1: hotel?.address || '',
      phone:    digits,
      email:    hotel?.email || '',
    });
    setBillingFor(plan);
  };

  // Step 2 — validate on the client, then hand the details to the gateway.
  const submitBilling = async () => {
    const b = billing;
    const req = [
      [b.firstName, 'First name'], [b.lastName, 'Last name'],
      [b.address1, 'Street address'], [b.city, 'Town / City'], [b.state, 'State'],
    ];
    for (const [v, label] of req) if (!String(v).trim()) { toast.error(`${label} is required.`); return; }
    if (!/^\d{6}$/.test(String(b.pincode).trim()))      { toast.error('Enter a valid 6-digit PIN code.'); return; }
    if (String(b.phone).replace(/\D/g, '').length !== 10) { toast.error('Enter a valid 10-digit phone number.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(String(b.email).trim()))  { toast.error('Enter a valid email address.'); return; }

    setPaying(billingFor.id);
    try {
      const { data } = await api.post('/payments/initiate', {
        planId: billingFor.id, cycle, termsAccepted: true, billing: b,
      });
      if (!data?.data?.paymentUrl) throw new Error('No payment URL returned');
      // Full navigation, not a new tab: popup blockers and the Android WebView
      // both handle a same-tab redirect reliably.
      window.location.assign(data.data.paymentUrl);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start the payment. Please try again.');
      setPaying(null);
    }
  };

  const setB = (k) => (e) => setBilling(s => ({ ...s, [k]: e.target.value }));

  if (success) return <PaymentSuccess result={success} onDone={() => navigate('/hotel/dashboard', { replace:true })} />;
  if (loading) return <Spinner />;

  return (
    <div className="upgrade-page">
      {hotel?.subscriptionStatus === 'active' && (
        <div className="current-banner">
          <span>✅</span>
          <div>Active subscription · Valid until <strong>{new Date(hotel.planValidTo).toDateString()}</strong> · Renewing extends from your current expiry.</div>
        </div>
      )}
      {hotel?.subscriptionStatus === 'expired' && (
        <div className="current-banner expired"><span>🔒</span><div>Choose a plan below to <strong>activate your account</strong> and unlock all features.</div></div>
      )}
      {hotel?.subscriptionStatus === 'trial' && (() => {
        const daysLeft = Math.ceil((new Date(hotel.trialEndDate) - Date.now()) / 86400000);
        return daysLeft > 0 ? (
          <div className="current-banner trial">
            <span>⏰</span>
            <div>Free trial · <strong>{daysLeft} day{daysLeft > 1 ? 's' : ''} left</strong>. Upgrade to keep all your data.</div>
          </div>
        ) : (
          <div className="current-banner expired">
            <span>🔒</span>
            <div>Your <strong>free trial has ended</strong>. Choose a plan below to continue using StayXPulse.</div>
          </div>
        );
      })()}

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

      {!gatewayReady && (
        <div style={{ background: 'var(--accent-light)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '12px 16px', margin: '0 0 20px', fontSize: 13.5, color: 'var(--accent-strong)', fontWeight: 600, textAlign: 'center' }}>
          ⚠️ Online payment is not available right now. Please contact support to activate your plan.
        </div>
      )}

      {/* Consent — required before any plan button enables. Recorded as
          checkout evidence on the Order Record. */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 560, margin: '0 auto 22px', padding: '12px 16px', background: 'var(--gray-50)', border: '1.5px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, color: 'var(--gray-700)' }}>
        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16, cursor: 'pointer' }} />
        <span>I have read and accept the <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>, and I authorise this subscription payment.</span>
      </label>

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
              <button className={`plan-btn ${plan.is_popular?'plan-btn-popular':''}`} onClick={()=> openBilling(plan)} disabled={!!paying || !termsAccepted}>
                {isBusy ? <><span className="spinner-sm"/> Redirecting…</> : `Get ${plan.name} →`}
              </button>
              <div className="plan-note">Secured by Easebuzz · Instant activation</div>
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
          { q:'Is my payment secure?',               a:'Yes. All payments are processed by Easebuzz — a PCI DSS compliant payment gateway. StayXPulse never sees your card details.' },
        ].map((item,i) => (
          <div key={i} className="faq-item">
            <div className="faq-q">Q: {item.q}</div>
            <div className="faq-a">A: {item.a}</div>
          </div>
        ))}
      </div>

      {billingFor && (
        <BillingModal
          plan={billingFor}
          amount={billingFor.pricing?.[cycle]?.amount}
          cycle={cycle}
          billing={billing}
          setB={setB}
          onClose={() => !paying && setBillingFor(null)}
          onSubmit={submitBilling}
          busy={paying === billingFor.id}
        />
      )}
    </div>
  );
};

// ── Billing details captured before the gateway hand-off ──────────────────────
const BillingModal = ({ plan, amount, cycle, billing, setB, onClose, onSubmit, busy }) => {
  const lab = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 5 };
  const inp = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--border)', borderRadius: 9, background: 'var(--card, #fff)', color: 'var(--gray-900)', fontFamily: 'inherit' };
  const req = <span style={{ color: 'var(--danger, #DC2626)' }}> *</span>;
  const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--card, #fff)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-900)' }}>Billing details</div>
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2 }}>
              {plan.name} · {cycle.charAt(0).toUpperCase() + cycle.slice(1)} · <strong>{fmtCur(amount)}</strong>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: 'var(--gray-400)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto' }}>
          <div style={row}>
            <div><label style={lab}>First name{req}</label><input style={inp} value={billing.firstName} onChange={setB('firstName')} placeholder="First name" /></div>
            <div><label style={lab}>Last name{req}</label><input style={inp} value={billing.lastName} onChange={setB('lastName')} placeholder="Last name" /></div>
          </div>
          <div><label style={lab}>Company name (optional)</label><input style={inp} value={billing.company} onChange={setB('company')} placeholder="Company / hotel name" /></div>
          <div><label style={lab}>Country / Region{req}</label>
            <select style={inp} value={billing.country} onChange={setB('country')}><option>India</option></select>
          </div>
          <div><label style={lab}>Street address{req}</label>
            <input style={{ ...inp, marginBottom: 8 }} value={billing.address1} onChange={setB('address1')} placeholder="House number and street name" />
            <input style={inp} value={billing.address2} onChange={setB('address2')} placeholder="Apartment, suite, unit, etc. (optional)" />
          </div>
          <div><label style={lab}>Town / City{req}</label><input style={inp} value={billing.city} onChange={setB('city')} placeholder="Town / City" /></div>
          <div style={row}>
            <div><label style={lab}>State{req}</label>
              <select style={inp} value={billing.state} onChange={setB('state')}>
                <option value="">Select state…</option>
                {STATES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div><label style={lab}>PIN Code{req}</label><input style={inp} value={billing.pincode} onChange={setB('pincode')} inputMode="numeric" maxLength={6} placeholder="560037" /></div>
          </div>
          <div style={row}>
            <div><label style={lab}>Phone{req}</label><input style={inp} value={billing.phone} onChange={setB('phone')} inputMode="tel" maxLength={10} placeholder="10-digit mobile" /></div>
            <div><label style={lab}>Email address{req}</label><input style={inp} value={billing.email} onChange={setB('email')} type="email" placeholder="you@example.com" /></div>
          </div>
          <div><label style={lab}>Order notes (optional)</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={billing.notes} onChange={setB('notes')} placeholder="Notes about your order, e.g. GSTIN or special instructions." />
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-brand" onClick={onSubmit} disabled={busy} style={{ minWidth: 190 }}>
            {busy ? 'Redirecting…' : `Proceed to Pay ${fmtCur(amount)} →`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePlan;
