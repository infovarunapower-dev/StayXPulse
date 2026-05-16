const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hotel:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  number:     { type: String, required: true, trim: true },
  floor:      { type: String, trim: true, default: '' },
  type:       { type: String, enum: ['Standard','Deluxe','Suite','Executive Suite','Villa'], default: 'Standard' },
  isActive:   { type: Boolean, default: true },
  qrToken:    { type: String, unique: true }, // unique token embedded in QR URL
}, { timestamps: true });

roomSchema.index({ hotel: 1, number: 1 }, { unique: true });

// Auto-generate qrToken before save
const { v4: uuidv4 } = require('uuid');
roomSchema.pre('save', function (next) {
  if (!this.qrToken) this.qrToken = uuidv4();
  next();
});

module.exports = mongoose.model('Room', roomSchema);
