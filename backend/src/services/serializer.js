const { formatINR } = require('../utils/money');

function imageUrl(product) {
  return product.images?.[0]?.url || '';
}

function productDTO(product) {
  const json = typeof product.toJSON === 'function' ? product.toJSON() : product;
  return {
    id: json._id?.toString?.() || json.id,
    slug: json.slug,
    name: json.name,
    category: json.category,
    description: json.description,
    pricePaise: json.pricePaise,
    price: formatINR(json.pricePaise),
    compareAtPricePaise: json.compareAtPricePaise,
    compareAtPrice: json.compareAtPricePaise ? formatINR(json.compareAtPricePaise) : null,
    currency: json.currency || 'INR',
    stock: json.stock,
    reservedStock: json.reservedStock || 0,
    availableStock: Math.max(0, (json.stock || 0) - (json.reservedStock || 0)),
    dimensions: json.dimensions || {},
    materials: json.materials || {},
    images: json.images || [],
    image: imageUrl(json),
    tags: json.tags || [],
    isFeatured: Boolean(json.isFeatured),
    isOnSale: Boolean(json.isOnSale),
    status: json.status,
    rating: json.rating || 0,
    reviewCount: json.reviewCount || 0
  };
}

function cartDTO(cart, totals) {
  return {
    id: cart?._id?.toString(),
    items: (cart?.items || []).map(item => ({
      id: item._id?.toString(),
      productId: item.product?.toString?.() || item.product,
      slug: item.slug,
      name: item.name,
      image: item.image,
      pricePaise: item.pricePaise,
      price: formatINR(item.pricePaise),
      quantity: item.quantity,
      lineTotalPaise: item.pricePaise * item.quantity,
      lineTotal: formatINR(item.pricePaise * item.quantity)
    })),
    coupon: cart?.appliedCoupon?.code ? cart.appliedCoupon : null,
    totals
  };
}

function orderDTO(order) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    items: order.items.map(item => ({
      productId: item.product?.toString?.() || item.product,
      slug: item.slug,
      name: item.name,
      image: item.image,
      pricePaise: item.pricePaise,
      price: formatINR(item.pricePaise),
      quantity: item.quantity
    })),
    contact: order.guestContact,
    shippingAddress: order.shippingAddress,
    subtotalPaise: order.subtotalPaise,
    subtotal: formatINR(order.subtotalPaise),
    discountPaise: order.discountPaise,
    discount: formatINR(order.discountPaise),
    deliveryPaise: order.deliveryPaise,
    delivery: formatINR(order.deliveryPaise),
    totalPaise: order.totalPaise,
    total: formatINR(order.totalPaise),
    couponCode: order.couponCode,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    timeline: order.timeline,
    createdAt: order.createdAt
  };
}

module.exports = { productDTO, cartDTO, orderDTO };
