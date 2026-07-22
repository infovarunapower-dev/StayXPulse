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

  // (1) Already recorded — nothing to do.
  const { data: existing } = await supabase
    .from('payments').select('id, invoice_number').eq('payment_id', paymentRef).maybeSingle();
  if (existing) {
    return { ok: true, already: true, invoiceNumber: existing.invoice_number, order };
  }

  // (2) Claim the order. Only one caller can move it out of 'created'.
  const { data: claimed } = await supabase
    .from('payment_orders')
    .update({ gateway_payment_id: gatewayPaymentId || null, status: 'paid' })
    .eq('id', order.id).eq('status', 'created')
    .select();

  if (!claimed || claimed.length === 0) {
    return { ok: true, already: true, order };
  }

  const hotel = order.hotels;
  const plan  = order.plans;
  const days  = CYCLE_DAYS[order.cycle] || 30;

  // Renewing must EXTEND the existing term, not restart it. Previously a hotel
  // with 300 days remaining who renewed lost every one of them — while the
  // upgrade page promised "Renewing extends from your current expiry".
  const now = new Date();
  const currentEnd = hotel?.plan_valid_to ? new Date(hotel.plan_valid_to) : null;
  const base = (currentEnd && currentEnd > now) ? currentEnd : now;
  const validFrom = now;
  const validTo   = new Date(base.getTime() + days * 86400000);

  await supabase.from('payment_orders')
    .update({ valid_from: validFrom.toISOString(), valid_to: validTo.toISOString() })
    .eq('id', order.id);

  const { data: payment, error: payError } = await supabase.from('payments').insert({
    hotel_id: order.hotel_id,
    plan_id: order.plan_id,
    amount: order.amount,
    payment_id: paymentRef,
    gateway,
    txnid,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
  }).select().single();

  if (payError) {
    // A unique violation here means the other caller won the race after all.
    if (String(payError.code) === '23505') return { ok: true, already: true, order };
    return { ok: false, reason: payError.message };
  }

  // Read the number BACK off the row: a DB trigger assigns it, so trusting a
  // locally generated string would put a different serial on the customer's
  // PDF than the one stored and exported to the GST register.
  const invoiceNumber = payment.invoice_number;

  await supabase.from('hotels').update({
    subscription_status: 'active',
    current_plan_id: order.plan_id,
    plan_valid_from: validFrom.toISOString(),
    plan_valid_to: validTo.toISOString(),
    is_active: true,
  }).eq('id', order.hotel_id);

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
