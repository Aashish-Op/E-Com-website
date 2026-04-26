const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let app;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.CSRF_STRICT = 'false';
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
  const Product = require('../models/Product');
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
  const Product = require('../models/Product');
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
