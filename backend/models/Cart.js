const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  image: { type: String },
  pricePaise: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, default: 1 }
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  cartToken: { type: String, index: true },
  items: [cartItemSchema],
  appliedCoupon: {
    code: { type: String, uppercase: true, trim: true },
    discountPaise: { type: Number, default: 0 }
  }
}, { timestamps: true });

cartSchema.index({ user: 1, cartToken: 1 });

module.exports = mongoose.model('Cart', cartSchema);
