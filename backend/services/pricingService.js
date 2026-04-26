const Coupon = require('../models/Coupon');
const { formatINR } = require('../utils/money');

const FREE_DELIVERY_THRESHOLD_PAISE = Number(process.env.FREE_DELIVERY_THRESHOLD_PAISE || 1500000);
const DELIVERY_FEE_PAISE = Number(process.env.DELIVERY_FEE_PAISE || 0);

function subtotalPaise(items) {
  return (items || []).reduce((sum, item) => sum + (item.pricePaise * item.quantity), 0);
}

async function calculateTotals(cart) {
  const subtotal = subtotalPaise(cart.items);
  let discount = 0;
  let coupon = null;

  if (cart.appliedCoupon?.code) {
    coupon = await Coupon.findOne({
      code: cart.appliedCoupon.code,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    });
    if (coupon && subtotal >= coupon.minSubtotalPaise) {
      discount = coupon.type === 'percent'
        ? Math.round(subtotal * (coupon.value / 100))
        : coupon.value;
      discount = Math.min(discount, subtotal);
    } else {
      coupon = null;
    }
  }

  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const total = Math.max(0, subtotal - discount + delivery);

  return {
    subtotalPaise: subtotal,
    subtotal: formatINR(subtotal),
    discountPaise: discount,
    discount: formatINR(discount),
    deliveryPaise: delivery,
    delivery: delivery === 0 ? 'FREE' : formatINR(delivery),
    totalPaise: total,
    total: formatINR(total),
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null
  };
}

module.exports = { calculateTotals, subtotalPaise };
