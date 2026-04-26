const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { createOrderFromCart, markOrderPaid, orderDTO } = require('../services/orderService');
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  hasRazorpayCredentials
} = require('../services/paymentService');

const router = express.Router();

function context(req) {
  return { user: req.user, cartToken: req.cartToken };
}

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
}

router.post('/create-order', [
  body('contact.email').isEmail(),
  body('contact.phone').notEmpty(),
  body('shippingAddress.street').notEmpty(),
  body('shippingAddress.city').notEmpty(),
  body('shippingAddress.pincode').notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const order = await createOrderFromCart(context(req), { ...req.body, paymentMethod: 'razorpay' });
  const razorpayOrder = await createRazorpayOrder(order);
  order.razorpayOrderId = razorpayOrder.id;
  await order.save();

  res.status(201).json({
    success: true,
    order: orderDTO(order),
    razorpay: {
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_missing',
      orderId: razorpayOrder.id,
      amount: order.totalPaise,
      currency: 'INR',
      testMode: Boolean(razorpayOrder.testMode || !hasRazorpayCredentials())
    }
  });
}));

router.post('/verify', [
  body('orderNumber').notEmpty(),
  body('razorpayOrderId').notEmpty(),
  body('razorpayPaymentId').notEmpty(),
  body('razorpaySignature').notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const order = await Order.findOne({ orderNumber: req.body.orderNumber });
  if (!order) throw httpError(404, 'Order not found');
  if (order.razorpayOrderId !== req.body.razorpayOrderId) throw httpError(400, 'Payment order mismatch');

  const valid = verifyPaymentSignature({
    razorpayOrderId: req.body.razorpayOrderId,
    razorpayPaymentId: req.body.razorpayPaymentId,
    razorpaySignature: req.body.razorpaySignature
  });
  if (!valid) throw httpError(400, 'Invalid payment signature');

  const paid = await markOrderPaid(order, {
    paymentId: req.body.razorpayPaymentId,
    signature: req.body.razorpaySignature
  });
  res.json({ success: true, order: orderDTO(paid) });
}));

async function webhookHandler(req, res, next) {
  try {
    const signature = req.get('x-razorpay-signature');
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw httpError(400, 'Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
      const payment = event.payload?.payment?.entity;
      const order = await Order.findOne({ razorpayOrderId: payment?.order_id });
      if (order) {
        await markOrderPaid(order, {
          paymentId: payment.id,
          signature
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

module.exports = router;
module.exports.webhookHandler = webhookHandler;
