const crypto = require('crypto');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { httpError } = require('../utils/httpError');
const { calculateTotals } = require('./pricingService');
const { getOrCreateCart, clearCart } = require('./cartService');
const { orderDTO } = require('./serializer');
const emailService = require('./emailService');

function normalizeContact(contact = {}, fallbackAddress = {}) {
  return {
    name: contact.name || fallbackAddress.fullName || 'Guest Customer',
    email: String(contact.email || '').toLowerCase().trim(),
    phone: contact.phone || fallbackAddress.phone || ''
  };
}

function normalizeAddress(address = {}, contact = {}) {
  return {
    fullName: address.fullName || contact.name || 'Guest Customer',
    phone: address.phone || contact.phone || '',
    street: address.street || '',
    city: address.city || '',
    state: address.state || '',
    pincode: address.pincode || ''
  };
}

function validateCheckoutInput(contact, address) {
  if (!contact.email || !/.+@.+\..+/.test(contact.email)) {
    throw httpError(400, 'A valid email is required for order updates');
  }
  if (!contact.phone || contact.phone.replace(/\D/g, '').length < 10) {
    throw httpError(400, 'A valid phone number is required for delivery');
  }
  if (!address.street || !address.city || !address.pincode) {
    throw httpError(400, 'Street, city, and pincode are required');
  }
}

async function buildOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomInt(10000, 99999);
  return `SF-${year}-${suffix}`;
}

async function moveStock(items, mode) {
  const changed = [];
  try {
    for (const item of items) {
      const inc = mode === 'reserve'
        ? { stock: -item.quantity, reservedStock: item.quantity }
        : { stock: -item.quantity };
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity }, status: 'active' },
        { $inc: inc }
      );
      if (result.modifiedCount !== 1) {
        throw httpError(409, `${item.name} is no longer available in the requested quantity`);
      }
      changed.push(item);
    }
  } catch (err) {
    for (const item of changed) {
      const rollback = mode === 'reserve'
        ? { stock: item.quantity, reservedStock: -item.quantity }
        : { stock: item.quantity };
      await Product.updateOne({ _id: item.product }, { $inc: rollback });
    }
    throw err;
  }
}

async function releaseReservedStock(order) {
  if (order.stockMode !== 'reserved') return;
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity, reservedStock: -item.quantity } }
    );
  }
  order.stockMode = 'released';
  order.timeline.push({ status: 'payment_failed', note: 'Reserved inventory released' });
  await order.save();
}

async function releasePendingReservations(context) {
  const ownership = [];
  if (context.user?._id) ownership.push({ user: context.user._id });
  if (context.cartToken) ownership.push({ cartToken: context.cartToken });
  if (!ownership.length) return;

  const orders = await Order.find({
    stockMode: 'reserved',
    paymentStatus: 'pending',
    $or: ownership
  });
  for (const order of orders) {
    await releaseReservedStock(order);
  }
}

async function captureReservedStock(order) {
  if (order.stockMode !== 'reserved') return;
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { reservedStock: -item.quantity } }
    );
  }
  order.stockMode = 'decremented';
}

async function createOrderFromCart(context, payload) {
  const cart = await getOrCreateCart(context);
  if (!cart.items.length) throw httpError(400, 'Your bag is empty');

  const contact = normalizeContact(payload.contact, payload.shippingAddress);
  const shippingAddress = normalizeAddress(payload.shippingAddress, contact);
  validateCheckoutInput(contact, shippingAddress);

  const totals = await calculateTotals(cart);
  const paymentMethod = payload.paymentMethod || 'cod';
  const reserve = paymentMethod === 'razorpay';
  await releasePendingReservations(context);
  await moveStock(cart.items, reserve ? 'reserve' : 'decrement');

  const order = await Order.create({
    orderNumber: await buildOrderNumber(),
    user: context.user?._id,
    cartToken: context.cartToken,
    guestContact: contact,
    shippingAddress,
    items: cart.items.map(item => item.toObject()),
    subtotalPaise: totals.subtotalPaise,
    discountPaise: totals.discountPaise,
    deliveryPaise: totals.deliveryPaise,
    totalPaise: totals.totalPaise,
    couponCode: totals.coupon?.code,
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
    fulfillmentStatus: 'placed',
    razorpayOrderId: payload.razorpayOrderId,
    stockMode: reserve ? 'reserved' : 'decremented',
    stockExpiresAt: reserve ? new Date(Date.now() + 1000 * 60 * 20) : undefined,
    timeline: [{ status: 'placed', note: paymentMethod === 'cod' ? 'COD order placed' : 'Razorpay payment initiated' }]
  });

  if (paymentMethod === 'cod') {
    await clearCart(context);
    await emailService.sendOrderConfirmation(order).catch(() => {});
  }
  return order;
}

async function markOrderPaid(order, payment) {
  if (order.paymentStatus === 'paid') return order;
  await captureReservedStock(order);
  order.paymentStatus = 'paid';
  order.razorpayPaymentId = payment.paymentId;
  order.razorpaySignature = payment.signature;
  order.timeline.push({ status: 'paid', note: 'Payment confirmed by Razorpay' });
  await order.save();
  await clearCart({
    user: order.user ? { _id: order.user } : null,
    cartToken: order.cartToken
  });
  await emailService.sendOrderConfirmation(order).catch(() => {});
  return order;
}

async function updateFulfillmentStatus(order, status, note) {
  const allowed = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) throw httpError(400, 'Invalid order status');
  order.fulfillmentStatus = status;
  order.timeline.push({ status, note: note || `Order marked ${status}` });
  await order.save();
  await emailService.sendOrderStatus(order).catch(() => {});
  return order;
}

module.exports = {
  createOrderFromCart,
  markOrderPaid,
  releaseReservedStock,
  updateFulfillmentStatus,
  orderDTO
};
