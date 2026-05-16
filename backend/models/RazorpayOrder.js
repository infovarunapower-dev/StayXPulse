const mongoose = require('mongoose');

const razorpayOrderSchema = new mongoose.Schema({
  hotel:         { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  plan:          { type: mongoose.Schema.Types.ObjectId, ref: 'Plan',  required: true },
  cycle:         { type: String, enum: ['monthly','quarterly','yearly'], required: true },
  amount:        { type: Number, required: true },          // in paise
  amountDisplay: { type: Number, required: true },          // in INR
  currency:      { type: String, default: 'INR' },
  razorpayOrderId: { type: String, unique: true },          // order_XXXX from Razorpay
  razorpayPaymentId: { type: String, default: null },       // pay_XXXX after success
  razorpaySignature:  { type: String, default: null },
  status:        { type: String, enum: ['created','paid','failed'], default: 'created' },
  validFrom:     { type: Date, default: null },
  validTo:       { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('RazorpayOrder', razorpayOrderSchema);
