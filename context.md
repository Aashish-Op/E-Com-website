# Sunny Furniture Project Context And Handoff

Last updated: 2026-04-26  
Workspace path used in this session: `c:\Users\Shubham\Downloads\project - Copy\project - Copy`

This file exists so the project can be moved to another device and the next chat/session can resume with full context.

## 1. Original Project State

Sunny Furniture started as a luxury furniture storefront with a strong static frontend:

- Brand/UI: Sunny Furniture, premium furniture website.
- Frontend pages existed under `src/pages/`:
  - `index.html`
  - `bedroom.html`
  - `living-room.html`
  - `dining.html`
  - `storage.html`
  - `outdoor.html`
  - `study.html`
  - `newdecor.html`
  - `sale.html`
  - info/help pages: `about.html`, `contact-us.html`, `faqs.html`, `delivery-info.html`, `returns-refunds.html`, `track-order.html`, `installation.html`, `philosophy.html`
- Styling existed under `src/styles/index.css`.
- Frontend scripts existed under `src/scripts/script.js` and `src/scripts/filters.js`.
- Product images existed under `src/assets/images/`.
- There were 80+ product images and many hardcoded `.prod-card` product cards.

Important frontend features already present before backend work:

- Luxury responsive UI.
- Custom design palette: espresso, walnut, gold, sage, terra, linen/cream.
- Animations: reveal animations, smooth transitions, custom cursor, page intro.
- Product cards, product modal, search overlay, wishlist drawer, cart drawer, checkout overlay, success overlay.
- The cart, wishlist, auth, checkout, OTP, and order confirmation were browser-side simulations using `localStorage`.
- Cart badge was visually present and often hardcoded as `2`.
- Checkout simulated UPI/card/COD without real payment or database.

Initial backend state:

- A `backend/` folder existed but was incomplete.
- `backend/server.js` referenced missing route files.
- Only placeholder `User.js` and `Product.js` models existed.
- There was no working API, no real cart/order/payment/admin system.

## 2. Product/Architecture Decisions Locked

The following decisions were made before implementation:

- Backend stack: Node.js + Express.
- Database: MongoDB with Mongoose.
- Payment gateway: Razorpay for India.
- Hosting target: Heroku.
- Scope: production-ready MVP, not just static demo.
- Customer storefront approach: keep existing HTML/CSS/JS storefront.
- Admin dashboard approach: React admin dashboard.
- Payment scope: Razorpay plus COD.
- Account verification: email/password only for v1, no OTP/SMS.
- Order tracking: internal order status managed by admin.
- Pricing rules: simple INR pricing, WELCOME10-style coupons, configurable free delivery threshold.
- Checkout identity: guest checkout plus account checkout.
- Product migration: auto-seed current catalog by parsing existing hardcoded `.prod-card` HTML.

Explicitly out of v1 unless added later:

- GST invoices.
- Dynamic shipping by pincode/cart size.
- Courier API integration.
- SMS OTP.
- Full React rewrite of storefront.

## 3. Implementation Completed

The static site was converted into a full-stack MVP skeleton while preserving the existing storefront UI.

### Root Project

Files changed/added:

- `package.json`
- `package-lock.json`
- `.gitignore`
- `Procfile`

Root scripts now include:

```bash
npm start
npm run dev
npm run dev:memory
npm run seed
npm test
npm run admin:install
npm run admin:build
```

Important behavior:

- `npm start` runs `node backend/server.js`.
- `npm run dev` runs backend with nodemon and expects a real MongoDB connection.
- `npm run dev:memory` starts an in-memory MongoDB, seeds products, and runs the app. Use this when local MongoDB is unavailable.
- `npm run seed` parses existing frontend product cards and seeds MongoDB.
- `npm run admin:build` builds the React admin.
- `heroku-postbuild` installs and builds admin for Heroku.
- `Procfile` contains `web: npm start`.
- Node engine is set to `24.x`.

### Backend

Main server:

- `backend/server.js`

Server responsibilities:

- Loads env from `backend/.env`.
- Connects MongoDB.
- Adds Helmet, CORS, rate limiting, JSON/body parsing, cookie parsing.
- Adds request context for auth/cart/CSRF cookies.
- Registers API routes.
- Serves built React admin from `/admin`.
- Serves static storefront files from:
  - `src/pages`
  - `src/styles`
  - `src/scripts`
  - `src/assets/images`
- Serves root `/` as `src/pages/index.html`.

Backend config:

- `backend/config/database.js`
- `backend/config/razorpay.js`
- `backend/config/cloudinary.js`

Backend middleware:

- `backend/middleware/requestContext.js`
  - creates anonymous cart cookie
  - creates CSRF cookie
  - loads JWT user from cookie or bearer token
- `backend/middleware/auth.js`
  - `requireAuth`
  - `requireAdmin`
- `backend/middleware/csrf.js`
  - CSRF guard for mutating requests
  - relaxed in development unless `CSRF_STRICT=true`
- `backend/middleware/errorHandler.js`
  - JSON error handling and API 404s

Backend utils:

- `backend/utils/slugify.js`
- `backend/utils/money.js`
- `backend/utils/httpError.js`
- `backend/utils/asyncHandler.js`
- `backend/utils/cookies.js`

Backend models:

- `backend/models/User.js`
  - email/password auth with `passwordHash`
  - roles: `user`, `admin`, `super_admin`
  - addresses
  - email verification/reset token fields
- `backend/models/Product.js`
  - slug, name, category, pricePaise, compareAtPricePaise, stock, reservedStock
  - materials, dimensions, images, tags, featured/sale/status
  - text index for search
- `backend/models/Cart.js`
  - user or anonymous cart token
  - item snapshots
  - applied coupon
- `backend/models/Order.js`
  - orderNumber
  - optional user
  - guest contact
  - shipping address
  - item snapshots
  - subtotal/discount/delivery/total
  - payment and fulfillment statuses
  - Razorpay IDs
  - inventory mode/timeline
- `backend/models/Coupon.js`
- `backend/models/Review.js`
- `backend/models/Wishlist.js`

Backend services:

- `backend/services/serializer.js`
  - DTOs for products, carts, orders
- `backend/services/pricingService.js`
  - subtotal
  - coupon calculation
  - free-delivery threshold
- `backend/services/cartService.js`
  - get/create cart
  - merge guest cart into user cart on login/register
  - add/update/remove item
  - apply/remove coupon
  - clear cart
- `backend/services/orderService.js`
  - create COD/Razorpay orders from cart
  - inventory decrement/reservation
  - release/capture reserved stock
  - mark paid
  - update fulfillment status
- `backend/services/paymentService.js`
  - Razorpay order creation
  - payment signature verification
  - webhook signature verification
  - test-mode fallback when Razorpay keys are missing
- `backend/services/emailService.js`
  - transactional email send hooks
  - no-op logging if SMTP is not configured
- `backend/services/uploadService.js`
  - Cloudinary upload
  - data URI fallback when Cloudinary is not configured

Backend routes:

- `backend/routes/auth.js`
  - `GET /api/auth/csrf`
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/password/forgot`
  - `POST /api/auth/verify-email`
- `backend/routes/products.js`
  - `GET /api/products`
  - `GET /api/products/search?q=...`
  - `GET /api/products/:slug`
  - `POST /api/products/:slug/reviews`
- `backend/routes/cart.js`
  - `GET /api/cart`
  - `POST /api/cart/add`
  - `PUT /api/cart/items/:itemId`
  - `DELETE /api/cart/items/:itemId`
  - `POST /api/cart/coupon`
  - `DELETE /api/cart/coupon`
- `backend/routes/orders.js`
  - `POST /api/orders`
  - `POST /api/orders/checkout/cod`
  - `GET /api/orders`
  - `GET /api/orders/track?orderNumber=...&contact=...`
  - `GET /api/orders/:id`
- `backend/routes/payments.js`
  - `POST /api/payments/create-order`
  - `POST /api/payments/verify`
  - `POST /api/payments/webhook`
- `backend/routes/wishlist.js`
  - account-backed wishlist routes
- `backend/routes/admin.js`
  - admin metrics
  - product CRUD
  - image upload
  - order list/status update
  - coupon CRUD

Backend scripts:

- `backend/scripts/seedCatalog.js`
  - Parses hardcoded `.prod-card` cards from current HTML pages.
  - Seeds Product records.
  - Seeds `WELCOME10` coupon.
  - Seeds admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.
- `backend/scripts/devWithMemoryDb.js`
  - Creates in-memory MongoDB.
  - Seeds catalog.
  - Starts Express app.
  - Useful when no local MongoDB is installed.

Backend tests:

- `backend/tests/app.test.js`
  - health endpoint
  - register/current user
  - product list/cart add
  - COD order creation and stock decrement

### Admin Dashboard

React/Vite admin app added under `admin/`.

Files:

- `admin/package.json`
- `admin/package-lock.json`
- `admin/index.html`
- `admin/vite.config.js`
- `admin/src/App.jsx`
- `admin/src/styles.css`

Admin route:

- Served by Express at `/admin`.

Admin features implemented:

- Login via backend auth.
- Dashboard metrics:
  - orders
  - products
  - revenue
  - low stock
- Product list/search.
- Product create form.
- Inline product price/stock updates.
- Featured toggle.
- Order list.
- Order fulfillment status update.
- Coupon list/create.

Admin is functional MVP quality, not final polished enterprise admin.

### Storefront Integration

The existing frontend was preserved. The main integration was added to:

- `src/scripts/script.js`

An API bridge block was inserted:

- Label in file: `SUNNY FURNITURE API BRIDGE`

What the bridge does:

- Uses `/api` by default.
- Gets CSRF token from cookie or `/api/auth/csrf`.
- Uses `credentials: include` for cookie auth/cart.
- Overrides `window.addToCart` to call `POST /api/cart/add`.
- Opens/renders the existing cart drawer using API cart data.
- Supports quantity update/removal using API item IDs.
- Applies promo codes using `POST /api/cart/coupon`.
- Opens checkout using API cart totals.
- Adds missing checkout email/phone fields dynamically.
- Creates COD orders through `/api/orders/checkout/cod`.
- Creates Razorpay orders through `/api/payments/create-order`.
- If Razorpay credentials are missing, test-mode auto-verifies payment for local demo.
- Supports real Razorpay Checkout when keys are configured.
- Calls `/api/payments/verify` after Razorpay payment.
- Uses API search results from `/api/products/search`.
- Adds track order support using order number plus email/phone.
- Uses capture-phase event handlers to prefer API behavior over legacy localStorage behavior.
- Reinstalls `window.addToCart` at the end of the file because legacy cart code also defines it later.

Important caveat:

- The legacy localStorage code still exists in `src/scripts/script.js`. The API bridge is designed to override/prefer API behavior without deleting the existing UI code. Manual QA is still needed on every storefront page.

## 4. Environment Variables

Template:

- `backend/.env.example`

Important env vars:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/sunny-furniture
PORT=5000
NODE_ENV=development
RATE_LIMIT_MAX=600

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_2026
JWT_EXPIRE=7d
CSRF_STRICT=false

ADMIN_EMAIL=admin@sunnyfurniture.com
ADMIN_PASSWORD=Admin@123
ADMIN_NAME=Sunny Admin

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx

EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@sunnyfurniture.com

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

FREE_DELIVERY_THRESHOLD_PAISE=1500000
DELIVERY_FEE_PAISE=0
SEED_DEFAULT_STOCK=12

FRONTEND_URL=http://localhost:5000
ADMIN_URL=http://localhost:3001
```

Security note:

- `backend/.env` is ignored by git.
- Do not commit real secrets.
- On another device, recreate `backend/.env` from `backend/.env.example`.

## 5. Verification History

The following verification was run after implementation:

```bash
npm install
npm install --prefix admin
npm test
npm run admin:build
node -c backend/server.js
node -c backend/routes/admin.js
node -c backend/routes/payments.js
node -c backend/scripts/seedCatalog.js
node -c backend/scripts/devWithMemoryDb.js
node -c src/scripts/script.js
```

Results:

- `npm test`: passed.
- Test suite: 1 passed.
- Tests: 4 passed.
- `npm run admin:build`: passed.
- Vite admin build created `admin/dist`.
- Syntax checks passed.

Catalog parser checks:

- Parser found 104 product cards across frontend pages.
- Seed process produced 96 unique product records after slug de-duplication.

Live smoke checks that passed during implementation:

- `GET http://localhost:5000/api/health` returned 200.
- `GET http://localhost:5000/api/products?limit=1` returned seeded product JSON.
- `GET http://localhost:5000/index.html` returned 200.
- `GET http://localhost:5000/admin/` returned 200.

Current check on 2026-04-26:

- Dev server is not currently running.
- `curl http://localhost:5000/api/health` returned no response (`000`).
- Run `npm run dev:memory` to start immediately without MongoDB.
- `git status --short --untracked-files=all` produced no output during this handoff check, meaning the visible working tree appeared clean at that moment.

## 6. How To Resume On Another Device

### Option A: Fast local demo without MongoDB

Use this if MongoDB is not installed locally.

```bash
npm install
npm install --prefix admin
npm run admin:build
npm run dev:memory
```

Open:

- Storefront: `http://localhost:5000`
- Admin: `http://localhost:5000/admin/`
- API health: `http://localhost:5000/api/health`

Default admin credentials if not changed:

```text
Email: admin@sunnyfurniture.com
Password: Admin@123
```

Important:

- `dev:memory` data disappears when the server stops.
- It is only for development/demo.

### Option B: Local development with MongoDB

1. Install/start MongoDB locally or use MongoDB Atlas.
2. Create `backend/.env` from `backend/.env.example`.
3. Set `MONGODB_URI`.
4. Install dependencies:

```bash
npm install
npm install --prefix admin
```

5. Seed database:

```bash
npm run seed
```

6. Build admin:

```bash
npm run admin:build
```

7. Start server:

```bash
npm run dev
```

Open:

- Storefront: `http://localhost:5000`
- Admin: `http://localhost:5000/admin/`

### Option C: Production/Heroku path

1. Create MongoDB Atlas cluster.
2. Create Heroku app.
3. Set Heroku config vars from `backend/.env.example`.
4. Set at minimum:

```bash
MONGODB_URI
JWT_SECRET
NODE_ENV=production
CSRF_STRICT=true
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
EMAIL_* values
CLOUDINARY_* values
FRONTEND_URL
ADMIN_URL
```

5. Deploy to Heroku.
6. Run seed once against production database:

```bash
heroku run npm run seed
```

7. Configure Razorpay webhook URL:

```text
https://YOUR-HEROKU-APP.herokuapp.com/api/payments/webhook
```

8. Test checkout in Razorpay test mode before going live.

## 7. Current Feature Status

### Done

- Node/Express API foundation.
- Mongo/Mongoose models.
- Cookie auth with JWT.
- Anonymous cart cookie.
- Guest cart and logged-in cart support.
- Guest cart merge on login/register.
- Product listing/search/detail API.
- HTML catalog parser and seed script.
- Cart add/update/remove.
- Coupon apply/remove.
- COD checkout.
- Razorpay create-order and verify routes.
- Razorpay webhook route.
- Inventory decrement/reservation mechanics.
- Internal order status tracking.
- Admin auth guard.
- Admin metrics.
- Admin product CRUD basics.
- Admin order status update.
- Admin coupon create/list/update basics.
- Cloudinary upload route support.
- Email service hooks.
- React admin build.
- Storefront API bridge.
- Basic Jest/Supertest backend tests.
- Heroku `Procfile`.
- In-memory dev script.

### Partial / Needs Manual QA

- Storefront product grids are still static HTML; they are not fully rendered from API yet.
- API search works, but existing search UI still has legacy catalog fallback.
- Cart/checkout API bridge exists, but every product/category page should be manually tested.
- Wishlist backend exists for logged-in users; guest wishlist still mostly follows legacy/local behavior.
- Track order page dynamically adds email/phone input and calls API; needs visual QA.
- Product reviews backend exists but no polished storefront review UI is integrated.
- Password reset backend stub exists, but no complete email link UI flow.
- Email sends are no-op unless SMTP is configured.
- Cloudinary upload falls back to data URI when Cloudinary env vars are missing.
- Razorpay uses local test fallback when credentials are missing; real payment requires real Razorpay keys and webhook setup.
- Admin UI is functional MVP, not final premium admin polish.

### Not Done Yet

- Playwright frontend acceptance tests.
- GitHub Actions CI/CD.
- Full Heroku deployment execution.
- MongoDB Atlas setup.
- Razorpay dashboard/webhook setup.
- SendGrid/SMTP setup.
- Cloudinary account setup.
- Production logging/monitoring.
- Database backup automation.
- Full SEO structured data.
- Full product-grid API rendering.
- Customer profile/account page.
- Address book UI.
- Full order history UI in storefront.
- Production-grade admin image UX and richer analytics.

## 8. Known Issues And Risks

- The original frontend files contain some mojibake/encoding artifacts like `â...` in comments/text. This existed before backend work and was not fully cleaned.
- `src/scripts/script.js` is large and still contains legacy localStorage flows. The API bridge is layered on top instead of a full refactor.
- Directly opening HTML files from disk will not behave like production because API/static serving assumes Express. Use `http://localhost:5000`.
- `dev:memory` is temporary and loses all data on restart.
- Production must use MongoDB Atlas or persistent MongoDB.
- Production must set a strong `JWT_SECRET`.
- Production should set `CSRF_STRICT=true`.
- Production Razorpay must use real keys and webhook secret.
- Heroku must have all config vars set before launch.
- Admin route is `/admin`; if `admin/dist` is missing, server returns a message asking to run `npm run admin:build`.
- The API bridge depends on products being seeded. If cart add by name fails, run `npm run seed` or `npm run dev:memory`.

## 9. Important Commands

Install everything:

```bash
npm install
npm install --prefix admin
```

Build admin:

```bash
npm run admin:build
```

Run tests:

```bash
npm test
```

Run quick demo without MongoDB:

```bash
npm run dev:memory
```

Run with real MongoDB:

```bash
npm run seed
npm run dev
```

Start production-style server:

```bash
npm start
```

Check API:

```bash
curl http://localhost:5000/api/health
curl "http://localhost:5000/api/products?limit=3"
```

## 10. Recommended Next Work Order

1. Move/copy repository to the new device.
2. Recreate `backend/.env` from `backend/.env.example`.
3. Run:

```bash
npm install
npm install --prefix admin
npm run admin:build
npm run dev:memory
```

4. Verify:

- `http://localhost:5000`
- `http://localhost:5000/admin/`
- `http://localhost:5000/api/health`

5. Manual QA checklist:

- Home page loads styles/images through Express.
- Category pages load.
- Product modal opens.
- Add product to cart.
- Quantity increase/decrease.
- Remove item.
- Apply `WELCOME10`.
- COD checkout with name, email, phone, street, city, pincode.
- Success overlay shows real order number.
- Track order by order number plus email/phone.
- Admin login works.
- Admin product edit changes API product.
- Admin order status update works.

6. Set up persistent database:

- MongoDB Atlas recommended.
- Set `MONGODB_URI`.
- Run `npm run seed`.

7. Configure real integrations:

- Razorpay test keys.
- Razorpay webhook.
- SendGrid/SMTP.
- Cloudinary.

8. Add missing acceptance tests:

- Playwright cart/checkout/order/admin flows.

9. Deploy to Heroku:

- Set config vars.
- Push/deploy.
- Run seed once.
- Smoke test production URLs.

10. After production basics are stable:

- Replace static product grids with API-rendered grids.
- Add customer profile/order history UI.
- Improve admin polish.
- Add CI/CD and monitoring.

## 11. Handy File Map

Core backend:

- `backend/server.js`
- `backend/models/*.js`
- `backend/routes/*.js`
- `backend/services/*.js`
- `backend/middleware/*.js`
- `backend/config/*.js`
- `backend/scripts/seedCatalog.js`
- `backend/scripts/devWithMemoryDb.js`
- `backend/tests/app.test.js`

Admin:

- `admin/src/App.jsx`
- `admin/src/styles.css`
- `admin/vite.config.js`

Storefront:

- `src/pages/*.html`
- `src/styles/index.css`
- `src/scripts/script.js`
- `src/scripts/filters.js`
- `src/assets/images/*`

Deployment:

- `package.json`
- `package-lock.json`
- `Procfile`
- `backend/.env.example`

## 12. Short Continuation Prompt For Next Chat

Use this on the new device:

```text
I am continuing the Sunny Furniture full-stack e-commerce MVP. Read context.md first. The project preserves the existing static luxury storefront and adds Express/MongoDB/Razorpay/React-admin. Please inspect the repo, verify current status, run tests/build, and continue from the "Recommended Next Work Order" section without re-planning from scratch.
```

