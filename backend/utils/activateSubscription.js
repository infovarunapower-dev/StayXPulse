const supabase = require('./supabase');
const { generateInvoicePDF } = require('./invoice');
const { sendPaymentSuccessEmail } = require('./email');

const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };

// Single source of truth for turning a captured Razorpay payment into an active
// subscription. Called from BOTH the browser callback (/payments/verify) and the
// Razorpay webhook, which race each other by design — whichever arrives first
// wins and the other becomes a no-op.
//
// Idempotency has three layers, because money is involved:
//   1. an early lookup on payments.payment_id
//   2. a conditional status flip on razorpay_orders (only 'created' -> 'paid'),
//      so two concurrent callers cannot both proceed
//   3. the UNIQUE constraint on payments.payment_id as the final backstop
const activateSubscription = async ({ razorpayOrderId, paymentId, signature = null, source = 'verify' }) => {
  const { data: rzpOrder, error: orderError } = await supabase
    .from('razorpay_orders')
    .select('*, hotels(*), plans(*)')
    .eq('razorpay_order_id', razorpayOrderId)
    .single();

  if (orderError || !rzpOrder) return { ok: false, reason: 'order_not_found' };

  // (1) Already recorded — nothing to do.
  const { data: existing } = await supabase
    .from('payments').select('id, invoice_number').eq('payment_id', paymentId).maybeSingle();
  if (existing) {
    return { ok: true, already: true, invoiceNumber: existing.invoice_number, rzpOrder };
  }

  // (2) Claim the order. Only one caller can move it out of 'created'.
  const { data: claimed } = await supabase
    .from('razorpay_orders')
    .update({ razorpay_payment_id: paymentId, razorpay_signature: signature, status: 'paid' })
    .eq('id', rzpOrder.id).eq('status', 'created')
    .select();

  if (!claimed || claimed.length === 0) {
    // Someone else claimed it microseconds ago; let them finish.
    return { ok: true, already: true, rzpOrder };
  }

  const hotel = rzpOrder.hotels;
  const plan  = rzpOrder.plans;
  const days  = CYCLE_DAYS[rzpOrder.cycle] || 30;

  // Renewing must EXTEND the existing term, not restart it. Previously a hotel
  // with 300 days remaining who renewed lost every one of them — while the
  // upgrade page promised "Renewing extends from your current expiry".
  const now = new Date();
  const currentEnd = hotel?.plan_valid_to ? new Date(hotel.plan_valid_to) : null;
  const base = (currentEnd && currentEnd > now) ? currentEnd : now;
  const validFrom = now;
  const validTo   = new Date(base.getTime() + days * 86400000);

  await supabase.from('razorpay_orders')
    .update({ valid_from: validFrom.toISOString(), valid_to: validTo.toISOString() })
    .eq('id', rzpOrder.id);

  const { data: payment, error: payError } = await supabase.from('payments').insert({
    hotel_id: rzpOrder.hotel_id,
    plan_id: rzpOrder.plan_id,
    amount: rzpOrder.amount_display,
    payment_id: paymentId,
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    razorpay_order_id: razorpayOrderId,
  }).select().single();

  if (payError) {
    // A unique violation here means the other caller won the race after all.
    if (String(payError.code) === '23505') return { ok: true, already: true, rzpOrder };
    return { ok: false, reason: payError.message };
  }

  // Read the number BACK off the row: a DB trigger assigns it, so trusting a
  // locally generated string would put a different serial on the customer's
  // PDF than the one stored and exported to the GST register.
  const invoiceNumber = payment.invoice_number;

  await supabase.from('hotels').update({
    subscription_status: 'active',
    current_plan_id: rzpOrder.plan_id,
    plan_valid_from: validFrom.toISOString(),
    plan_valid_to: validTo.toISOString(),
    is_active: true,
  }).eq('id', rzpOrder.hotel_id);

  // Neither the PDF nor the email may fail the activation — the money is taken
  // and the subscription is live regardless.
  let pdfBuffer = null;
  try {
    pdfBuffer = await generateInvoicePDF({
      invoice: invoiceNumber,
      hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
      plan, cycle: rzpOrder.cycle, amount: rzpOrder.amount_display,
      validFrom, validTo, paymentId,
    });
  } catch (e) { console.error('Invoice PDF failed:', e.message); }

  try {
    await sendPaymentSuccessEmail({
      hotelName: hotel.hotel_name, email: hotel.email,
      plan: plan.name, cycle: rzpOrder.cycle, amount: rzpOrder.amount_display,
      invoiceNumber, validFrom, validTo, paymentId, pdfBuffer,
    });
  } catch (e) { console.error('Payment email failed:', e.message); }

  console.log(`💰 Subscription activated via ${source}: hotel=${rzpOrder.hotel_id} payment=${paymentId} invoice=${invoiceNumber} until=${validTo.toISOString()}`);

  return { ok: true, already: false, invoiceNumber, validFrom, validTo, rzpOrder, plan };
};

module.exports = { activateSubscription, CYCLE_DAYS };
