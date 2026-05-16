const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  foodItem:  { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem' },
  name:      { type: String, required: true },
  price:     { type: Number, required: true },
  quantity:  { type: Number, required: true, min: 1 },
}, { _id: false });

const foodOrderSchema = new mongoose.Schema({
  hotel:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel',   required: true },
  room:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room',    required: true },
  roomNumber:  { type: String, required: true },
  items:       [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status:      { type: String, enum: ['pending','preparing','delivered','cancelled'], default: 'pending' },
  guestNote:   { type: String, default: '' },
  orderRef:    { type: String, unique: true },
}, { timestamps: true });

// Use UUID suffix to prevent race condition duplicates
foodOrderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const count = await mongoose.model('FoodOrder').countDocuments({ hotel: this.hotel });
  const uid   = uuidv4().slice(0,6).toUpperCase();
  this.orderRef = `FO-${String(count + 1).padStart(4, '0')}-${uid}`;
  next();
});

module.exports = mongoose.model('FoodOrder', foodOrderSchema);
