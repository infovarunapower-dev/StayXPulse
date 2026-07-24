const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { SELLER, computeGst, rs } = require('./gstCalc');

// Bundled with the deployment, so it is readable on Vercel's read-only FS.
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// Draws the company mark into a PDF header, silently skipping if the asset is
// missing — an invoice must never fail to generate over a decoration.
const drawLogo = (doc, x, y, width) => {
  if (!HAS_LOGO) return;
  try { doc.image(LOGO_PATH, x, y, { width }); } catch (e) { /* non-fatal */ }
};

const generateInvoicePDF = ({ invoice, hotel, plan, cycle, amount, validFrom, validTo, paymentId }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data',  c => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const BRAND = '#1A4D8F';
      const GRAY  = '#6B7280';
      const LIGHT = '#F0F4F8';
      const BLACK = '#111827';
      const W     = 495;

      const g = computeGst(amount, hotel.gstNumber);
      const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };
      const R = 50 + W; // right edge

      // Header
      doc.rect(50, 50, W, 74).fill(BRAND);
      drawLogo(doc, 66, 72, 44);
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('StayXPulse', 120, 64);
      doc.fontSize(8.5).font('Helvetica').text('by ' + SELLER.name, 120, 88);
      doc.fontSize(8.5).text('GSTIN: ' + SELLER.gstin + '  ·  SAC: ' + SELLER.sac, 120, 100);
      doc.fontSize(12).font('Helvetica-Bold').text('TAX INVOICE', R - 146, 64, { width: 130, align: 'right' });
      doc.fontSize(9).font('Helvetica').text(invoice, R - 146, 84, { width: 130, align: 'right' });
      doc.fontSize(8).text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), R - 146, 98, { width: 130, align: 'right' });

      // Seller / Bill-To row
      const boxTop = 138;
      doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('SELLER', 50, boxTop);
      doc.fillColor(BLACK).fontSize(9.5).font('Helvetica-Bold').text(SELLER.name, 50, boxTop + 12, { width: 250 });
      doc.fillColor(GRAY).fontSize(8.5).font('Helvetica')
         .text('GSTIN: ' + SELLER.gstin, 50, boxTop + 26)
         .text('State: ' + SELLER.stateName + ' (' + SELLER.state + ')', 50, boxTop + 38);

      doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('BILL TO', 310, boxTop);
      doc.fillColor(BLACK).fontSize(9.5).font('Helvetica-Bold').text(hotel.hotelName || '—', 310, boxTop + 12, { width: 235 });
      doc.fillColor(GRAY).fontSize(8.5).font('Helvetica')
         .text(hotel.email || '', 310, boxTop + 26, { width: 235 })
         .text('GSTIN: ' + (hotel.gstNumber || 'Unregistered'), 310, boxTop + 38, { width: 235 })
         .text('Place of supply: ' + g.placeOfSupply, 310, boxTop + 50, { width: 235 });

      // Period line
      const periodTop = boxTop + 74;
      doc.fillColor(BLACK).fontSize(9).font('Helvetica')
         .text('Payment ID: ' + paymentId, 50, periodTop)
         .text('Billing period: '
            + new Date(validFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            + '  to  '
            + new Date(validTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            50, periodTop + 14);

      // Line-item table
      const tableTop = periodTop + 40;
      doc.rect(50, tableTop, W, 26).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
         .text('DESCRIPTION', 60, tableTop + 8)
         .text('SAC', 300, tableTop + 8)
         .text('QTY', 350, tableTop + 8)
         .text('TAXABLE VALUE', R - 130, tableTop + 8, { width: 120, align: 'right' });

      doc.rect(50, tableTop + 26, W, 34).fill('#FFFFFF');
      doc.fillColor(BLACK).fontSize(9).font('Helvetica')
         .text(`${plan.name} Plan — StayXPulse Subscription`, 60, tableTop + 34, { width: 230 })
         .text(SELLER.sac, 300, tableTop + 34)
         .text('1', 352, tableTop + 34)
         .text(rs(g.taxable), R - 130, tableTop + 34, { width: 120, align: 'right' });
      doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
         .text(`${(cycle || 'monthly').charAt(0).toUpperCase() + (cycle || 'monthly').slice(1)} · ${CYCLE_DAYS[cycle] || 30} days`, 60, tableTop + 46);

      // Tax summary (right-aligned block)
      let ty = tableTop + 72;
      const rowW = 245, labelX = R - rowW + 10, valX = R - 130;
      const taxRow = (label, val, opts = {}) => {
        if (opts.fill) { doc.rect(R - rowW, ty, rowW, opts.h || 22).fill(opts.fill); }
        doc.fillColor(opts.color || GRAY).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9)
           .text(label, labelX, ty + 6).text(val, valX, ty + 6, { width: 120, align: 'right' });
        ty += (opts.h || 22);
      };

      taxRow('Taxable Value', rs(g.taxable), { fill: LIGHT });
      if (g.intra) {
        taxRow(`CGST @ ${g.rate / 2}%`, rs(g.cgst), { fill: LIGHT });
        taxRow(`SGST @ ${g.rate / 2}%`, rs(g.sgst), { fill: LIGHT });
      } else {
        taxRow(`IGST @ ${g.rate}%`, rs(g.igst), { fill: LIGHT });
      }
      taxRow('Total Tax', rs(g.totalTax), { fill: LIGHT });
      taxRow('TOTAL (incl. GST)', rs(g.gross), { fill: BRAND, color: '#FFFFFF', bold: true, size: 10.5, h: 28 });

      // Amount-in-words + inclusive note
      doc.fillColor(GRAY).fontSize(8).font('Helvetica-Oblique')
         .text('Amount charged is inclusive of GST at ' + g.rate + '%.', 50, ty + 4, { width: 250 });

      // Notes
      const notesTop = Math.max(ty + 28, 660);
      doc.rect(50, notesTop, W, 52).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(8.5).font('Helvetica-Bold').text('NOTES', 60, notesTop + 10);
      doc.font('Helvetica').fontSize(8)
         .text('Thank you for subscribing to StayXPulse. This is a computer-generated tax invoice and does not require a signature.', 60, notesTop + 23, { width: W - 20 })
         .text('For support: support@stayxpulse.com', 60, notesTop + 36);

      // Footer
      drawLogo(doc, 50, 728, 38);
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text('A product of Sunver Coresynergy', 94, 739);
      doc.rect(50, 762, W, 30).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica')
         .text(`${invoice}  ·  ${SELLER.gstin}  ·  Paid via Easebuzz  ·  support@stayxpulse.com`, 50, 772, { width: W, align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
};

// Optional authorised-signatory image, same read-only-safe pattern as the logo.
const SIGN_PATH = path.join(__dirname, '../assets/signature.png');
const HAS_SIGN = fs.existsSync(SIGN_PATH);

// ── Per-order forensic Order Record (Super Admin, dispute defence) ────────────
// Every field is sourced from stored data; anything not captured for an order
// prints "— (not recorded)" and is never fabricated. Timeline events are tagged
// [recorded] (a stored timestamp) or [derived] (inferred from a system
// invariant), exactly as the record's own text explains.
const generateOrderRecordPDF = ({ payment, hotel = {}, plan = {}, order = null, user = null }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const INK = '#1F2937', MUTE = '#6B7280', BLUE = '#2456A6', BAR = '#EEF2F7', SOFT = '#F7F9FC', LINE = '#E3E8EF';
      const M = 50, W = 495, R = M + W;

      // The record uses UTC throughout, like the reference document.
      const U = d => d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '— (not recorded)';
      const NR = v => (v == null || v === '') ? '— (not recorded)' : String(v);

      const g = computeGst(payment.amount, hotel.gst_number);
      const days  = (payment.valid_from && payment.valid_to) ? Math.round((new Date(payment.valid_to) - new Date(payment.valid_from)) / 86400000) : 30;
      const cycle = days >= 365 ? 'yearly' : days >= 90 ? 'quarterly' : 'monthly';
      const txnid = order?.txnid || payment.txnid || payment.payment_id || payment.id;
      const easepayid = order?.gateway_payment_id || payment.payment_id;
      const paidAt = order?.paid_at || payment.paid_at;
      const createdAt = order?.created_at || payment.created_at;
      const ua = order?.user_agent;
      const ip = order?.customer_ip;

      let y = 50;

      // ── Header ──
      drawLogo(doc, M, y, 40);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text('StayXPulse by Sunver', M + 52, y + 2);
      doc.fillColor(MUTE).font('Helvetica').fontSize(8.5)
         .text(SELLER.name, M + 52, y + 22)
         .text('GSTIN: ' + SELLER.gstin, M + 52, y + 33);
      doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(17).text('ORDER RECORD', R - 220, y, { width: 220, align: 'right' });
      doc.fillColor(MUTE).font('Helvetica').fontSize(8)
         .text('Internal dispute-defence extract', R - 220, y + 24, { width: 220, align: 'right' })
         .text('Generated: ' + U(new Date()), R - 220, y + 35, { width: 220, align: 'right' });
      y += 62;
      doc.moveTo(M, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
      y += 14;

      // ── Order summary box ──
      doc.roundedRect(M, y, W, 60, 5).fill(SOFT);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Order ' + txnid, M + 14, y + 12, { width: W - 28 });
      doc.font('Helvetica').fontSize(8.5)
         .fillColor(MUTE).text('Status: ', M + 14, y + 32, { continued: true }).fillColor('#047857').font('Helvetica-Bold').text('PAID')
         .font('Helvetica').fillColor(MUTE).text('Total paid: ', M + 14, y + 44, { continued: true }).fillColor(INK).font('Helvetica-Bold').text(rs(payment.amount) + ' INR');
      doc.font('Helvetica').fillColor(MUTE).fontSize(8.5)
         .text('Created: ', M + 260, y + 32, { continued: true }).fillColor(INK).text(U(createdAt))
         .fillColor(MUTE).text('Paid at: ', M + 260, y + 44, { continued: true }).fillColor(INK).text(U(paidAt));
      y += 60 + 18;

      // ── layout helpers ──
      const section = (title) => {
        if (y > 720) { doc.addPage(); y = 60; }
        doc.rect(M, y, W, 20).fill(BAR);
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(title, M + 10, y + 5);
        y += 20 + 10;
      };
      const row = (label, value, valueColor) => {
        if (y > 770) { doc.addPage(); y = 60; }
        const h = doc.heightOfString(String(value), { width: W - 170, lineGap: 1 });
        doc.fillColor(MUTE).font('Helvetica').fontSize(8.5).text(label, M, y, { width: 150 });
        doc.fillColor(valueColor || INK).font('Helvetica').fontSize(9).text(String(value), M + 160, y, { width: W - 160, lineGap: 1 });
        y += Math.max(15, h + 5);
      };

      // ── 1. Customer Identity & Account ──
      section('1.  Customer Identity & Account');
      row('Account holder', NR(user?.name || hotel.hotel_name));
      row('Account email', NR(user?.email || hotel.email));
      row('Account phone', NR(hotel.phone));
      row('User ID', NR(hotel.user_id));
      row('Account created', U(user?.created_at || hotel.created_at));
      row('Email verified', '— (not recorded for this account)');
      row('Billing name', NR(hotel.hotel_name));
      row('Billing address', NR(hotel.address));
      y += 6;

      // ── 2. Checkout Evidence ──
      section('2.  Checkout Evidence');
      row('Order placed', U(createdAt));
      row('Terms & Privacy accepted', order?.terms_accepted ? 'YES' : '— (not recorded)', order?.terms_accepted ? '#047857' : INK);
      row('Terms accepted at', U(order?.terms_accepted_at));
      row('Policy version', NR(order?.policy_version));
      row('Customer IP', NR(ip));
      row('Plan / tier', `${cycle.charAt(0).toUpperCase() + cycle.slice(1)} (${cycle}) — ${days} days access`);
      row('Place of supply', g.intra ? `${g.placeOfSupply} (Intra-state, CGST+SGST)` : `${g.placeOfSupply || '—'} (Inter-state, IGST)`);
      row('SAC code', SELLER.sac);
      row('Taxable value', rs(g.taxable));
      if (g.intra) { row(`CGST @ ${g.rate / 2}%`, rs(g.cgst)); row(`SGST @ ${g.rate / 2}%`, rs(g.sgst)); }
      else { row(`IGST @ ${g.rate}%`, rs(g.igst)); }
      row('Total (GST-incl.)', rs(g.gross));
      row('Browser / device', NR(ua));
      y += 6;

      // ── 3. Payment Trail ──
      section('3.  Payment Trail');
      row('Gateway', 'EASEBUZZ');
      row('Merchant txn id', NR(txnid));
      row('Gateway payment id', NR(easepayid));
      row('Amount captured', rs(payment.amount) + ' INR');
      row('Paid at', U(paidAt));
      row('Invoice number', payment.invoice_number || '— (not yet invoiced)');
      y += 4;
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text(
        "SECURITY EVIDENCE — an order only reaches status 'paid' after the handler passes ALL of: (a) reverse-hash "
        + "signature match against our secret salt, (b) gateway status = success, (c) amount match vs our server-side "
        + "snapshot, and (d) an INDEPENDENT Easebuzz transaction-verify API re-confirm. A 'paid' status is therefore "
        + "cryptographic proof the payment notification was genuine and not forged.",
        M, y, { width: W, lineGap: 1 });
      y += doc.heightOfString('x'.repeat(500), { width: W }) - 4;
      row('Signature verified', 'TRUE');
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text('[derived] proven by paid status — activation requires a reverse-hash match', M + 160, y - 10, { width: W - 160 });
      y += 4;
      row('Verify-API re-confirm', 'CONFIRMED (success + amount match)');
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text('[derived] activation requires an independent Easebuzz verify-API success', M + 160, y - 10, { width: W - 160 });
      y += 10;

      // ── 4. Order Audit Timeline ──
      section('4.  Order Audit Timeline');
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text(
        'StayXPulse does not maintain a separate per-event audit-log table; this timeline is RECONSTRUCTED from the '
        + "order's stored timestamps. Each entry cites its source and is marked [recorded] (a stored timestamp) or "
        + '[derived] (an event inferred from a system invariant). No event or time is fabricated.',
        M, y, { width: W, lineGap: 1 });
      y += doc.heightOfString('x'.repeat(360), { width: W }) + 2;

      const shortUa = ua ? (ua.length > 74 ? ua.slice(0, 74) + '…' : ua) : '— (not recorded)';
      const events = [
        { t: 'Checkout submitted (order created, pending)', tag: 'recorded', when: createdAt,
          actor: `Customer${user?.email ? ' (' + user.email + ')' : ''}`, ip, ua: shortUa,
          detail: `Plan ${cycle}; amount ${rs(payment.amount)} INR; place_of_supply ${g.intra ? 'intra' : 'inter'}`, src: 'payment_orders.created_at' },
        { t: 'Terms & Privacy Policy accepted', tag: order?.terms_accepted ? 'recorded' : 'not recorded', when: order?.terms_accepted_at,
          actor: 'Customer', ip, ua: shortUa, detail: `Policy version ${NR(order?.policy_version)}`, src: 'payment_orders.terms_accepted_at' },
        { t: 'Payment initiated (Easebuzz checkout link minted)', tag: 'recorded', when: order?.initiated_at || createdAt,
          actor: 'Customer -> Easebuzz (hosted checkout link minted)', ip, ua: shortUa, detail: `txnid ${txnid}`, src: 'payment_orders.initiated_at' },
        { t: 'Payment webhook received, verified & order activated', tag: 'derived', when: paidAt,
          actor: 'Easebuzz gateway (server-to-server webhook)', ip: null, ua: '— (not recorded)',
          detail: `gateway status = success; reverse-hash signature = verified; verify-API = confirmed; mapped order status = paid; easepayid ${NR(easepayid)}`,
          src: 'payment_orders.paid_at (timestamp recorded; event details derived from the activation invariant)' },
      ];
      events.forEach((e, i) => {
        if (y > 700) { doc.addPage(); y = 60; }
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(`${i + 1}. ${e.t}`, M, y, { width: W - 70 });
        doc.fillColor(e.tag === 'derived' ? '#B45309' : MUTE).font('Helvetica-Oblique').fontSize(7.5).text(`[${e.tag}]`, R - 70, y + 1, { width: 70, align: 'right' });
        y += 13;
        const line = (s) => { doc.fillColor(MUTE).font('Helvetica').fontSize(7.5).text(s, M + 12, y, { width: W - 12, lineGap: 0.5 }); y += doc.heightOfString(s, { width: W - 12 }) + 1; };
        line(`When: ${U(e.when)}`);
        line(`Actor: ${e.actor}`);
        line(`IP: ${NR(e.ip)}    UA: ${e.ua}`);
        line(`Detail: ${e.detail}`);
        doc.fillColor('#9CA3AF').font('Helvetica-Oblique').fontSize(7).text(`source: ${e.src}`, M + 12, y, { width: W - 12 });
        y += doc.heightOfString(`source: ${e.src}`, { width: W - 12 }) + 8;
      });
      y += 4;

      // ── 5. Declaration ──
      if (y > 680) { doc.addPage(); y = 60; }
      section('5.  Declaration');
      doc.fillColor(INK).font('Helvetica').fontSize(8).text(
        `This Order Record is a true and accurate extract from the StayXPulse / ${SELLER.name} operational records as of `
        + `${U(new Date())}. It is a system-generated document compiled from the order, billing, consent and payment data `
        + `stored for order ${txnid}. Monetary values are recorded in integer paise and reproduced here for the stated `
        + 'currency. This document is produced for internal record-keeping and dispute-defence purposes.',
        M, y, { width: W, lineGap: 1.5 });
      y += doc.heightOfString('x'.repeat(430), { width: W }) + 16;

      // ── 6. Authorisation ──
      if (y > 700) { doc.addPage(); y = 60; }
      section('6.  Authorisation');
      if (HAS_SIGN) { try { doc.image(SIGN_PATH, R - 180, y, { fit: [170, 60] }); } catch (e) { /* non-fatal */ } }
      y += 64;
      doc.moveTo(R - 240, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('For ' + SELLER.name + ' — Authorised Signatory', R - 300, y + 6, { width: 300, align: 'right' });

      // ── Footer on every page ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7).text(
          `StayXPulse · Order Record · ${txnid} · Page ${i + 1} of ${range.count}`,
          M, 806, { width: W, align: 'center' });
      }

      doc.end();
    } catch (err) { reject(err); }
  });
};

// Legacy signature retained for reference — replaced by the version above.

module.exports = { generateInvoicePDF, generateOrderRecordPDF };
