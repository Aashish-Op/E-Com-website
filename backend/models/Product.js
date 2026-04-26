const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  alt: { type: String, trim: true },
  publicId: { type: String, trim: true }
}, { _id: false });

const productSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180
  },
  category: {
    type: String,
    enum: ['living-room', 'bedroom', 'dining', 'storage', 'outdoor', 'study', 'decor'],
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: 'A beautiful handcrafted piece designed for modern Indian homes.'
  },
  pricePaise: {
    type: Number,
    required: true,
    min: 0
  },
  compareAtPricePaise: {
    type: Number,
    default: null,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR']
  },
  stock: {
    type: Number,
    required: true,
    default: 10,
    min: 0
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0
  },
  dimensions: {
    summary: { type: String, trim: true },
    width: { type: String, trim: true },
    height: { type: String, trim: true },
    depth: { type: String, trim: true }
  },
  materials: {
    summary: { type: String, trim: true },
    frame: { type: String, trim: true },
    upholstery: { type: String, trim: true },
    finish: { type: String, trim: true }
  },
  images: [productImageSchema],
  tags: [{ type: String, trim: true, lowercase: true }],
  isFeatured: { type: Boolean, default: false, index: true },
  isOnSale: { type: Boolean, default: false, index: true },
  status: {
    type: String,
    enum: ['active', 'draft', 'archived'],
    default: 'active',
    index: true
  },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, default: 0, min: 0 },
  sourcePage: { type: String, trim: true },
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true }
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', tags: 'text' });

productSchema.virtual('availableStock').get(function availableStock() {
  return Math.max(0, this.stock - this.reservedStock);
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
