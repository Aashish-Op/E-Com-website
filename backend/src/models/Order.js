const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  slug: String,
  name: String,
  image: String,
  pricePaise: Number,
  quantity: Number
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  status: String,
  note: String,
  at: { type: Date, default: Date.now }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  cartToken: String,
  guestContact: {
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String
  },
  shippingAddress: {
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  items: [orderItemSchema],
  subtotalPaise: { type: Number, required: true },
  discountPaise: { type: Number, default: 0 },
  deliveryPaise: { type: Number, default: 0 },
  totalPaise: { type: Number, required: true },
  couponCode: String,
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  fulfillmentStatus: {
    type: String,
    enum: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],
    default: 'placed',
    index: true
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  stockMode: {
    type: String,
    enum: ['decremented', 'reserved', 'released', 'none'],
    default: 'none'
  },
  stockExpiresAt: Date,
  timeline: [timelineSchema]
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
