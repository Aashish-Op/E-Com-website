const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDatabase = require('../config/database');
const Product = require('../src/models/Product');
const Coupon = require('../src/models/Coupon');
const User = require('../src/models/User');
const slugify = require('../src/utils/slugify');
const { toPaise } = require('../src/utils/money');

const rootDir = path.join(__dirname, '..', '..');
const pagesDir = path.join(rootDir, 'src', 'pages');

const PAGE_CATEGORY = {
  'living-room.html': 'living-room',
  'bedroom.html': 'bedroom',
  'dining.html': 'dining',
  'storage.html': 'storage',
  'outdoor.html': 'outdoor',
  'study.html': 'study',
  'newdecor.html': 'decor',
  'sale.html': 'sale'
};

function normalizeImage(value) {
  if (!value) return '';
  const clean = value.replace(/^\.?\//, '');
  if (/^https?:\/\//i.test(clean) || clean.startsWith('data:')) return clean;
  return '/' + clean;
}

function parsePrice($, priceEl) {
  const clone = priceEl.clone();
  clone.find('span').remove();
  return toPaise(clone.text());
}

function parseCompareAt($, priceEl) {
  const struck = priceEl.find('span').first().text();
  return struck ? toPaise(struck) : null;
}

function inferCategory(page, card) {
  const pageCategory = PAGE_CATEGORY[page];
  if (pageCategory && pageCategory !== 'sale') return pageCategory;
  const raw = card.find('.prod-cat').first().text().trim().toLowerCase();
  const normalized = raw.replace(/\s+/g, '-');
  if (normalized === 'living') return 'living-room';
  if (normalized === 'sale') return 'living-room';
  return PAGE_CATEGORY[normalized + '.html'] || normalized || 'living-room';
}

function readProductsFromPage(page) {
  const html = fs.readFileSync(path.join(pagesDir, page), 'utf8');
  const $ = cheerio.load(html);
  const products = [];

  $('.prod-card').each((_index, element) => {
    const card = $(element);
    const name = card.find('.prod-name').first().text().trim();
    const priceEl = card.find('.prod-price').first();
    if (!name || !priceEl.length) return;

    const slug = slugify(name.replace(/\s+\(clearance\)$/i, ''));
    const image = normalizeImage(
      card.find('.prod-img-wrap').first().attr('data-img') ||
      card.find('.prod-img-wrap img').first().attr('src')
    );
    const compareAtPricePaise = parseCompareAt($, priceEl);
    const pageIsSale = page === 'sale.html';

    products.push({
      slug,
      name,
      category: inferCategory(page, card),
      description: card.attr('data-desc') || 'A beautiful handcrafted piece designed for modern Indian homes.',
      pricePaise: parsePrice($, priceEl),
      compareAtPricePaise,
      stock: Number(process.env.SEED_DEFAULT_STOCK || 12),
      reservedStock: 0,
      dimensions: { summary: card.attr('data-size') || 'Standard Dimensions' },
      materials: { summary: card.attr('data-material') || 'Premium Wood / Upholstery' },
      images: image ? [{ url: image, alt: name }] : [],
      tags: [inferCategory(page, card), pageIsSale ? 'sale' : null].filter(Boolean),
      isFeatured: page !== 'sale.html' && products.length < 4,
      isOnSale: pageIsSale || Boolean(compareAtPricePaise),
      status: 'active',
      sourcePage: page
    });
  });

  return products;
}

async function seedCatalog() {
  const pages = Object.keys(PAGE_CATEGORY);
  const bySlug = new Map();
  for (const page of pages) {
    readProductsFromPage(page).forEach(product => {
      if (bySlug.has(product.slug)) {
        const existing = bySlug.get(product.slug);
        bySlug.set(product.slug, {
          ...existing,
          isOnSale: existing.isOnSale || product.isOnSale,
          compareAtPricePaise: existing.compareAtPricePaise || product.compareAtPricePaise,
          tags: Array.from(new Set([...(existing.tags || []), ...(product.tags || [])]))
        });
      } else {
        bySlug.set(product.slug, product);
      }
    });
  }

  for (const product of bySlug.values()) {
    await Product.findOneAndUpdate(
      { slug: product.slug },
      { $set: product },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  await Coupon.findOneAndUpdate(
    { code: 'WELCOME10' },
    {
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      minSubtotalPaise: 0,
      active: true
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await User.findOneAndUpdate(
      { email: process.env.ADMIN_EMAIL.toLowerCase() },
      {
        name: process.env.ADMIN_NAME || 'Sunny Admin',
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        phone: process.env.ADMIN_PHONE || '',
        role: 'admin',
        emailVerified: true,
        passwordHash: await User.hashPassword(process.env.ADMIN_PASSWORD)
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  return bySlug.size;
}

async function main() {
  await connectDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunny-furniture');
  const count = await seedCatalog();
  console.log(`Seeded ${count} products, WELCOME10 coupon, and optional admin user.`);
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedCatalog, readProductsFromPage };
