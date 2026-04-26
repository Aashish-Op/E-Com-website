const express = require('express');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');
const { formatINR } = require('../utils/money');

const router = express.Router();

router.use(requireAuth);

async function getWishlist(userId) {
  return Wishlist.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { returnDocument: 'after', upsert: true }
  );
}

router.get('/', asyncHandler(async (req, res) => {
  const wishlist = await getWishlist(req.user._id);
  res.json({ success: true, wishlist: serialize(wishlist) });
}));

router.post('/items', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.body.slug, status: 'active' });
  if (!product) throw httpError(404, 'Product not found');
  const wishlist = await getWishlist(req.user._id);
  if (!wishlist.items.some(item => item.slug === product.slug)) {
    wishlist.items.push({
      product: product._id,
      slug: product.slug,
      name: product.name,
      image: product.images?.[0]?.url || '',
      pricePaise: product.pricePaise
    });
    await wishlist.save();
  }
  res.status(201).json({ success: true, wishlist: serialize(wishlist) });
}));

router.delete('/items/:slug', asyncHandler(async (req, res) => {
  const wishlist = await getWishlist(req.user._id);
  wishlist.items = wishlist.items.filter(item => item.slug !== req.params.slug);
  await wishlist.save();
  res.json({ success: true, wishlist: serialize(wishlist) });
}));

function serialize(wishlist) {
  return {
    items: wishlist.items.map(item => ({
      slug: item.slug,
      name: item.name,
      image: item.image,
      pricePaise: item.pricePaise,
      price: formatINR(item.pricePaise)
    }))
  };
}

module.exports = router;
