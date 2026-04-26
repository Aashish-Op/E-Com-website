const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const slugify = require('../utils/slugify');
const { httpError } = require('../utils/httpError');
const { calculateTotals } = require('./pricingService');
const { cartDTO } = require('./serializer');

async function getOrCreateCart({ user, cartToken }) {
  const query = user ? { user: user._id } : { cartToken };
  let cart = await Cart.findOne(query);
  if (!cart) {
    cart = await Cart.create(user ? { user: user._id, cartToken, items: [] } : { cartToken, items: [] });
  }
  return cart;
}

async function mergeGuestCartIntoUser(cartToken, userId) {
  if (!cartToken || !userId) return;
  const [guestCart, userCart] = await Promise.all([
    Cart.findOne({ cartToken }),
    Cart.findOne({ user: userId })
  ]);
  if (!guestCart || guestCart.items.length === 0) return;

  const target = userCart || await Cart.create({ user: userId, cartToken, items: [] });
  guestCart.items.forEach(item => {
    const existing = target.items.find(existingItem => existingItem.slug === item.slug);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      target.items.push(item.toObject());
    }
  });
  if (guestCart.appliedCoupon?.code) target.appliedCoupon = guestCart.appliedCoupon;
  await target.save();
  await Cart.deleteOne({ _id: guestCart._id });
}

async function findProductForCart(payload) {
  const slug = payload.slug || slugify(payload.name);
  const query = payload.productId
    ? { _id: payload.productId, status: 'active' }
    : {
        status: 'active',
        $or: [
          { slug },
          { name: new RegExp('^' + escapeRegex(payload.name || '') + '$', 'i') }
        ]
      };
  return Product.findOne(query);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function addItemToCart(context, payload) {
  const quantity = Math.max(1, Number(payload.quantity || 1));
  const product = await findProductForCart(payload);
  if (!product) throw httpError(404, 'Product not found. Please seed the catalog first.');
  if (product.stock - product.reservedStock < quantity) throw httpError(409, 'This item is out of stock');

  const cart = await getOrCreateCart(context);
  const existing = cart.items.find(item => item.slug === product.slug);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      product: product._id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0]?.url || '',
      pricePaise: product.pricePaise,
      quantity
    });
  }
  await cart.save();
  return normalizeCart(cart);
}

async function updateCartItem(context, itemId, quantity) {
  const cart = await getOrCreateCart(context);
  const item = cart.items.id(itemId);
  if (!item) throw httpError(404, 'Cart item not found');
  item.quantity = Math.max(1, Number(quantity || 1));
  await cart.save();
  return normalizeCart(cart);
}

async function removeCartItem(context, itemId) {
  const cart = await getOrCreateCart(context);
  const item = cart.items.id(itemId);
  if (!item) throw httpError(404, 'Cart item not found');
  item.deleteOne();
  await cart.save();
  return normalizeCart(cart);
}

async function applyCoupon(context, code) {
  const cart = await getOrCreateCart(context);
  const coupon = await Coupon.findOne({
    code: String(code || '').toUpperCase(),
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  });
  if (!coupon) throw httpError(404, 'Invalid promo code');
  cart.appliedCoupon = { code: coupon.code, discountPaise: 0 };
  await cart.save();
  return normalizeCart(cart);
}

async function removeCoupon(context) {
  const cart = await getOrCreateCart(context);
  cart.appliedCoupon = undefined;
  await cart.save();
  return normalizeCart(cart);
}

async function clearCart(context) {
  const cart = await getOrCreateCart(context);
  cart.items = [];
  cart.appliedCoupon = undefined;
  await cart.save();
}

async function normalizeCart(cart) {
  const totals = await calculateTotals(cart);
  return cartDTO(cart, totals);
}

module.exports = {
  getOrCreateCart,
  mergeGuestCartIntoUser,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  applyCoupon,
  removeCoupon,
  clearCart,
  normalizeCart
};
