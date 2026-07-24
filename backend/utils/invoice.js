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
      drawLogo(doc, M + 16, 68, 40);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('StayXPulse', M + 66, 63);
      doc.font('Helvetica').fontSize(8.5).text('by Sunver Coresynergy Solutions Pvt Ltd', M + 66, 85);
      doc.fontSize(8.5).text('GSTIN: ' + SELLER.gstin, M + 66, 97);
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
