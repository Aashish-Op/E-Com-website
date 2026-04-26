# Sunny Furniture Production Deployment Plan

Last updated: 2026-04-26

This is the step-by-step production plan for deploying the Sunny Furniture full-stack MVP. It assumes the local browser test already passed and the app works at `http://localhost:5000`.

Do not put real secrets in this Markdown file. Store real secrets only in `backend/.env` locally, in your password manager, and in your hosting provider config vars.

## 1. Deployment Goal

The goal is to move from local demo mode to a real public website with:

- A persistent MongoDB Atlas database.
- A deployed Node/Express server.
- The static storefront served by Express.
- The React admin dashboard served at `/admin`.
- Real production environment variables.
- COD checkout.
- Razorpay payments after test-mode verification.
- Email sending after SMTP setup.
- Cloudinary image upload for admin product images.

Target hosting from the project context: Heroku.

The app already has:

- `Procfile` with `web: npm start`.
- `npm start` running `node backend/server.js`.
- `heroku-postbuild` that installs and builds the admin app.
- `npm run seed` for product/catalog/admin seeding.

## 2. Golden Rule Before Deployment

Local `npm run dev:memory` is only for demo/testing. Do not use it for production.

Production must use:

- `npm start`
- A real `MONGODB_URI`
- Hosting config vars
- No local `.env` committed to Git

## 3. Accounts You Need

Create these accounts before production deployment:

| Service | Why you need it | When needed |
| --- | --- | --- |
| Heroku | Hosts the Express app and serves website/admin/API | Before first deploy |
| MongoDB Atlas | Stores users, products, carts, orders, coupons | Before first deploy |
| Razorpay | Online payment gateway for India | Before accepting online payments |
| SendGrid or SMTP provider | Sends order/status emails | Before customer launch if emails are required |
| Cloudinary | Stores uploaded product/admin images | Before using admin image upload in production |
| Domain/DNS provider | Public custom domain, for example `sunnyfurniture.in` | Before public launch |

Use a business email account, enable 2FA on every service, and save all credentials in a password manager.

## 4. Source Links Checked

Official docs used while preparing this guide:

- Heroku Node/Procfile/config vars: https://devcenter.heroku.com/articles/getting-started-with-nodejs
- Heroku config vars: https://devcenter2.assets.heroku.com/articles/config-vars
- MongoDB Atlas app connection: https://www.mongodb.com/docs/atlas/driver-connection/
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
- Razorpay webhooks: https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/
- SendGrid SMTP: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api
- Cloudinary Node SDK credentials: https://cloudinary.com/documentation/node_quickstart

## 5. Production Environment Variables

Set these in Heroku config vars. Locally, the same values can live in `backend/.env` for production-like testing.

Do not manually set `PORT` on Heroku. Heroku provides `process.env.PORT` automatically.

### Required For Any Real Deployment

| Variable | Example | Why |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb+srv://sunny_app:<password>@cluster0.xxxxx.mongodb.net/sunny-furniture?retryWrites=true&w=majority` | Persistent database |
| `NODE_ENV` | `production` | Enables production behavior |
| `JWT_SECRET` | Long random secret | Signs login cookies/tokens |
| `JWT_EXPIRE` | `7d` | Login session lifetime |
| `CSRF_STRICT` | `true` | Enables stricter CSRF protection |
| `RATE_LIMIT_MAX` | `600` | API rate limit per window |
| `FRONTEND_URL` | `https://YOUR-APP.herokuapp.com` or custom domain | CORS allowlist |
| `ADMIN_URL` | Same origin, for example `https://YOUR-APP.herokuapp.com` | CORS allowlist |

### Required Before First Production Seed

These create/update the initial admin user when you run `npm run seed`.

| Variable | Example | Why |
| --- | --- | --- |
| `ADMIN_EMAIL` | `owner@yourdomain.com` | Admin login email |
| `ADMIN_PASSWORD` | Strong unique password | Admin login password |
| `ADMIN_NAME` | `Sunny Admin` | Admin profile name |

Important: `npm run seed` uses these values to upsert the admin user. If you run seed again with the same `ADMIN_EMAIL`, it can update that admin password.

### Required For Razorpay Payments

Use Razorpay test keys first. Switch to live keys only after test checkout passes on the deployed site.

| Variable | Example | Why |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | `rzp_test_...` or `rzp_live_...` | Checkout public key |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | Server-side order/signature verification |
| `RAZORPAY_WEBHOOK_SECRET` | Random secret you choose | Verifies webhook requests |

### Required For Email Sending

For SendGrid SMTP:

| Variable | Recommended value | Why |
| --- | --- | --- |
| `EMAIL_HOST` | `smtp.sendgrid.net` | SMTP host |
| `EMAIL_PORT` | `587` | TLS SMTP port |
| `EMAIL_SECURE` | `false` | Use STARTTLS on port 587 |
| `EMAIL_USER` | `apikey` | SendGrid requires this exact username string |
| `EMAIL_PASSWORD` | SendGrid API key | SMTP password |
| `EMAIL_FROM` | `Sunny Furniture <orders@yourdomain.com>` | Verified sender shown to customers |

If email vars are missing, the app logs email actions as no-op. That is acceptable for internal testing, but not ideal for real customer launch.

### Required For Cloudinary Uploads

| Variable | Example | Why |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | Image account identifier |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key | Upload authentication |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret | Upload signing |

If Cloudinary vars are missing, the upload service can fall back to data URI behavior. Do not rely on that for production because it can bloat database records and is not a real media storage strategy.

### Store Rule Variables

| Variable | Example | Meaning |
| --- | --- | --- |
| `FREE_DELIVERY_THRESHOLD_PAISE` | `1500000` | Rs. 15,000 threshold |
| `DELIVERY_FEE_PAISE` | `0` | Delivery fee in paise |
| `SEED_DEFAULT_STOCK` | `12` | Default stock for seeded products |

## 6. Generate Strong Secrets

Run these locally in PowerShell.

Generate `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Generate `RAZORPAY_WEBHOOK_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the generated values in your password manager. Never commit them.

Changing `JWT_SECRET` later will log out existing users because old tokens will no longer verify.

## 7. MongoDB Atlas Setup

Do this before deploying because the app cannot start production without a real database.

1. Log in to MongoDB Atlas.
2. Create a project, for example `Sunny Furniture`.
3. Create a cluster.
4. Choose a region close to your expected customers and hosting region.
5. Go to `Database Access`.
6. Create a database user for the app, for example `sunny_app`.
7. Give the user only the permissions needed for this app. Prefer `readWrite` on the `sunny-furniture` database instead of full Atlas admin permissions.
8. Save the generated database password in your password manager.
9. Go to `Network Access`.
10. Add an allowed IP rule.
11. For Heroku Common Runtime, dyno outbound IPs are not fixed by default. The simplest starting option is `0.0.0.0/0`, but this allows connections from anywhere. If you use it, protect the database with a strong database user password and least-privilege permissions.
12. A more secure paid/advanced option is private networking or a provider setup with fixed outbound IPs.
13. Go to your cluster and click `Connect`.
14. Choose `Drivers` or `Connect your application`.
15. Copy the Node.js connection string.
16. Replace `<username>`, `<password>`, and database name.
17. Use this database name: `sunny-furniture`.
18. If the password contains special characters, URL-encode it before putting it in the URI.

Final shape:

```text
mongodb+srv://sunny_app:YOUR_URL_ENCODED_PASSWORD@cluster0.xxxxx.mongodb.net/sunny-furniture?retryWrites=true&w=majority
```

Store it as:

```text
MONGODB_URI=...
```

## 8. Razorpay Setup

Use this order: test mode first, live mode later.

### Test Mode

1. Log in to Razorpay Dashboard.
2. Switch to `Test Mode`.
3. Go to `Account & Settings`.
4. Go to `API Keys`.
5. Generate test API keys.
6. Save both values immediately:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
7. Put them in Heroku config vars.
8. Deploy the app.
9. Configure the test webhook after you know the deployed URL.

### Webhook

Your webhook URL will be:

```text
https://YOUR-DEPLOYED-DOMAIN/api/payments/webhook
```

In Razorpay Dashboard:

1. Stay in the same mode as your keys, test or live.
2. Go to `Account & Settings`.
3. Go to `Webhooks`.
4. Add a new webhook.
5. Use the URL above.
6. Enter the same secret you generated for `RAZORPAY_WEBHOOK_SECRET`.
7. Select these events at minimum:
   - `payment.authorized`
   - `payment.captured`
8. Optionally also select `payment.failed` for visibility. The current backend does not mark failed payments specially, but it will accept the webhook.
9. Save the webhook.
10. Test Razorpay checkout from the deployed website.

Important Razorpay notes:

- Test keys cannot accept real customer payments.
- Live keys must replace test keys before real payment launch.
- The webhook secret does not need to be the Razorpay API key secret.
- Razorpay webhooks must use a public HTTPS URL, not localhost.
- Create/configure separate test and live webhooks if Razorpay shows separate modes.

### Live Mode

Only switch to live mode after:

1. Deployed site works with COD.
2. Deployed site works with Razorpay test mode.
3. Razorpay business/KYC/website verification is complete.
4. Your refund, cancellation, privacy, contact, and delivery policies are visible on the website.
5. You have tested webhook delivery.

Then:

1. Switch Razorpay Dashboard to `Live Mode`.
2. Generate live API keys.
3. Replace Heroku `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with live values.
4. Create/update the live webhook with:

```text
https://YOUR-DEPLOYED-DOMAIN/api/payments/webhook
```

5. Set the live webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
6. Place a small real payment order.
7. Confirm the order becomes paid in admin.
8. Confirm Razorpay dashboard shows the payment.

## 9. SendGrid SMTP Setup

Do this before customer launch if you want customers to receive order emails.

1. Create or log in to SendGrid.
2. Verify your sender identity or authenticate your domain.
3. Create an API key with mail send permission.
4. Save the API key in your password manager.
5. Set these Heroku config vars:

```text
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=YOUR_SENDGRID_API_KEY
EMAIL_FROM=Sunny Furniture <orders@yourdomain.com>
```

6. Place a COD test order on the deployed site.
7. Confirm the customer email arrives.
8. Check spam/promotions folder.
9. If emails go to spam, complete domain authentication DNS records in SendGrid.

## 10. Cloudinary Setup

Do this before using admin product image upload in production.

1. Create or log in to Cloudinary.
2. Open Cloudinary Console settings/API keys.
3. Copy:
   - Cloud name
   - API key
   - API secret
4. Set these Heroku config vars:

```text
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
```

5. Deploy/restart app.
6. Log in to `/admin`.
7. Upload a product image.
8. Confirm the image URL is a Cloudinary URL.
9. Confirm the image loads on the storefront/admin.

## 11. Repository Hygiene Before Git Deploy

Before pushing to GitHub or Heroku, make sure secrets and dependency folders are not committed.

Your current repo should ignore at least:

```gitignore
node_modules/
admin/node_modules/
backend/.env
.env
*.log
sunny-*.log
admin/dist/
```

Run:

```powershell
git status --short --untracked-files=all
```

You should not see:

- `node_modules/`
- `admin/node_modules/`
- `backend/.env`
- Real secret files
- Large generated build folders unless you intentionally commit them

Search for accidentally committed secrets:

```powershell
rg -n "mongodb\\+srv|rzp_test_|rzp_live_|RAZORPAY_KEY_SECRET|EMAIL_PASSWORD|CLOUDINARY_API_SECRET|JWT_SECRET" -g "!node_modules/**" -g "!admin/node_modules/**"
```

It is okay for `backend/.env.example` to contain placeholder names. It is not okay for real keys to appear in committed files.

## 12. Production-Like Local Test With Atlas

Before Heroku deployment, test once using MongoDB Atlas from your own machine.

1. Create or update `backend/.env`.
2. Set `MONGODB_URI` to the Atlas URI.
3. Use non-live Razorpay test keys.
4. Keep `NODE_ENV=development` locally unless specifically testing production behavior.
5. Run:

```powershell
npm test
npm run admin:build
npm run seed
npm start
```

6. Open:

```text
http://localhost:5000
http://localhost:5000/admin/
http://localhost:5000/api/health
```

7. Test:
   - Home page
   - Category pages
   - Add to cart
   - Coupon `WELCOME10`
   - COD checkout
   - Track order
   - Admin login
   - Admin product stock/price edit
   - Admin order status update
   - Razorpay test checkout if keys are set

Stop the server after testing.

## 13. Heroku Deployment Steps

Replace `YOUR_HEROKU_APP` with your real Heroku app name.

### Create App

```powershell
heroku login
heroku create YOUR_HEROKU_APP
```

If the app already exists, connect the Git remote:

```powershell
heroku git:remote -a YOUR_HEROKU_APP
```

### Set Config Vars

Set required production vars:

```powershell
heroku config:set NODE_ENV=production -a YOUR_HEROKU_APP
heroku config:set CSRF_STRICT=true -a YOUR_HEROKU_APP
heroku config:set JWT_SECRET="YOUR_LONG_RANDOM_JWT_SECRET" -a YOUR_HEROKU_APP
heroku config:set JWT_EXPIRE=7d -a YOUR_HEROKU_APP
heroku config:set RATE_LIMIT_MAX=600 -a YOUR_HEROKU_APP
heroku config:set MONGODB_URI="YOUR_MONGODB_ATLAS_URI" -a YOUR_HEROKU_APP
heroku config:set FRONTEND_URL="https://YOUR_HEROKU_APP.herokuapp.com" -a YOUR_HEROKU_APP
heroku config:set ADMIN_URL="https://YOUR_HEROKU_APP.herokuapp.com" -a YOUR_HEROKU_APP
```

Set admin seed vars:

```powershell
heroku config:set ADMIN_EMAIL="owner@yourdomain.com" -a YOUR_HEROKU_APP
heroku config:set ADMIN_PASSWORD="YOUR_STRONG_ADMIN_PASSWORD" -a YOUR_HEROKU_APP
heroku config:set ADMIN_NAME="Sunny Admin" -a YOUR_HEROKU_APP
```

Set Razorpay test vars first:

```powershell
heroku config:set RAZORPAY_KEY_ID="rzp_test_..." -a YOUR_HEROKU_APP
heroku config:set RAZORPAY_KEY_SECRET="YOUR_RAZORPAY_TEST_SECRET" -a YOUR_HEROKU_APP
heroku config:set RAZORPAY_WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET" -a YOUR_HEROKU_APP
```

Set email vars if ready:

```powershell
heroku config:set EMAIL_HOST="smtp.sendgrid.net" -a YOUR_HEROKU_APP
heroku config:set EMAIL_PORT=587 -a YOUR_HEROKU_APP
heroku config:set EMAIL_SECURE=false -a YOUR_HEROKU_APP
heroku config:set EMAIL_USER="apikey" -a YOUR_HEROKU_APP
heroku config:set EMAIL_PASSWORD="YOUR_SENDGRID_API_KEY" -a YOUR_HEROKU_APP
heroku config:set EMAIL_FROM="Sunny Furniture <orders@yourdomain.com>" -a YOUR_HEROKU_APP
```

Set Cloudinary vars if ready:

```powershell
heroku config:set CLOUDINARY_CLOUD_NAME="YOUR_CLOUD_NAME" -a YOUR_HEROKU_APP
heroku config:set CLOUDINARY_API_KEY="YOUR_CLOUDINARY_API_KEY" -a YOUR_HEROKU_APP
heroku config:set CLOUDINARY_API_SECRET="YOUR_CLOUDINARY_API_SECRET" -a YOUR_HEROKU_APP
```

Set store rule vars:

```powershell
heroku config:set FREE_DELIVERY_THRESHOLD_PAISE=1500000 -a YOUR_HEROKU_APP
heroku config:set DELIVERY_FEE_PAISE=0 -a YOUR_HEROKU_APP
heroku config:set SEED_DEFAULT_STOCK=12 -a YOUR_HEROKU_APP
```

Check config names without revealing values in public:

```powershell
heroku config -a YOUR_HEROKU_APP
```

### Deploy

Run tests/build locally first:

```powershell
npm test
npm run admin:build
```

Commit your code after repository hygiene is clean:

```powershell
git status --short
git add .
git commit -m "Prepare Sunny Furniture production deployment"
```

Push to Heroku:

```powershell
git push heroku HEAD:main
```

Watch logs:

```powershell
heroku logs --tail -a YOUR_HEROKU_APP
```

## 14. Seed Production Database

Run this once after the first successful deploy:

```powershell
heroku run npm run seed -a YOUR_HEROKU_APP
```

This seeds:

- Products parsed from existing storefront HTML.
- `WELCOME10` coupon.
- Admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

After seed, open:

```text
https://YOUR_HEROKU_APP.herokuapp.com
https://YOUR_HEROKU_APP.herokuapp.com/admin/
https://YOUR_HEROKU_APP.herokuapp.com/api/health
```

## 15. Production Smoke Test

Do this on the deployed URL before sharing the site publicly.

### Public Storefront

- Home page loads.
- CSS loads.
- Product images load.
- Category pages load.
- Product modal opens.
- Search works.
- Cart drawer opens.
- Add to cart works.
- Quantity update works.
- Remove item works.
- Coupon `WELCOME10` works.
- COD checkout creates order.
- Success screen shows real order number.
- Track order works with order number plus email/phone.

### Admin

- `/admin/` loads.
- Admin login works.
- Dashboard metrics load.
- Product list loads.
- Product price update works.
- Product stock update works.
- Featured toggle works.
- Order list loads.
- Order status update works.
- Coupon list/create works.
- Image upload works if Cloudinary is configured.

### API

Check:

```text
https://YOUR_HEROKU_APP.herokuapp.com/api/health
https://YOUR_HEROKU_APP.herokuapp.com/api/products?limit=3
```

Both should return JSON.

### Razorpay Test Mode

- Checkout with Razorpay test mode.
- Complete test payment.
- Confirm success UI.
- Confirm order payment status in admin.
- Confirm Razorpay dashboard has the test payment.
- Confirm webhook delivery success in Razorpay dashboard.

### Email

- Place COD order using your own email.
- Confirm order confirmation email arrives.
- Change order status in admin.
- Confirm status email arrives.

## 16. Custom Domain And URLs

Do this after the Heroku URL works.

1. Choose final domain, for example:

```text
https://www.sunnyfurniture.in
```

2. Add the domain in Heroku.
3. Update DNS records at your domain provider using the Heroku DNS target.
4. Wait for DNS propagation.
5. Confirm HTTPS works.
6. Update Heroku config vars:

```powershell
heroku config:set FRONTEND_URL="https://www.sunnyfurniture.in" -a YOUR_HEROKU_APP
heroku config:set ADMIN_URL="https://www.sunnyfurniture.in" -a YOUR_HEROKU_APP
```

7. Update Razorpay webhook URL:

```text
https://www.sunnyfurniture.in/api/payments/webhook
```

8. Update Razorpay business website details if required.
9. Test site again using the custom domain, not the Heroku domain.

## 17. Go-Live Sequence

Use this exact order:

1. Local demo tested.
2. Atlas database created.
3. Heroku app created.
4. Production config vars set.
5. App deployed.
6. Production seed completed.
7. Heroku URL smoke test passed.
8. COD checkout passed on deployed URL.
9. Admin passed on deployed URL.
10. SendGrid email passed if emails are part of launch.
11. Cloudinary upload passed if admin uploads are part of launch.
12. Razorpay test payment passed on deployed URL.
13. Custom domain connected.
14. Custom domain smoke test passed.
15. Razorpay webhook updated to custom domain.
16. Razorpay live account verification completed.
17. Razorpay live keys configured.
18. One small real payment tested.
19. Payment appears in Razorpay dashboard.
20. Order appears as paid in admin.
21. Public launch.

## 18. Minimum Launch Choices

### COD-Only Soft Launch

You can launch quietly with only:

- Heroku
- MongoDB Atlas
- Strong JWT secret
- Secure admin credentials
- Production CSRF
- Production URL config
- COD checkout tested

In this mode, do not advertise online payment until Razorpay test/live setup is complete.

### Full Public Launch

For public customer traffic, complete:

- All COD checks.
- Razorpay test and live checks.
- Email sending.
- Cloudinary image upload.
- Custom domain HTTPS.
- Legal/policy pages reviewed.
- Admin order management tested.

## 19. Known Project Risks Before Serious Traffic

These are not blockers for a controlled MVP launch, but they are important before paid traffic or large customer volume:

- Storefront product grids are still mostly static HTML.
- Legacy localStorage cart/wishlist code still exists behind the API bridge.
- Playwright frontend acceptance tests are not added yet.
- Customer profile/order history UI is not complete.
- Password reset flow is backend-stubbed but not fully polished.
- Reviews backend exists but storefront review UI is not polished.
- Production logging/monitoring is not installed.
- Database backup automation is not configured.
- Refund flow is not deeply integrated in admin.
- GST invoices are not implemented.
- Shipping/courier API integration is not implemented.

Recommended before heavy launch:

- Add Playwright tests for cart, checkout, order tracking, and admin.
- Add production error monitoring.
- Turn on MongoDB Atlas backup/alerts.
- Add a simple operational dashboard for payment/webhook failures.
- Review all policy pages with a real business/legal lens.

## 20. Operations After Launch

Daily for the first week:

- Check Heroku logs.
- Check Razorpay payments and webhook failures.
- Check MongoDB Atlas usage.
- Check email delivery/spam.
- Check Cloudinary usage.
- Review new orders in admin.

Weekly:

- Export/order backup if needed.
- Review low-stock products.
- Review failed payments.
- Review abandoned carts if analytics are added.
- Rotate team access for people who no longer need admin.

Monthly:

- Rotate sensitive API keys where practical.
- Review database backups.
- Review dependency updates.
- Review security settings and admin users.

Useful commands:

```powershell
heroku logs --tail -a YOUR_HEROKU_APP
heroku ps -a YOUR_HEROKU_APP
heroku releases -a YOUR_HEROKU_APP
heroku config -a YOUR_HEROKU_APP
```

Rollback if a deploy breaks:

```powershell
heroku releases -a YOUR_HEROKU_APP
heroku rollback v123 -a YOUR_HEROKU_APP
```

Replace `v123` with the last known good release number.

## 21. Final Pre-Launch Checklist

Do not launch publicly until every required item is checked:

- [ ] `.gitignore` ignores dependency folders, logs, and real env files.
- [ ] No real secrets are committed.
- [ ] `npm test` passes.
- [ ] `npm run admin:build` passes.
- [ ] Heroku app boots successfully.
- [ ] `/api/health` returns success.
- [ ] Products are seeded.
- [ ] Admin user can log in.
- [ ] Default admin password is not used.
- [ ] COD order works.
- [ ] Track order works.
- [ ] Admin order update works.
- [ ] MongoDB Atlas backups/alerts are considered.
- [ ] Razorpay test payment works if online payment is enabled.
- [ ] Razorpay webhook succeeds.
- [ ] Live Razorpay keys are used only after test mode passes.
- [ ] Email sender is verified.
- [ ] Email order confirmation works if emails are enabled.
- [ ] Cloudinary upload works if admin uploads are enabled.
- [ ] Custom domain HTTPS works.
- [ ] `FRONTEND_URL` and `ADMIN_URL` match the final HTTPS domain.
- [ ] Razorpay webhook URL matches the final HTTPS domain.
- [ ] Privacy, refund, delivery, contact, and terms pages are reviewed.

## 22. One-Line Deployment Memory

Deploy order:

```text
Clean repo -> Atlas -> Heroku config vars -> Deploy -> Seed -> Smoke test COD/Admin -> Razorpay test -> Custom domain -> Razorpay live -> Small real payment -> Launch
```
