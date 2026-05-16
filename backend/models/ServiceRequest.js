const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const serviceRequestSchema = new mongoose.Schema({
  hotel:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room:       { type: mongoose.Schema.Types.ObjectId, ref: 'Room',  required: true },
  roomNumber: { type: String, required: true },
  type:       { type: String, required: true, trim: true },
  note:       { type: String, default: '' },
  status:     { type: String, enum: ['pending','in-progress','completed','cancelled'], default: 'pending' },
  requestRef: { type: String, unique: true },
  completedAt:{ type: Date, default: null },
}, { timestamps: true });

// Use UUID-based ref to avoid race condition duplicates
serviceRequestSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('ServiceRequest').countDocuments({ hotel: this.hotel });
  const uid   = uuidv4().slice(0,6).toUpperCase();
  this.requestRef = `SR-${String(count + 1).padStart(4, '0')}-${uid}`;
  next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
