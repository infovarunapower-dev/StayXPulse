// ── GST calculation — single source of truth ─────────────────────────────────
// Plan prices are TAX-INCLUSIVE: the amount the hotel pays already contains 18%
// GST. Every document (customer invoice, super-admin Order Record, GST register
// CSV) must show the SAME breakup, so they all call this.
//
// Seller is in state 09 (Uttar Pradesh). Intra-state (buyer also 09) splits into
// CGST + SGST; inter-state is IGST. All maths is done in paise to avoid float
// drift, and CGST is kept exactly equal to SGST.

const SELLER = {
  name:  'Sunver Coresynergy Solutions Pvt Ltd',
  gstin: '09ABNCS5321F1Z7',
  state: '09',                 // Uttar Pradesh
  stateName: 'Uttar Pradesh',
  sac:   '998314',             // IT / software support services
  address: 'Sunver Coresynergy Solutions Pvt Ltd, Uttar Pradesh, India',
};

const RATE = 18;

// gross = tax-inclusive amount in rupees (integer or float). buyerGstin decides
// the CGST/SGST vs IGST split.
const computeGst = (gross, buyerGstin) => {
  const grossP = Math.round(Number(gross || 0) * 100);   // paise
  const buyerState = String(buyerGstin || '').trim().slice(0, 2);
  const intra = !!buyerState && buyerState === SELLER.state;

  let cgstP = 0, sgstP = 0, igstP = 0, taxableP;
  if (intra) {
    // 9% + 9% of the inclusive total, kept identical.
    const halfP = Math.round(grossP * 9 / (100 + RATE));
    cgstP = halfP;
    sgstP = halfP;
    taxableP = grossP - cgstP - sgstP;
  } else {
    igstP = Math.round(grossP * RATE / (100 + RATE));
    taxableP = grossP - igstP;
  }

  const r = p => p / 100;
  return {
    rate: RATE,
    intra,
    buyerState: buyerState || null,
    placeOfSupply: buyerState ? `${buyerState}` : SELLER.state,
    gross:   r(grossP),
    taxable: r(taxableP),
    cgst:    r(cgstP),
    sgst:    r(sgstP),
    igst:    r(igstP),
    totalTax: r(cgstP + sgstP + igstP),
  };
};

// Rupees without the ₹ glyph. PDFKit's built-in Helvetica has no U+20B9, so it
// renders as space+¹; "Rs." is used on the documents instead.
const rs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = { SELLER, RATE, computeGst, rs };
