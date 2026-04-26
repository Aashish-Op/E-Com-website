const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Review = require('../models/Review');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const { productDTO } = require('../services/serializer');

const router = express.Router();

function productQuery(req) {
  const query = { status: 'active' };
  if (req.query.category && req.query.category !== 'all') query.category = req.query.category;
  if (req.query.sale === 'true') query.isOnSale = true;
  if (req.query.featured === 'true') query.isFeatured = true;
  if (req.query.q) {
    const q = String(req.query.q).trim();
    query.$or = [
      { name: new RegExp(q, 'i') },
      { description: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') }
    ];
  }
  return query;
}

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(60, Math.max(1, Number(req.query.limit || 24)));
  const skip = (page - 1) * limit;
  const query = productQuery(req);
  const sort = req.query.sort === 'price-asc'
    ? { pricePaise: 1 }
    : req.query.sort === 'price-desc'
      ? { pricePaise: -1 }
      : { isFeatured: -1, createdAt: -1 };

  const [items, total] = await Promise.all([
    Product.find(query).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(query)
  ]);
  res.json({
    success: true,
    products: items.map(productDTO),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ success: true, products: [] });
  const products = await Product.find({
    status: 'active',
    $or: [
      { name: new RegExp(q, 'i') },
      { description: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') }
    ]
  }).limit(15);
  res.json({ success: true, products: products.map(productDTO) });
}));

router.get('/:slug', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: 'active' });
  if (!product) throw httpError(404, 'Product not found');
  const reviews = await Review.find({ product: product._id, status: 'published' })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('user', 'name');
  res.json({
    success: true,
    product: productDTO(product),
    reviews: reviews.map(review => ({
      id: review._id.toString(),
      rating: review.rating,
      title: review.title,
      body: review.body,
      userName: review.user?.name || 'Customer',
      createdAt: review.createdAt
    }))
  });
}));

router.post('/:slug/reviews', requireAuth, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('title').optional().trim().isLength({ max: 120 }),
  body('body').optional().trim().isLength({ max: 1200 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
  const product = await Product.findOne({ slug: req.params.slug, status: 'active' });
  if (!product) throw httpError(404, 'Product not found');

  const review = await Review.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    {
      rating: req.body.rating,
      title: req.body.title,
      body: req.body.body,
      status: 'published'
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  const stats = await Review.aggregate([
    { $match: { product: product._id, status: 'published' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  product.rating = stats[0]?.avg || 0;
  product.reviewCount = stats[0]?.count || 0;
  await product.save();

  res.status(201).json({ success: true, review });
}));

module.exports = router;
