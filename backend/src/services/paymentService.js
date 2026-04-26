const crypto = require('crypto');
const getRazorpayClient = require('../../config/razorpay');

function hasRazorpayCredentials() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function createRazorpayOrder(order) {
  const client = getRazorpayClient();
  if (!client) {
    return {
      id: `order_test_${order.orderNumber}`,
      amount: order.totalPaise,
      currency: 'INR',
      testMode: true
    };
  }
  return client.orders.create({
    amount: order.totalPaise,
    currency: 'INR',
    receipt: order.orderNumber,
    notes: {
      orderNumber: order.orderNumber
    }
  });
}

function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!hasRazorpayCredentials()) return true;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  const received = Buffer.from(razorpaySignature || '');
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!hasRazorpayCredentials()) return true;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
    .update(rawBody)
    .digest('hex');
  const received = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
}

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  hasRazorpayCredentials
};
