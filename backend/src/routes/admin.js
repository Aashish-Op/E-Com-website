const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const asyncHandler = require('../utils/asyncHandler');
const slugify = require('../utils/slugify');
const { httpError } = require('../utils/httpError');
const { requireAdmin } = require('../middleware/auth');
const { productDTO, orderDTO } = require('../services/serializer');
const { updateFulfillmentStatus } = require('../services/orderService');
const { uploadProductImage } = require('../services/uploadService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

router.use(requireAdmin);

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
}

router.get('/metrics', asyncHandler(async (_req, res) => {
  const [orders, products, lowStock, revenue] = await Promise.all([
    Order.countDocuments(),
    Product.countDocuments({ status: { $ne: 'archived' } }),
    Product.countDocuments({ stock: { $lte: 3 }, status: 'active' }),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ['paid', 'pending'] } } },
      { $group: { _id: null, total: { $sum: '$totalPaise' } } }
    ])
  ]);
  res.json({
    success: true,
    metrics: {
      orders,
      products,
      lowStock,
      revenuePaise: revenue[0]?.total || 0
    }
  });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.category) query.category = req.query.category;
  const products = await Product.find(query).sort({ updatedAt: -1 }).limit(200);
  res.json({ success: true, products: products.map(productDTO) });
}));

router.post('/products', [
  body('name').trim().notEmpty(),
  body('category').trim().notEmpty(),
  body('pricePaise').isInt({ min: 0 }),
  body('stock').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  assertValid(req);
  const product = await Product.create({
    slug: req.body.slug || slugify(req.body.name),
    name: req.body.name,
    category: req.body.category,
    description: req.body.description,
    pricePaise: req.body.pricePaise,
    compareAtPricePaise: req.body.compareAtPricePaise || null,
    stock: req.body.stock ?? 10,
    materials: req.body.materials,
    dimensions: req.body.dimensions,
    images: req.body.images || [],
    tags: req.body.tags || [],
    isFeatured: Boolean(req.body.isFeatured),
    isOnSale: Boolean(req.body.isOnSale),
    status: req.body.status || 'active'
  });
  res.status(201).json({ success: true, product: productDTO(product) });
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.name && !updates.slug) updates.slug = slugify(updates.name);
  const product = await Product.findByIdAndUpdate(req.params.id, updates, {
    returnDocument: 'after',
    runValidators: true
  });
  if (!product) throw httpError(404, 'Product not found');
  res.json({ success: true, product: productDTO(product) });
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { status: 'archived' }, { returnDocument: 'after' });
  if (!product) throw httpError(404, 'Product not found');
  res.json({ success: true, product: productDTO(product) });
}));

router.post('/products/:id/images', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'Image file required');
  const product = await Product.findById(req.params.id);
  if (!product) throw httpError(404, 'Product not found');
  const uploaded = await uploadProductImage(req.file);
  product.images.push({ url: uploaded.url, publicId: uploaded.publicId, alt: product.name });
  await product.save();
  res.status(201).json({ success: true, product: productDTO(product) });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.fulfillmentStatus = req.query.status;
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, orders: orders.map(orderDTO) });
}));

router.patch('/orders/:id/status', [
  body('status').isIn(['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'])
], asyncHandler(async (req, res) => {
  assertValid(req);
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found');
  const updated = await updateFulfillmentStatus(order, req.body.status, req.body.note);
  res.json({ success: true, order: orderDTO(updated) });
}));

router.get('/coupons', asyncHandler(async (_req, res) => {
  const coupons = await Coupon.find().sort({ updatedAt: -1 });
  res.json({ success: true, coupons });
}));

router.post('/coupons', [
  body('code').trim().notEmpty(),
  body('type').isIn(['percent', 'fixed']),
  body('value').isFloat({ min: 0 })
], asyncHandler(async (req, res) => {
  assertValid(req);
  const coupon = await Coupon.create({
    code: req.body.code,
    type: req.body.type,
    value: req.body.value,
    minSubtotalPaise: req.body.minSubtotalPaise || 0,
    active: req.body.active ?? true,
    expiresAt: req.body.expiresAt
  });
  res.status(201).json({ success: true, coupon });
}));

router.put('/coupons/:id', asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
  if (!coupon) throw httpError(404, 'Coupon not found');
  res.json({ success: true, coupon });
}));

module.exports = router;
