const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Hotel Schema ─────────────────────────────────────────────────────────────
const hotelSchema = new mongoose.Schema(
  {
    hotelName:   { type: String, required: true, trim: true },
    phone:       { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    address:     { type: String, required: true, trim: true },
    gstNumber:   { type: String, required: true, trim: true, uppercase: true },
    logoUrl:     { type: String, default: null },

    // Auto-generated credentials for hotel admin login
    userId:      { type: String, unique: true },
    passwordRaw: { type: String },          // stored once for welcome email, then cleared
    isActive:    { type: Boolean, default: false },

    // Subscription / trial
    trialStartDate: { type: Date, default: Date.now },
    trialEndDate:   { type: Date },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'suspended'],
      default: 'trial',
    },
    currentPlan:   { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    planValidFrom: { type: Date, default: null },
    planValidTo:   { type: Date, default: null },
  },
  { timestamps: true }
);

// Set trial end = 3 days from registration
hotelSchema.pre('save', function (next) {
  if (this.isNew) {
    const end = new Date(this.trialStartDate);
    end.setDate(end.getDate() + 3);
    this.trialEndDate = end;
  }
  next();
});

const Hotel = mongoose.model('Hotel', hotelSchema);

// ─── User Schema ──────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role:     { type: String, enum: ['superadmin', 'hoteladmin'], default: 'hoteladmin' },
    hotel:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null },
    isActive: { type: Boolean, default: true },

    // Forgot password
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpire:  { type: Date,   default: null },

    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plain password with hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

const Plan           = require('./Plan');
const Payment        = require('./Payment');
const Room           = require('./Room');
const FoodItem       = require('./FoodItem');
const FoodOrder      = require('./FoodOrder');
const ServiceRequest = require('./ServiceRequest');

module.exports = { User, Hotel, Plan, Payment, Room, FoodItem, FoodOrder, ServiceRequest };
