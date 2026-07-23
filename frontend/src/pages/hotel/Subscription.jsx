import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useFetch } from '../../utils/hooks';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { PageHeader, Card, CardHeader, Badge, Table, PageSkeleton } from '../../components/shared/UI';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtCur  = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const spanDays = (a, b) => (a && b) ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)) : null;
const daysLeft = end => end ? Math.ceil((new Date(end) - Date.now()) / 86400000) : 0;

const Subscription = () => {
  const navigate = useNavigate();
  const { data, loading, error } = useFetch('/hotel/subscription');
  // History has its own dedicated source so it does not depend on the combined
  // subscription endpoint resolving cleanly.
  const { data: payData } = useFetch('/payments/my-payments');
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  // "I paid but nothing happened." A redirect flow can lose the customer on the
  // way back, so ask the gateway directly rather than let them pay twice.
  const checkPayment = async () => {
    setChecking(true);
    try {
      const { data: r } = await api.post('/payments/reconcile', {});
      if (r.activated) {
        toast.success('Payment found — your subscription is now active!');
        setTimeout(() => window.location.reload(), 1200);
      } else if (r.status === 'no_pending_payment') {
        toast('No pending payment found for your account.', { icon: 'ℹ️' });
      } else {
        toast.error(`Your last payment shows as "${r.status}". If you were charged, contact support with that reference.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not check your payment.');
    } finally { setChecking(false); }
  };

  // Easebuzz returns the customer to this page with ?payment=... after checkout.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('payment');
    if (!p) return;
    window.history.replaceState({}, '', '/hotel/subscription');   // clear the param
    if (p === 'success') {
      toast.success('🎉 Payment successful — your subscription is now active!');
      setTimeout(() => window.location.reload(), 1200);
    } else if (p === 'pending') {
      // Gateway took the money but our callback could not confirm it — check
      // directly rather than leave the hotel stranded.
      toast('Confirming your payment…', { icon: '⏳' });
      checkPayment();
    } else {
      toast.error('Payment was not completed. If you were charged, click "Paid but not showing?".');
    }
    // eslint-disable-next-line
  }, []);

  if (loading) return <PageSkeleton />;

  // Prefer the subscription endpoint (it carries payment history), but fall
  // back to the auth-context hotel for the status card so this page can never
  // show "Inactive" while the account is genuinely active. AuthContext uses
  // camelCase; normalise it to the snake_case this page reads.
  const fetched = data?.data?.hotel;
  const authHotel = user?.hotel
    ? {
        subscription_status: user.hotel.subscriptionStatus,
        trial_start_date:    user.hotel.trialStartDate,
        trial_end_date:      user.hotel.trialEndDate,
        plan_valid_from:     user.hotel.planValidFrom,
        plan_valid_to:       user.hotel.planValidTo,
      }
    : {};
  const hotel    = (fetched && fetched.subscription_status) ? fetched : authHotel;
  // Prefer the dedicated payments endpoint; fall back to whatever the combined
  // endpoint returned.
  const payments = (Array.isArray(payData?.data) && payData.data.length)
    ? payData.data
    : (data?.data?.payments || []);
  const status   = hotel.subscription_status;

  // ── Build unified history rows (trial first, then each paid period) ──
  const rows = [];

  if (hotel.trial_start_date || hotel.trial_end_date) {
    const dl = daysLeft(hotel.trial_end_date);
    const active = status === 'trial' && dl > 0;
    rows.push({
      key: 'trial',
      plan: 'Free Trial',
      isTrial: true,
      start: hotel.trial_start_date,
      end: hotel.trial_end_date,
      duration: spanDays(hotel.trial_start_date, hotel.trial_end_date),
      active,
      statusLabel: active ? `${dl} day${dl > 1 ? 's' : ''} left` : 'Completed',
      amount: null,
    });
  }

  payments.forEach((p, i) => {
    const dl = daysLeft(p.valid_to);
    const active = dl > 0;
    rows.push({
      key: p.id || `pay-${i}`,
      plan: p.plans?.name || 'Plan',
      start: p.valid_from,
      end: p.valid_to,
      duration: spanDays(p.valid_from, p.valid_to),
      active,
      statusLabel: active ? `${dl} day${dl > 1 ? 's' : ''} left` : 'Expired',
      amount: p.amount,
      invoiceNumber: p.invoice_number,
      paymentId: p.payment_id,
    });
  });

  const downloadInvoice = async (paymentId, invoiceNumber) => {
    const t = toast.loading('Preparing invoice…');
    try {
      const res = await api.get(`/payments/invoice/${paymentId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoiceNumber || paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded', { id: t });
    } catch {
      toast.error('Could not download invoice', { id: t });
    }
  };

  const columns = [
    { label: 'Plan', render: r => (
      <div>
        <strong>{r.plan}</strong>
        {r.isTrial && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>TRIAL</span>}
      </div>
    )},
    { label: 'Period', render: r => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.start)} → {fmtDate(r.end)}</span> },
    { label: 'Duration', render: r => r.duration != null ? `${r.duration} days` : '—' },
    { label: 'Status', render: r => <Badge status={r.active ? 'active' : 'suspended'} label={r.statusLabel} /> },
    { label: 'Amount', render: r => r.amount != null ? <strong>{fmtCur(r.amount)}</strong> : '—' },
    { label: 'Invoice', render: r => r.invoiceNumber
      ? <button className="btn btn-sm btn-outline" onClick={() => downloadInvoice(r.paymentId, r.invoiceNumber)}>⬇ PDF</button>
      : <span style={{ color: 'var(--gray-300)' }}>—</span>
    },
  ];

  // ── Current-status summary ──
  const currentPlanName = status === 'trial' ? 'Free Trial' : (hotel.plans?.name || '—');
  const currentEnd      = status === 'trial' ? hotel.trial_end_date : hotel.plan_valid_to;
  const currentLeft     = daysLeft(currentEnd);
  const summaryBadge    = status === 'active' ? 'active' : status === 'trial' ? 'trial' : status === 'expired' ? 'expired' : 'suspended';

  return (
    <div>
      <PageHeader
        title="Subscription"
        subtitle="Your trial and plan history"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={checkPayment} disabled={checking}>
              {checking ? 'Checking…' : 'Paid but not showing?'}
            </button>
            <button className="btn btn-brand" onClick={() => navigate('/hotel/upgrade')}>⬆ Upgrade / Renew</button>
          </div>
        }
      />

      {/* Current status */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Current Plan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>{currentPlanName}</span>
              <Badge status={summaryBadge} label={status || 'inactive'} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 6 }}>
              {currentEnd ? <>Valid till <strong>{fmtDate(currentEnd)}</strong></> : 'No active plan'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: currentLeft > 0 ? 'var(--brand)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(0, currentLeft)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 600, marginTop: 4 }}>
              {currentLeft > 0 ? 'days remaining' : 'expired'}
            </div>
          </div>
        </div>
      </Card>

      {/* History */}
      <Card>
        <CardHeader title="Subscription History" />
        {error && rows.length === 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400E' }}>
            Couldn’t load your payment history just now. Your plan status above is current — please refresh in a moment.
          </div>
        )}
        <Table columns={columns} data={rows} emptyMessage="No subscription history yet" />
      </Card>
    </div>
  );
};

export default Subscription;
