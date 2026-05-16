const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    price:       { type: Number, required: true },
    durationDays:{ type: Number, required: true, default: 30 },
    maxRooms:    { type: Number, required: true },
    features:    [{ type: String }],
    isPopular:   { type: Boolean, default: false },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Plan = mongoose.model('Plan', planSchema);
module.exports = Plan;
