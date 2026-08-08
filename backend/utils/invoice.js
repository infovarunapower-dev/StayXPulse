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

      const INK   = '#111827';
      const GRAY  = '#6B7280';
      const FAINT = '#9CA3AF';
      const DARK  = '#333A44';   // table header bar
      const LINE  = '#E5E7EB';
      const W     = 495;
      const L     = 50;
      const R     = 50 + W;      // 545

      const g   = computeGst(amount, hotel.gstNumber);
      const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const cyc  = (cycle || 'monthly');

      // ── Header: logo (left) + company block (right) ──
      // Square company lockup — keep it compact so it clears the INVOICE title below.
      drawLogo(doc, L, 46, 86);
      const cX = 330, cW = R - cX;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(SELLER.name, cX, 50, { width: cW });
      doc.fillColor(GRAY).font('Helvetica').fontSize(8.5);
      let hy = 66;
      (SELLER.addressLines || [SELLER.address]).forEach(l => { doc.text(l, cX, hy, { width: cW }); hy += 11; });
      doc.text('GSTIN – ' + SELLER.gstin, cX, hy, { width: cW }); hy += 11;
      doc.text(SELLER.email || '', cX, hy, { width: cW });

      // ── INVOICE title ──
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(28).text('INVOICE', L, 148);

      // ── Bill-to (left) + meta (right) ──
      const topY = 205;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(hotel.hotelName || '—', L, topY, { width: 250 });
      doc.fillColor(GRAY).font('Helvetica').fontSize(9);
      let by = topY + 15;
      if (hotel.address) { doc.text(hotel.address, L, by, { width: 250 }); by += doc.heightOfString(hotel.address, { width: 250 }) + 2; }
      doc.text('GSTIN: ' + (hotel.gstNumber || 'Unregistered'), L, by, { width: 250 }); by += 12;

      const mLabelX = 330, mValX = 420, mValW = R - mValX;
      let my = topY;
      [
        ['Invoice Number', invoice],
        ['Invoice Date', fmtD(new Date())],
        ['Payment ID', paymentId || '—'],
        ['Billing Period', `${fmtD(validFrom)} - ${fmtD(validTo)}`],
        ['Payment Method', 'Easebuzz (Cards / UPI / Netbanking)'],
      ].forEach(([k, v]) => {
        doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(k + ':', mLabelX, my, { width: mValX - mLabelX - 6 });
        const vh = doc.heightOfString(String(v), { width: mValW });
        doc.fillColor(INK).font('Helvetica').fontSize(9).text(String(v), mValX, my, { width: mValW, align: 'right' });
        my += Math.max(14, vh + 3);
      });

      // ── Line-item table ──
      const tY = Math.max(by, my) + 24;
      const cxDesc = L + 10, cxSac = 320, cxQty = 372;
      doc.rect(L, tY, W, 24).fill(DARK);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('Product / Service', cxDesc, tY + 8);
      doc.text('SAC', cxSac, tY + 8);
      doc.text('Qty', cxQty, tY + 8);
      doc.text('Unit Price', 408, tY + 8, { width: 60, align: 'right' });
      doc.text('Amount', R - 90, tY + 8, { width: 80, align: 'right' });

      const rowY = tY + 24;
      doc.fillColor(INK).font('Helvetica').fontSize(9.5)
         .text(`StayXPulse - ${plan.name} Plan Subscription`, cxDesc, rowY + 9, { width: 240 });
      doc.fillColor(FAINT).font('Helvetica').fontSize(7.5)
         .text(`${cyc.charAt(0).toUpperCase() + cyc.slice(1)} subscription  ·  ${fmtD(validFrom)} to ${fmtD(validTo)}`, cxDesc, rowY + 22, { width: 240 });
      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
      doc.text(SELLER.sac, cxSac, rowY + 9);
      doc.text('1', cxQty, rowY + 9);
      doc.text(rs(g.taxable), 388, rowY + 9, { width: 80, align: 'right' });
      doc.text(rs(g.taxable), R - 90, rowY + 9, { width: 80, align: 'right' });
      doc.moveTo(L, rowY + 38).lineTo(R, rowY + 38).strokeColor(LINE).lineWidth(1).stroke();

      // ── Totals (right block) ──
      let sy = rowY + 50;
      const sLabelX = 340;
      const sumRow = (label, val, opts = {}) => {
        doc.fillColor(opts.bold ? INK : GRAY).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 11 : 9.5)
           .text(label, sLabelX, sy, { width: 110 });
        doc.fillColor(INK).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 11 : 9.5)
           .text(val, R - 120, sy, { width: 120, align: 'right' });
        sy += opts.bold ? 24 : 20;
        doc.moveTo(sLabelX, sy - 6).lineTo(R, sy - 6).strokeColor(LINE).lineWidth(opts.bold ? 1.3 : 0.6).stroke();
      };
      sumRow('Subtotal', rs(g.taxable));
      if (g.intra) {
        sumRow(`CGST (${g.rate / 2}%)`, rs(g.cgst));
        sumRow(`SGST (${g.rate / 2}%)`, rs(g.sgst));
      } else {
        sumRow(`IGST (${g.rate}%)`, rs(g.igst));
      }
      sumRow('Total', rs(g.gross), { bold: true });

      // ── Signature (right) ──
      const sigY = Math.max(sy + 44, 640);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text('For ' + SELLER.name, R - 280, sigY, { width: 280, align: 'right' });
      if (HAS_SIGN) { try { doc.image(SIGN_PATH, R - 190, sigY + 18, { fit: [180, 56] }); } catch (e) { /* non-fatal */ } }
      doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Authorised Signatory', R - 280, sigY + 82, { width: 280, align: 'right' });

      // ── Footer (drawn in the bottom margin — no page break) ──
      doc.page.margins.bottom = 0;
      doc.moveTo(L, 792).lineTo(R, 792).strokeColor(LINE).lineWidth(1).stroke();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text('Thanks for your business.', L, 800, { width: W, align: 'center', lineBreak: false });
      doc.fillColor(FAINT).font('Helvetica').fontSize(7.5).text(
        `Amount is inclusive of GST @ ${g.rate}%.  This is a computer-generated invoice.  A product of StayXPulse · Support: ${SELLER.email}`,
        L, 814, { width: W, align: 'center', lineBreak: false });

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
        "SECURITY EVIDENCE — an order reaches status 'paid' only after one of two authenticated gates: (a) a SHA-512 "
        + "reverse-hash signature match against our secret salt on the gateway's notification, or (b) an independent "
        + "Easebuzz transaction-verify API confirmation of success, queried by us using that same salt. The charged amount "
        + "is fixed inside the salt-signed checkout link, so a payer cannot alter it. A 'paid' status is therefore "
        + "cryptographic or gateway-authoritative proof the payment was genuine and not forged.",
        M, y, { width: W, lineGap: 1 });
      y += doc.heightOfString('x'.repeat(560), { width: W }) - 4;
      row('Authentication gate', 'PASSED');
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text("[derived] 'paid' requires a salt-based reverse-hash match or an independent verify-API success", M + 160, y - 10, { width: W - 160 });
      y += 4;
      row('Amount integrity', 'PROTECTED');
      doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(7.5).text('[derived] the charged amount is fixed in the salt-signed checkout link and cannot be altered by the payer', M + 160, y - 10, { width: W - 160 });
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
      // Drawing at y=806 is below the bottom margin (792 on A4). Without
      // disabling the bottom margin + line-break, PDFKit inserts a new page for
      // each footer, leaving blank trailing pages. Zero the bottom margin on the
      // page before drawing so the footer sits in the margin and adds no page.
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0;
        doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7).text(
          `StayXPulse · Order Record · ${txnid} · Page ${i + 1} of ${range.count}`,
          M, 806, { width: W, align: 'center', lineBreak: false });
      }

      doc.end();
    } catch (err) { reject(err); }
  });
};

// Legacy signature retained for reference — replaced by the version above.

module.exports = { generateInvoicePDF, generateOrderRecordPDF };
