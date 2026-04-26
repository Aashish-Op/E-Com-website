const express = require('express');
const { body, validationResult } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const {
  getOrCreateCart,
  normalizeCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  applyCoupon,
  removeCoupon
} = require('../services/cartService');

const router = express.Router();

function context(req) {
  return { user: req.user, cartToken: req.cartToken };
}

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
}

router.get('/', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(context(req));
  res.json({ success: true, cart: await normalizeCart(cart) });
}));

router.post('/add', [
  body('productId').optional().isMongoId(),
  body('slug').optional().trim(),
  body('name').optional().trim(),
  body('quantity').optional().isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  assertValid(req);
  const cart = await addItemToCart(context(req), req.body);
  res.status(201).json({ success: true, cart });
}));

router.put(['/items/:itemId', '/update/:itemId'], [
  body('quantity').isInt({ min: 1 })
], asyncHandler(async (req, res) => {
  assertValid(req);
  const cart = await updateCartItem(context(req), req.params.itemId, req.body.quantity);
  res.json({ success: true, cart });
}));

router.delete(['/items/:itemId', '/remove/:itemId'], asyncHandler(async (req, res) => {
  const cart = await removeCartItem(context(req), req.params.itemId);
  res.json({ success: true, cart });
}));

router.post('/coupon', [
  body('code').trim().notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const cart = await applyCoupon(context(req), req.body.code);
  res.json({ success: true, cart });
}));

router.delete('/coupon', asyncHandler(async (req, res) => {
  const cart = await removeCoupon(context(req));
  res.json({ success: true, cart });
}));

module.exports = router;
