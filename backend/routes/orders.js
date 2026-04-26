const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const { createOrderFromCart, orderDTO } = require('../services/orderService');

const router = express.Router();

function context(req) {
  return { user: req.user, cartToken: req.cartToken };
}

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
}

router.post('/', asyncHandler(async (req, res) => {
  const paymentMethod = req.body.paymentMethod === 'razorpay' ? 'razorpay' : 'cod';
  const order = await createOrderFromCart(context(req), { ...req.body, paymentMethod });
  res.status(201).json({ success: true, order: orderDTO(order) });
}));

router.post('/checkout/cod', [
  body('contact.email').isEmail(),
  body('contact.phone').notEmpty(),
  body('shippingAddress.street').notEmpty(),
  body('shippingAddress.city').notEmpty(),
  body('shippingAddress.pincode').notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const order = await createOrderFromCart(context(req), { ...req.body, paymentMethod: 'cod' });
  res.status(201).json({ success: true, order: orderDTO(order) });
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, orders: orders.map(orderDTO) });
}));

router.get('/track', asyncHandler(async (req, res) => {
  const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
  const contact = String(req.query.contact || '').trim().toLowerCase();
  if (!orderNumber || !contact) throw httpError(400, 'Order number and email or phone are required');
  const order = await Order.findOne({ orderNumber });
  if (!order) throw httpError(404, 'Order not found');
  const emailMatch = order.guestContact?.email?.toLowerCase() === contact;
  const phoneMatch = (order.guestContact?.phone || '').replace(/\D/g, '') === contact.replace(/\D/g, '');
  if (!emailMatch && !phoneMatch) throw httpError(404, 'Order not found for this contact');
  res.json({ success: true, order: orderDTO(order) });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw httpError(404, 'Order not found');
  const ownsOrder = order.user?.toString() === req.user._id.toString();
  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (!ownsOrder && !isAdmin) throw httpError(403, 'Not allowed to view this order');
  res.json({ success: true, order: orderDTO(order) });
}));

module.exports = router;
