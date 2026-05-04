const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.CSRF_STRICT = 'false';
  process.env.RAZORPAY_KEY_ID = '';
  process.env.RAZORPAY_KEY_SECRET = '';
  process.env.EMAIL_HOST = '';
  process.env.EMAIL_USER = '';
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  app = require('../server').app;
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

async function loginAdmin(email = 'admin@example.com') {
  const User = require('../src/models/User');
  await User.create({
    name: 'Admin User',
    email,
    phone: '9876543210',
    role: 'admin',
    passwordHash: await User.hashPassword('secret123')
  });

  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'secret123' }).expect(200);
  return agent;
}

test('health endpoint responds', async () => {
  const res = await request(app).get('/api/health').expect(200);
  expect(res.body.success).toBe(true);
});

test('registers and returns current user', async () => {
  const agent = request.agent(app);
  const register = await agent.post('/api/auth/register').send({
    name: 'Customer One',
    email: 'customer@example.com',
    phone: '9876543210',
    password: 'secret123'
  }).expect(201);

  expect(register.body.user.email).toBe('customer@example.com');
  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body.user.email).toBe('customer@example.com');
});

test('lists products and supports cart add by name', async () => {
  const Product = require('../src/models/Product');
  await Product.create({
    slug: 'aura-3-seater-sofa',
    name: 'Aura 3-seater sofa',
    category: 'living-room',
    pricePaise: 4200000,
    stock: 5,
    images: [{ url: '/aura3seater.jpg', alt: 'Aura 3-seater sofa' }]
  });

  const agent = request.agent(app);
  const products = await agent.get('/api/products?category=living-room').expect(200);
  expect(products.body.products).toHaveLength(1);

  const cart = await agent.post('/api/cart/add').send({ name: 'Aura 3-seater sofa' }).expect(201);
  expect(cart.body.cart.items[0].quantity).toBe(1);
  expect(cart.body.cart.totals.totalPaise).toBe(4200000);
});

test('creates a COD order and decrements stock', async () => {
  const Product = require('../src/models/Product');
  const product = await Product.create({
    slug: 'aura-3-seater-sofa',
    name: 'Aura 3-seater sofa',
    category: 'living-room',
    pricePaise: 4200000,
    stock: 2,
    images: [{ url: '/aura3seater.jpg', alt: 'Aura 3-seater sofa' }]
  });

  const agent = request.agent(app);
  await agent.post('/api/cart/add').send({ slug: product.slug, quantity: 1 }).expect(201);
  const order = await agent.post('/api/orders/checkout/cod').send({
    contact: { name: 'Customer One', email: 'customer@example.com', phone: '9876543210' },
    shippingAddress: { fullName: 'Customer One', phone: '9876543210', street: '1 Main Road', city: 'Delhi', pincode: '110001' }
  }).expect(201);

  expect(order.body.order.orderNumber).toMatch(/^SF-/);
  const freshProduct = await Product.findById(product._id);
  expect(freshProduct.stock).toBe(1);
});

test('keeps cart after Razorpay order creation so shopper can switch to COD', async () => {
  const Product = require('../src/models/Product');
  const product = await Product.create({
    slug: 'rattan-patio-chair',
    name: 'Rattan Patio Chair',
    category: 'outdoor',
    pricePaise: 1295000,
    stock: 3,
    images: [{ url: '/rattanChair.webp', alt: 'Rattan Patio Chair' }]
  });

  const agent = request.agent(app);
  const checkoutPayload = {
    contact: { name: 'Customer One', email: 'customer@example.com', phone: '9876543210' },
    shippingAddress: { fullName: 'Customer One', phone: '9876543210', street: '1 Main Road', city: 'Delhi', pincode: '110001' }
  };

  await agent.post('/api/cart/add').send({ slug: product.slug, quantity: 1 }).expect(201);
  const razorpayOrder = await agent.post('/api/payments/create-order').send(checkoutPayload).expect(201);
  expect(razorpayOrder.body.razorpay.testMode).toBe(true);

  const cartAfterRazorpay = await agent.get('/api/cart').expect(200);
  expect(cartAfterRazorpay.body.cart.items).toHaveLength(1);

  const codOrder = await agent.post('/api/orders/checkout/cod').send(checkoutPayload).expect(201);
  expect(codOrder.body.order.paymentMethod).toBe('cod');

  const cartAfterCod = await agent.get('/api/cart').expect(200);
  expect(cartAfterCod.body.cart.items).toHaveLength(0);
  const freshProduct = await Product.findById(product._id);
  expect(freshProduct.stock).toBe(2);
  expect(freshProduct.reservedStock).toBe(0);
});

test('admin product CRUD controls storefront visibility', async () => {
  const agent = await loginAdmin();

  const created = await agent.post('/api/admin/products').send({
    name: 'Volta Study Desk',
    category: 'study',
    description: 'Compact walnut desk for focused work.',
    pricePaise: 1850000,
    compareAtPricePaise: 2200000,
    stock: 8,
    images: [{ url: '/voltaDesk.jpg', alt: 'Volta Study Desk' }],
    tags: ['desk', 'study'],
    isFeatured: true,
    isOnSale: true,
    status: 'active'
  }).expect(201);

  const productId = created.body.product.id;
  const publicStudy = await request(app).get('/api/products?category=study').expect(200);
  expect(publicStudy.body.products.map(product => product.name)).toContain('Volta Study Desk');

  await agent.put('/api/admin/products/' + productId).send({
    status: 'draft',
    stock: 12,
    pricePaise: 1750000
  }).expect(200);

  const hiddenFromStorefront = await request(app).get('/api/products?category=study').expect(200);
  expect(hiddenFromStorefront.body.products).toHaveLength(0);

  await agent.put('/api/admin/products/' + productId).send({ status: 'active' }).expect(200);
  const saleProducts = await request(app).get('/api/products?sale=true').expect(200);
  expect(saleProducts.body.products.map(product => product.slug)).toContain('volta-study-desk');

  await agent.delete('/api/admin/products/' + productId).expect(200);
  const afterDelete = await request(app).get('/api/products?category=study').expect(200);
  expect(afterDelete.body.products).toHaveLength(0);

  const archived = await agent.get('/api/admin/products?status=archived').expect(200);
  expect(archived.body.products).toHaveLength(1);
});

test('logged-in customers can view their orders without blocking guest checkout', async () => {
  const Product = require('../src/models/Product');
  const product = await Product.create({
    slug: 'loom-lounge-chair',
    name: 'Loom Lounge Chair',
    category: 'living-room',
    pricePaise: 1450000,
    stock: 4,
    images: [{ url: '/loomChair.jpg', alt: 'Loom Lounge Chair' }]
  });

  const guest = request.agent(app);
  await guest.post('/api/cart/add').send({ slug: product.slug, quantity: 1 }).expect(201);
  await guest.post('/api/orders/checkout/cod').send({
    contact: { name: 'Guest Buyer', email: 'guest@example.com', phone: '9876543210' },
    shippingAddress: { fullName: 'Guest Buyer', phone: '9876543210', street: '1 Main Road', city: 'Delhi', pincode: '110001' }
  }).expect(201);
  await guest.get('/api/orders').expect(401);

  const customer = request.agent(app);
  await customer.post('/api/auth/register').send({
    name: 'Customer Two',
    email: 'customer-two@example.com',
    phone: '9876543211',
    password: 'secret123'
  }).expect(201);
  await customer.post('/api/cart/add').send({ slug: product.slug, quantity: 1 }).expect(201);
  const order = await customer.post('/api/orders/checkout/cod').send({
    contact: { name: 'Customer Two', email: 'customer-two@example.com', phone: '9876543211' },
    shippingAddress: { fullName: 'Customer Two', phone: '9876543211', street: '2 Main Road', city: 'Delhi', pincode: '110002' }
  }).expect(201);

  const orders = await customer.get('/api/orders').expect(200);
  expect(orders.body.orders).toHaveLength(1);
  expect(orders.body.orders[0].orderNumber).toBe(order.body.order.orderNumber);
});
