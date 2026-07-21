// GSTIN format: 2-digit state code, 5 letters (PAN), 4 digits, 1 letter,
// 1 alphanumeric entity code, literal 'Z', 1 alphanumeric checksum.
// The first two digits decide the CGST/SGST vs IGST split on every tax invoice
// (see utils/invoice.js), so a malformed value silently mis-taxes the customer.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const isValidGstin = (v) => GSTIN_RE.test(String(v || '').trim().toUpperCase());

module.exports = { GSTIN_RE, isValidGstin };
