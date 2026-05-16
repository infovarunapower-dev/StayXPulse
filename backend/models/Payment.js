const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    hotel:         { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    plan:          { type: mongoose.Schema.Types.ObjectId, ref: 'Plan',  required: true },
    amount:        { type: Number, required: true },
    paymentId:     { type: String, required: true, trim: true },
    invoiceNumber: { type: String, unique: true },
    validFrom:     { type: Date, required: true },
    validTo:       { type: Date, required: true },
    paidAt:        { type: Date, default: Date.now },
    notes:         { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate invoice number before save
paymentSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('Payment').countDocuments();
  const year  = new Date().getFullYear();
  this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
