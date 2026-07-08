const PDFDocument = require('pdfkit');

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

      // Header
      doc.rect(50, 50, W, 70).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('StayXPulse', 66, 66);
      doc.fontSize(10).font('Helvetica').text('Smart Hotel Management Platform', 66, 92);
      doc.fontSize(11).font('Helvetica-Bold').text('TAX INVOICE', 400, 66, { width: 130, align: 'right' });
      doc.fontSize(9).font('Helvetica').text(invoice, 400, 84, { width: 130, align: 'right' });

      // Invoice meta
      doc.fillColor(BLACK).fontSize(10).font('Helvetica')
         .text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, 50, 138)
         .text(`Payment ID: ${paymentId}`, 50, 154);

      // Bill To
      doc.rect(50, 178, W, 80).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text('BILL TO', 66, 190);
      doc.fillColor(BLACK).fontSize(11).font('Helvetica-Bold').text(hotel.hotelName, 66, 204);
      doc.fontSize(9).font('Helvetica').fillColor(GRAY)
         .text(hotel.email, 66, 219)
         .text(hotel.address || '', 66, 232)
         .text(`GST: ${hotel.gstNumber}`, 66, 245);

      // Validity badge
      doc.rect(340, 190, 190, 56).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text('VALID FROM', 356, 198).text('VALID TO', 430, 198);
      doc.fontSize(10).font('Helvetica-Bold')
         .text(new Date(validFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 356, 212)
         .text(new Date(validTo).toLocaleDateString('en-IN',   { day: '2-digit', month: 'short', year: 'numeric' }), 430, 212);
      doc.fontSize(9).font('Helvetica')
         .text(cycle.charAt(0).toUpperCase() + cycle.slice(1) + ' Plan', 356, 232, { width: 174, align: 'center' });

      // Line items
      const tableTop = 278;
      doc.rect(50, tableTop, W, 28).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
         .text('DESCRIPTION', 66, tableTop + 9).text('CYCLE', 260, tableTop + 9)
         .text('DURATION', 340, tableTop + 9).text('AMOUNT (₹)', 430, tableTop + 9, { width: 100, align: 'right' });

      const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };
      doc.rect(50, tableTop + 28, W, 32).fill('#FFFFFF');
      doc.fillColor(BLACK).fontSize(10).font('Helvetica')
         .text(`${plan.name} Plan — StayXPulse Subscription`, 66, tableTop + 38)
         .text(cycle.charAt(0).toUpperCase() + cycle.slice(1), 260, tableTop + 38)
         .text(`${CYCLE_DAYS[cycle] || 30} days`, 340, tableTop + 38)
         .text(`₹${amount.toLocaleString('en-IN')}`, 430, tableTop + 38, { width: 100, align: 'right' });

      // Totals
      const totTop = tableTop + 80;
      doc.rect(320, totTop, 225, 28).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text('Subtotal', 330, totTop + 9).text(`₹${amount.toLocaleString('en-IN')}`, 430, totTop + 9, { width: 100, align: 'right' });
      doc.rect(320, totTop + 28, 225, 28).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica').text('GST (0%)', 330, totTop + 37).text('₹0', 430, totTop + 37, { width: 100, align: 'right' });
      doc.rect(320, totTop + 56, 225, 32).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('TOTAL', 330, totTop + 65).text(`₹${amount.toLocaleString('en-IN')}`, 430, totTop + 65, { width: 100, align: 'right' });

      // Notes
      doc.rect(50, totTop + 108, W, 56).fill(LIGHT);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold').text('NOTES', 66, totTop + 120);
      doc.font('Helvetica').fontSize(9)
         .text('Thank you for subscribing to StayXPulse. This is a computer-generated invoice.', 66, totTop + 133)
         .text('For support: support@stayxpulse.com  |  www.stayxpulse.com', 66, totTop + 146);

      // Footer
      doc.rect(50, 760, W, 32).fill(BRAND);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica')
         .text(`${invoice}  ·  StayXPulse  ·  Powered by Razorpay  ·  support@stayxpulse.com`, 50, 771, { width: W, align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
};

// ── Per-order forensic Order Record (Super Admin) ─────────────────────────────
// Built only from data StayXPulse actually stores; fields it doesn't capture
// (IP / user-agent / consent) are printed as "Not recorded" — never fabricated.
const generateOrderRecordPDF = ({ payment, hotel = {}, plan = {} }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const BRAND = '#0F766E', GRAY = '#6B7280', LIGHT = '#F2F7F5', BLACK = '#0E1B17', BORDER = '#E2ECE8';
      const M = 50, W = 495, R = M + W;
      const SELLER = { name: 'Sunver Coresynergy Solutions Pvt Ltd', gstin: '09ABNCS5321F1Z7', state: '09', sac: '998314' };
      const RATE = 18;

      const fmt = d => d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST' : '—';
      const rup = n => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // GST-inclusive back-calculation
      const gross = Math.round(Number(payment.amount || 0) * 100);
      const taxable = Math.round(gross * 100 / (100 + RATE));
      const tax = gross - taxable;
      const bState = (hotel.gst_number || '').trim().slice(0, 2);
      const intra = !!bState && bState === SELLER.state;
      let cgst = 0, sgst = 0, igst = 0;
      if (intra) { sgst = Math.floor(tax / 2); cgst = tax - sgst; } else { igst = tax; }
      const days = (payment.valid_from && payment.valid_to) ? Math.round((new Date(payment.valid_to) - new Date(payment.valid_from)) / 86400000) : 0;
      const cycle = days >= 365 ? 'Yearly' : days >= 90 ? 'Quarterly' : 'Monthly';
      const isTest = String(payment.payment_id || '').startsWith('TEST-');
      const pos = bState ? `${bState}${intra ? ' (Intra-state)' : ' (Inter-state)'}` : 'Unregistered';

      // ── Header ──
      doc.rect(M, 50, W, 64).fill(BRAND);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('StayXPulse', M + 16, 63);
      doc.font('Helvetica').fontSize(8.5).text('by Sunver Coresynergy Solutions Pvt Ltd', M + 16, 85);
      doc.fontSize(8.5).text('GSTIN: ' + SELLER.gstin, M + 16, 97);
      doc.font('Helvetica-Bold').fontSize(13).text('ORDER RECORD', R - 176, 63, { width: 160, align: 'right' });
      doc.font('Helvetica').fontSize(8).text('Complete transaction record', R - 176, 84, { width: 160, align: 'right' });
      doc.fontSize(8).text('Generated ' + fmt(new Date()), R - 176, 96, { width: 160, align: 'right' });

      let y = 130;

      // ── Summary box ──
      doc.roundedRect(M, y, W, 66, 6).fill(LIGHT);
      doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(12).text('Payment ' + (payment.payment_id || payment.id), M + 14, y + 12, { width: W - 28 });
      const sum = [['STATUS', 'PAID'], ['TOTAL CHARGED', rup(payment.amount)], ['CREATED', fmt(payment.created_at)], ['PAID AT', fmt(payment.paid_at)]];
      const sw = (W - 28) / 4; let sx = M + 14;
      sum.forEach(([l, v]) => {
        doc.fillColor(GRAY).font('Helvetica').fontSize(7).text(l, sx, y + 38, { width: sw - 6 });
        doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(8.5).text(v, sx, y + 48, { width: sw - 6 });
        sx += sw;
      });
      y += 66 + 18;

      const section = (num, title) => {
        if (y > 730) { doc.addPage(); y = 60; }
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(num + '  ' + title, M, y);
        y += 16;
        doc.moveTo(M, y).lineTo(R, y).strokeColor(BORDER).lineWidth(1).stroke();
        y += 12;
      };
      const kv = (pairs) => {
        const colW = W / 2;
        for (let i = 0; i < pairs.length; i += 2) {
          if (y > 745) { doc.addPage(); y = 60; }
          const cell = (p, x) => {
            if (!p || !p[0]) return;
            doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(p[0], x, y, { width: colW - 16 });
            doc.fillColor(BLACK).font('Helvetica').fontSize(9).text(String(p[1] == null ? '—' : p[1]), x, y + 11, { width: colW - 16 });
          };
          cell(pairs[i], M);
          cell(pairs[i + 1], M + colW);
          y += 34;
        }
      };

      section('1', 'CUSTOMER IDENTITY & ACCOUNT');
      kv([
        ['Hotel', hotel.hotel_name], ['User ID', hotel.user_id || '—'],
        ['Email', hotel.email], ['Phone', hotel.phone || '—'],
        ['Buyer GSTIN', hotel.gst_number || '—'], ['Account created', fmt(hotel.created_at)],
        ['Billing address', hotel.address || '—'], ['', ''],
      ]);
      y += 2;

      section('2', 'CHECKOUT & TAX  (prices GST-inclusive @ ' + RATE + '%)');
      kv([
        ['Plan', (plan.name || '—') + ' — ' + cycle], ['Duration', days + ' days'],
        ['Place of supply', pos], ['SAC', SELLER.sac + '  (confirm w/ CA)'],
        ['Taxable value', rup(taxable / 100)], ['GST total', rup(tax / 100)],
        ['CGST', rup(cgst / 100)], ['SGST', rup(sgst / 100)],
        ['IGST', rup(igst / 100)], ['Total (incl. GST)', rup(gross / 100)],
        ['Customer IP', 'Not recorded'], ['Browser / user-agent', 'Not recorded'],
        ['Consent / terms', 'Not recorded'], ['', ''],
      ]);
      y += 2;

      section('3', 'PAYMENT TRAIL');
      kv([
        ['Gateway', isTest ? 'TEST (simulated — no charge)' : 'Razorpay'], ['Payment reference', payment.payment_id || '—'],
        ['Amount captured', rup(payment.amount)], ['Captured at', fmt(payment.paid_at)],
      ]);
      y += 2;

      section('4', 'TAX INVOICE ISSUED');
      kv([
        ['Invoice number', payment.invoice_number || '—'], ['Issued at', fmt(payment.paid_at)],
        ['Place of supply', bState || '—'], ['Notes', payment.notes || '—'],
      ]);
      y += 2;

      section('5', 'SUBSCRIPTION');
      kv([
        ['Current plan', plan.name || '—'], ['Hotel status', hotel.subscription_status || '—'],
        ['Valid from', fmt(payment.valid_from)], ['Valid to', fmt(payment.valid_to)],
      ]);
      y += 2;

      section('6', 'AUDIT TIMELINE (recorded milestones)');
      const events = [
        ['Account created', hotel.created_at],
        ['Payment recorded' + (isTest ? ' (test)' : ''), payment.created_at],
        ['Payment captured / marked paid', payment.paid_at],
        ['Subscription activated', payment.valid_from],
        ['Tax invoice issued (' + (payment.invoice_number || '—') + ')', payment.paid_at],
        ['Order record generated', new Date()],
      ];
      events.forEach((e, i) => {
        if (y > 755) { doc.addPage(); y = 60; }
        doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text((i + 1) + '. ' + e[0], M, y);
        doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(fmt(e[1]), M, y + 11);
        y += 25;
      });
      y += 8;

      // ── Declaration + signatory ──
      if (y > 660) { doc.addPage(); y = 60; }
      doc.roundedRect(M, y, W, 74, 6).fill(LIGHT);
      doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('DECLARATION', M + 14, y + 12);
      doc.fillColor(BLACK).font('Helvetica').fontSize(8).text(
        'This is a true and accurate extract from the records held by Sunver Coresynergy Solutions Pvt Ltd (StayXPulse) as of the generation timestamp shown above. Fields marked "Not recorded" are not currently captured by the platform. This document is generated automatically and is system-signed.',
        M + 14, y + 26, { width: W - 28 });
      y += 74 + 34;
      doc.moveTo(R - 200, y).lineTo(R, y).strokeColor(BORDER).lineWidth(1).stroke();
      doc.fillColor(GRAY).font('Helvetica').fontSize(8).text('For Sunver Coresynergy Solutions Pvt Ltd — Authorised Signatory', R - 280, y + 6, { width: 280, align: 'right' });

      // ── Footer on every page ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fillColor(GRAY).font('Helvetica').fontSize(7).text(
          'StayXPulse · Order Record · ' + (payment.invoice_number || payment.id) + ' · Page ' + (i + 1) + ' of ' + range.count,
          M, 802, { width: W, align: 'center' });
      }

      doc.end();
    } catch (err) { reject(err); }
  });
};

module.exports = { generateInvoicePDF, generateOrderRecordPDF };
