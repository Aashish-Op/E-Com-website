const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDatabase = require('./config/database');
const requestContext = require('./middleware/requestContext');
const csrfProtection = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const paymentsRouter = require('./routes/payments');

const app = express();
const rootDir = path.join(__dirname, '..');
const pagesDir = path.join(rootDir, 'src', 'pages');
const stylesDir = path.join(rootDir, 'src', 'styles');
const scriptsDir = path.join(rootDir, 'src', 'scripts');
const imagesDir = path.join(rootDir, 'src', 'assets', 'images');
const adminDistDir = path.join(rootDir, 'admin', 'dist');

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000'
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 600),
  standardHeaders: true,
  legacyHeaders: false
}));

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentsRouter.webhookHandler);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestContext);
app.use(csrfProtection);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/search', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', paymentsRouter);
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'API running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/admin', express.static(adminDistDir));
app.get(/^\/admin(?:\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(adminDistDir, 'index.html'), err => {
    if (err) res.status(503).send('Admin dashboard has not been built yet. Run npm run admin:build.');
  });
});

app.use(express.static(pagesDir));
app.use(express.static(stylesDir));
app.use(express.static(scriptsDir));
app.use(express.static(imagesDir));
app.use('/assets/images', express.static(imagesDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(pagesDir, 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

async function start() {
  await connectDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunny-furniture');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Sunny Furniture server running on http://localhost:${PORT}`);
    console.log(`API health: http://localhost:${PORT}/api/health`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
