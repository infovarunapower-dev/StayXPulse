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

module.exports = { generateInvoicePDF };
