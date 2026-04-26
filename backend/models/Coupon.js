const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'percent'
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minSubtotalPaise: {
    type: Number,
    default: 0,
    min: 0
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: Date,
  usageLimit: Number,
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
