const supabase = require('./supabase');
const { generateInvoicePDF } = require('./invoice');
const { sendPaymentSuccessEmail } = require('./email');

const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };

// Single source of truth for turning a captured payment into an active
// subscription. Gateway-agnostic: it works off our own `payment_orders.txnid`,
// so the callback, the webhook and any manual reconciliation all funnel through
// the same code and inherit the same guarantees.
//
// Idempotency has three layers, because money is involved and the browser
// callback races the server-to-server webhook by design:
//   1. an early lookup on payments.payment_id
//   2. a conditional 'created' -> 'paid' flip on payment_orders, so only one
//      caller can proceed
//   3. the UNIQUE constraint on payments.payment_id as the final backstop
const activateSubscription = async ({ txnid, gatewayPaymentId, gateway = 'easebuzz', source = 'callback' }) => {
  const { data: order, error: orderError } = await supabase
    .from('payment_orders')
    .select('*, hotels(*), plans(*)')
    .eq('txnid', txnid)
    .single();

  if (orderError || !order) return { ok: false, reason: 'order_not_found' };

  const paymentRef = gatewayPaymentId || txnid;
  const hotel = order.hotels;
  const plan  = order.plans;
  const days  = CYCLE_DAYS[order.cycle] || 30;

  // Idempotent activation of the hotel + order. Safe to call on every re-entry,
  // which is what makes this crash-safe: if any step after the payments insert
  // fails, the next callback/webhook/reconcile re-runs it and completes.
  const finishActivation = async (validFrom, validTo) => {
    // Only move the expiry forward — never let a re-applied older payment
    // shorten a term a newer payment already extended. NULL (fresh hotel) or a
    // current end at/before the new end both qualify.
    await supabase.from('hotels').update({
      subscription_status: 'active',
      current_plan_id: order.plan_id,
      plan_valid_from: validFrom,
      plan_valid_to: validTo,
      is_active: true,
    }).eq('id', order.hotel_id).or(`plan_valid_to.is.null,plan_valid_to.lte.${validTo}`);
    await supabase.from('payment_orders')
      .update({ gateway_payment_id: gatewayPaymentId || order.gateway_payment_id || null, status: 'paid', paid_at: new Date().toISOString(), valid_from: validFrom, valid_to: validTo })
      .eq('id', order.id).neq('status', 'paid');
  };

  // (1) Already recorded. Re-apply activation (self-heal) in case a prior run
  // recorded the payment but crashed before flipping the hotel/order — the old
  // code returned "already" and left the hotel inactive forever.
  const { data: existing } = await supabase
    .from('payments').select('id, invoice_number, valid_from, valid_to').eq('payment_id', paymentRef).maybeSingle();
  if (existing) {
    if (existing.valid_from && existing.valid_to) await finishActivation(existing.valid_from, existing.valid_to);
    return { ok: true, already: true, invoiceNumber: existing.invoice_number, order };
  }

  // Renewing must EXTEND the existing term, not restart it.
  const now = new Date();
  const currentEnd = hotel?.plan_valid_to ? new Date(hotel.plan_valid_to) : null;
  const base = (currentEnd && currentEnd > now) ? currentEnd : now;
  const validFrom = now.toISOString();
  const validTo   = new Date(base.getTime() + days * 86400000).toISOString();

  // (2) The payments insert IS the atomic claim — UNIQUE(payment_id) means only
  // one caller can create it. Doing this BEFORE the hotel/order writes means a
  // crash can never leave the order 'paid' with no payment row (the old wedge).
  const { data: payment, error: payError } = await supabase.from('payments').insert({
    hotel_id: order.hotel_id,
    plan_id: order.plan_id,
    amount: order.amount,
    payment_id: paymentRef,
    gateway,
    txnid,
    valid_from: validFrom,
    valid_to: validTo,
  }).select().single();

  if (payError) {
    // Another caller won the race and already inserted — self-heal and report.
    if (String(payError.code) === '23505') {
      const { data: winner } = await supabase.from('payments').select('invoice_number, valid_from, valid_to').eq('payment_id', paymentRef).maybeSingle();
      if (winner?.valid_from) await finishActivation(winner.valid_from, winner.valid_to);
      return { ok: true, already: true, invoiceNumber: winner?.invoice_number, order };
    }
    // Nothing was committed (order still 'created') — safe to retry.
    return { ok: false, reason: payError.message };
  }

  // Read the number BACK off the row: a DB trigger assigns it, so trusting a
  // locally generated string would put a different serial on the customer's
  // PDF than the one stored and exported to the GST register.
  const invoiceNumber = payment.invoice_number;

  await finishActivation(validFrom, validTo);

  // Neither the PDF nor the email may fail the activation — the money is taken
  // and the subscription is live regardless.
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateInvoicePDF({
      invoice: invoiceNumber,
      hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
      plan, cycle: order.cycle, amount: order.amount,
      validFrom, validTo, paymentId: paymentRef,
    });
  } catch (e) { console.error('Invoice PDF failed:', e.message); }

  try {
    await sendPaymentSuccessEmail({
      hotelName: hotel.hotel_name, email: hotel.email,
      plan: plan.name, cycle: order.cycle, amount: order.amount,
      invoiceNumber, validFrom, validTo, paymentId: paymentRef, pdfBuffer,
    });
  } catch (e) { console.error('Payment email failed:', e.message); }

  console.log(`💰 Activated via ${source}: hotel=${order.hotel_id} txnid=${txnid} payment=${paymentRef} invoice=${invoiceNumber} until=${validTo.toISOString()}`);

  return { ok: true, already: false, invoiceNumber, validFrom, validTo, order, plan };
};

module.exports = { activateSubscription, CYCLE_DAYS };
