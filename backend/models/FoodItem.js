const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  hotel:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, required: true, trim: true },
  isVeg:       { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  imageEmoji:  { type: String, default: '🍽' },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true });

foodItemSchema.index({ hotel: 1, category: 1 });

module.exports = mongoose.model('FoodItem', foodItemSchema);
