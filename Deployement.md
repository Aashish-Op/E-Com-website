# Sunny Furniture One-Hour Production Go-Live Guide

Last updated: 2026-04-26

This guide is the practical deployment runbook for the current project. It is written for a fast client handoff, not for a perfect enterprise rollout.

## 0. What This Project Needs In Production

Current project shape:

- One Node/Express app starts from `npm start`.
- Express serves the static storefront from `src/`.
- Express serves the React admin dashboard from `admin/dist` at `/admin`.
- API runs under `/api`.
- Database is MongoDB Atlas through `MONGODB_URI`.
- Payments are Razorpay.
- Email is Nodemailer/SendGrid SMTP.
- Product/admin uploads use Cloudinary.
- Current root `package.json` uses Node `24.x`.
- Current root `Procfile` is `web: npm start`.
- Added `Buildfile` builds the admin dashboard for AWS Elastic Beanstalk.

Important URLs after deployment:

```text
https://YOUR_DOMAIN/
https://YOUR_DOMAIN/admin/
https://YOUR_DOMAIN/api/health
https://YOUR_DOMAIN/api/payments/webhook
```

## 1. Fast Decision

Use this decision table before spending time.

| Choice | Use when | Time fit | My recommendation |
| --- | --- | --- | --- |
| Render Web Service | You want the simplest one-service Node deployment with HTTPS quickly | Best for 1 hour | Best default for instant go-live |
| Heroku | You already have Heroku CLI/account/payment ready | Good for 1 hour | Also good because repo already has `Procfile` and `heroku-postbuild` |
| Railway | You already use Railway or want very quick GitHub deploy/env vars | Good for 1 hour | Good fallback |
| AWS Elastic Beanstalk | Client specifically wants AWS | Possible, but slower | Best AWS option for this codebase |
| AWS App Runner | Existing AWS App Runner customer only | Risky for new projects | Avoid for a fresh client because AWS says App Runner closes to new customers on 2026-04-30 |
| Vercel/Netlify/Amplify Hosting only | Static frontend only | Not suitable alone | Avoid unless you split frontend/backend |
| EC2/Lightsail VPS | You want manual server control | Not safe in 1 hour | Avoid today unless you already have Nginx/PM2/SSL ready |

Recommended launch path:

```text
Render + MongoDB Atlas + Cloudinary + SendGrid + Razorpay
```

AWS path if required:

```text
AWS Elastic Beanstalk Node.js 24 AL2023 + MongoDB Atlas + Route 53/custom domain + ACM HTTPS certificate
```

## 2. Hard Stop Security Before Deploy

Your local `backend/.env` has real-looking values and a weak/default admin password. Treat every value that appeared in `.env` or `.env.example` as exposed if this folder was shared, zipped, pushed, screenshotted, or sent anywhere.

Do these before public launch:

1. Rotate the MongoDB Atlas database user password.
2. Rotate the Cloudinary API secret if it was real.
3. Rotate Razorpay test/live keys if they were real.
4. Generate a fresh `JWT_SECRET`.
5. Generate a fresh `RAZORPAY_WEBHOOK_SECRET`.
6. Change `ADMIN_PASSWORD` to a strong unique password.
7. Never commit `backend/.env`.
8. Store final credentials in the hosting provider env vars and a password manager.

Generate secrets locally:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the first for `JWT_SECRET`, the second for `RAZORPAY_WEBHOOK_SECRET`.

I already patched:

- `.gitignore` to ignore `.env` files.
- `backend/.env.example` to remove real-looking secrets.
- `backend/services/paymentService.js` so production Razorpay cannot silently use fake test verification when credentials are missing.
- `Buildfile` so Elastic Beanstalk can build the admin dashboard.

## 3. One-Hour Timeline

Use this order.

| Time | Work |
| --- | --- |
| 0-10 min | Rotate secrets, set strong admin password, confirm repo does not contain secrets |
| 10-20 min | Create/confirm MongoDB Atlas database user and connection string |
| 20-35 min | Deploy app to Render, Heroku, Railway, or AWS Elastic Beanstalk |
| 35-42 min | Set final environment variables and redeploy/restart |
| 42-48 min | Seed production database once |
| 48-55 min | Smoke test storefront, admin, COD checkout, order tracking |
| 55-60 min | Configure Razorpay webhook/test payment if ready, then share client URL |

Custom domain DNS may take longer than one hour. If DNS is slow, give the client the platform HTTPS URL first, then switch to the custom domain after DNS is active.

## 4. Local Preflight

Run from project root:

```powershell
cd C:\Users\ashis\minorproject\project---Copy
git status --short --untracked-files=all
npm test
npm run admin:build
```

Check for known secret patterns in tracked files:

```powershell
git grep -n -E "mongodb\+srv://.*:.*@|rzp_(test|live)_[A-Za-z0-9]+|RAZORPAY_KEY_SECRET=.+|CLOUDINARY_API_SECRET=.+|JWT_SECRET=.+|ADMIN_PASSWORD=Admin@123" -- . ":(exclude)backend/.env.example" ":(exclude)SETUP.md" ":(exclude)PRODUCTION_DEPLOYMENT_PLAN.md" ":(exclude)ONE_HOUR_PRODUCTION_GO_LIVE_GUIDE.md"
```

If this prints real secrets, stop and remove/rotate them.

## 5. Production Environment Variables

Do not set `PORT` on managed platforms unless the platform explicitly asks. This app already uses `process.env.PORT`.

Paste these into your hosting provider with real values:

```dotenv
NODE_ENV=production
CSRF_STRICT=true
RATE_LIMIT_MAX=600

MONGODB_URI=mongodb+srv://sunny_app:YOUR_URL_ENCODED_PASSWORD@cluster0.xxxxx.mongodb.net/sunny-furniture?retryWrites=true&w=majority

JWT_SECRET=YOUR_64_BYTE_RANDOM_HEX
JWT_EXPIRE=7d

ADMIN_EMAIL=owner@clientdomain.com
ADMIN_PASSWORD=YOUR_STRONG_ADMIN_PASSWORD
ADMIN_NAME=Sunny Admin

RAZORPAY_KEY_ID=rzp_test_OR_rzp_live_xxxxx
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET

EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_SERVICE=
EMAIL_USER=apikey
EMAIL_PASSWORD=YOUR_SENDGRID_API_KEY
EMAIL_FROM=Sunny Furniture <orders@clientdomain.com>

CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET

FREE_DELIVERY_THRESHOLD_PAISE=1500000
DELIVERY_FEE_PAISE=0
SEED_DEFAULT_STOCK=12

FRONTEND_URL=https://YOUR_FINAL_DOMAIN_OR_PLATFORM_URL
ADMIN_URL=https://YOUR_FINAL_DOMAIN_OR_PLATFORM_URL
```

Notes:

- `NODE_ENV` must be `production`.
- `CSRF_STRICT` should be `true`.
- `FRONTEND_URL` and `ADMIN_URL` should usually be the same deployed origin because this app serves storefront, API, and admin from one Express server.
- For Razorpay, use test keys first. Switch to live keys only after the deployed test payment works.
- If Razorpay is not approved/live yet, do a COD-only soft launch and do not advertise online payments.

## 6. MongoDB Atlas Setup

Where: MongoDB Atlas dashboard.

Why: Orders, products, carts, coupons, users, and admin login must persist outside your laptop.

Steps:

1. Create or open the Atlas project.
2. Create a cluster in a region close to customers and hosting. For India customers, choose a nearby region if available.
3. Go to `Database Access`.
4. Create a database user like `sunny_app`.
5. Give only `readWrite` access to the `sunny-furniture` database.
6. Use a strong generated password.
7. Go to `Network Access`.
8. For fastest managed-host deployment, temporarily allow `0.0.0.0/0`.
9. This is broad network access, so compensate with a strong database password and least privilege.
10. Copy the Node.js connection string.
11. Put database name `sunny-furniture` in the URI.
12. URL-encode special characters in the password.

Final shape:

```text
mongodb+srv://sunny_app:YOUR_URL_ENCODED_PASSWORD@cluster0.xxxxx.mongodb.net/sunny-furniture?retryWrites=true&w=majority
```

## 7. Recommended Path: Render

Use this if you want the highest chance of going live in one hour.

Where: Render dashboard, New > Web Service.

Why: It can host this whole Express app as one service, gives an HTTPS `onrender.com` URL, supports env vars, and supports custom domains.

Steps:

1. Push the project to a private GitHub repository.
2. In Render, create `New` > `Web Service`.
3. Connect the GitHub repo.
4. Root directory: leave blank or use `.`.
5. Runtime/language: Node.
6. Build command:

```text
npm install && npm run admin:install && npm run admin:build
```

7. Start command:

```text
npm start
```

8. Set `NODE_VERSION=24.14.1` if Render does not pick Node from `package.json`.
9. Add all production env vars from section 5.
10. Create/deploy the service.
11. Wait for the `onrender.com` URL.
12. Update `FRONTEND_URL` and `ADMIN_URL` to that exact URL.
13. Redeploy or restart.
14. Open:

```text
https://YOUR_SERVICE.onrender.com/api/health
https://YOUR_SERVICE.onrender.com/
https://YOUR_SERVICE.onrender.com/admin/
```

Production seed on Render:

Fastest reliable method is local seeding against the production Atlas URI:

1. Temporarily set local `backend/.env` to the production `MONGODB_URI`, `ADMIN_EMAIL`, and strong `ADMIN_PASSWORD`.
2. Run:

```powershell
npm run seed
```

3. Immediately restore local `.env` if needed.
4. Do not commit `.env`.

Only run seed once unless you intentionally want to update seeded products/coupon/admin password.

## 8. AWS Path: Elastic Beanstalk

Use this if the client specifically wants AWS.

Why this AWS service: Elastic Beanstalk can deploy a normal Node/Express app without rewriting it into Lambda/serverless. AWS currently supports Node.js 24 on Elastic Beanstalk AL2023.

Important AWS reality:

- AWS can take longer than Render/Heroku/Railway because IAM, regions, SSL, Route 53, and load balancers add setup.
- If you need Razorpay live payments/webhooks, you need a public HTTPS URL.
- Elastic Beanstalk's default environment URL is not the final production domain strategy. For real payment launch, use a custom domain and HTTPS certificate.

Recommended AWS settings:

```text
Region: ap-south-1 if most users are in India, or the client's preferred AWS region
Platform: Node.js 24 running on Amazon Linux 2023
Environment type: Load balanced if you need HTTPS on custom domain
Start process: Procfile already has web: npm start
Build process: Buildfile builds the admin dashboard
Database: MongoDB Atlas, not local MongoDB on EC2
```

Console ZIP deployment:

1. Commit your deploy-ready code.
2. From project root, create a clean ZIP from Git:

```powershell
git archive --format zip --output ..\sunny-furniture-eb.zip HEAD
```

3. AWS Console > Elastic Beanstalk > Create application.
4. Application name: `sunny-furniture`.
5. Environment: Web server environment.
6. Platform: Node.js.
7. Platform branch: Node.js 24 on Amazon Linux 2023.
8. Application code: upload `sunny-furniture-eb.zip`.
9. Configure service access/IAM using the AWS defaults if this is your first EB app.
10. Add environment properties from section 5.
11. Create environment.
12. Watch Events and Logs until health is OK.
13. Open:

```text
http://YOUR_ENV.elasticbeanstalk.com/api/health
```

HTTPS/custom domain on AWS:

1. Buy or use the domain in Route 53 or another DNS provider.
2. Request an ACM certificate for `www.clientdomain.com` in the same region as the load balancer.
3. Validate the certificate with DNS records.
4. In Elastic Beanstalk, configure the load balancer HTTPS listener on port 443 with the ACM certificate.
5. Point DNS `www` to the Elastic Beanstalk load balancer/target.
6. Update env vars:

```text
FRONTEND_URL=https://www.clientdomain.com
ADMIN_URL=https://www.clientdomain.com
```

7. Update Razorpay webhook to:

```text
https://www.clientdomain.com/api/payments/webhook
```

Production seed on AWS:

Use local seeding against production Atlas, same as Render:

```powershell
npm run seed
```

Do this only after local `backend/.env` points to the production Atlas URI and final admin credentials.

AWS fallback:

If Elastic Beanstalk setup is taking too long, deploy to Render/Heroku first for the client launch, then migrate to AWS after the handoff. That is much safer than rushing a half-configured HTTPS/payment setup.

## 9. Heroku Path

Use this if you already have Heroku CLI and billing/account ready.

Why: This repo already has a `Procfile`, and `heroku-postbuild` builds the admin dashboard.

Steps:

```powershell
heroku login
heroku create YOUR_HEROKU_APP
```

Set env vars:

```powershell
heroku config:set NODE_ENV=production -a YOUR_HEROKU_APP
heroku config:set CSRF_STRICT=true -a YOUR_HEROKU_APP
heroku config:set RATE_LIMIT_MAX=600 -a YOUR_HEROKU_APP
heroku config:set MONGODB_URI="YOUR_ATLAS_URI" -a YOUR_HEROKU_APP
heroku config:set JWT_SECRET="YOUR_LONG_RANDOM_SECRET" -a YOUR_HEROKU_APP
heroku config:set JWT_EXPIRE=7d -a YOUR_HEROKU_APP
heroku config:set ADMIN_EMAIL="owner@clientdomain.com" -a YOUR_HEROKU_APP
heroku config:set ADMIN_PASSWORD="YOUR_STRONG_ADMIN_PASSWORD" -a YOUR_HEROKU_APP
heroku config:set ADMIN_NAME="Sunny Admin" -a YOUR_HEROKU_APP
heroku config:set FRONTEND_URL="https://YOUR_HEROKU_APP.herokuapp.com" -a YOUR_HEROKU_APP
heroku config:set ADMIN_URL="https://YOUR_HEROKU_APP.herokuapp.com" -a YOUR_HEROKU_APP
```

Set Razorpay, email, Cloudinary, and store vars the same way.

Deploy:

```powershell
git push heroku HEAD:main
heroku logs --tail -a YOUR_HEROKU_APP
```

Seed:

```powershell
heroku run npm run seed -a YOUR_HEROKU_APP
```

Open:

```text
https://YOUR_HEROKU_APP.herokuapp.com/api/health
https://YOUR_HEROKU_APP.herokuapp.com/
https://YOUR_HEROKU_APP.herokuapp.com/admin/
```

## 10. Railway Path

Use this if Render or Heroku is blocked and you want another quick managed platform.

Where: Railway dashboard.

Steps:

1. New Project > Deploy from GitHub repo.
2. Select this repo.
3. Set build command:

```text
npm install && npm run admin:install && npm run admin:build
```

4. Set start command:

```text
npm start
```

5. Add all env vars from section 5.
6. Deploy.
7. Generate/open the Railway public domain.
8. Update `FRONTEND_URL` and `ADMIN_URL` to the Railway HTTPS URL.
9. Redeploy.
10. Seed production Atlas locally with `npm run seed`.
11. Smoke test the same URLs.

## 11. Razorpay Production Setup

Where: Razorpay Dashboard.

Do not switch to live keys first. Use test mode on the deployed URL.

Test mode:

1. Razorpay Dashboard > Test Mode.
2. Generate API keys.
3. Set:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

4. Deploy/restart.
5. Add webhook:

```text
https://YOUR_DOMAIN_OR_PLATFORM_URL/api/payments/webhook
```

6. Select at least:

```text
payment.authorized
payment.captured
payment.failed
```

7. Place a test Razorpay order on the deployed site.
8. Confirm:

- Customer success screen appears.
- Order appears in admin.
- Payment status becomes paid.
- Razorpay Dashboard shows webhook delivery success.

Live mode:

Only switch to live after:

- COD works.
- Razorpay test works.
- Webhook delivery works.
- Razorpay KYC/account activation is complete.
- Privacy, refund, delivery, terms, and contact pages are correct.
- Final HTTPS domain works.

Then:

1. Switch Razorpay Dashboard to Live Mode.
2. Generate live keys.
3. Replace env vars with live keys.
4. Create/update the live webhook URL.
5. Place one small real payment.
6. Confirm paid order in admin and payment in Razorpay Dashboard.

## 12. SendGrid Email Setup

Where: SendGrid/Twilio dashboard.

Why: Customers should receive order/status emails.

Steps:

1. Verify sender identity or authenticate the client's domain.
2. Create an API key with mail send permission.
3. Set:

```text
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=YOUR_SENDGRID_API_KEY
EMAIL_FROM=Sunny Furniture <orders@clientdomain.com>
```

4. Place a deployed COD order using your own email.
5. Check inbox, spam, and promotions.
6. If deliverability is poor, finish SendGrid domain authentication DNS records.

## 13. Cloudinary Setup

Where: Cloudinary Console.

Why: Admin product image upload should not store large images in MongoDB.

Steps:

1. Copy cloud name, API key, API secret.
2. Set:

```text
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET
```

3. Deploy/restart.
4. Log in to `/admin/`.
5. Upload a product image.
6. Confirm the image URL is a Cloudinary URL.
7. Confirm the storefront displays it.

## 14. Custom Domain

Do this after the platform URL works.

Why: DNS can delay launch. First prove the app works on the provider URL.

Steps:

1. Decide final domain, for example:

```text
https://www.sunnyfurniture.in
```

2. Add the custom domain in your hosting provider.
3. Add DNS records at the domain provider.
4. Wait until HTTPS is active.
5. Update env vars:

```text
FRONTEND_URL=https://www.sunnyfurniture.in
ADMIN_URL=https://www.sunnyfurniture.in
```

6. Update Razorpay webhook:

```text
https://www.sunnyfurniture.in/api/payments/webhook
```

7. Test again on the custom domain.

## 15. Production Smoke Test

Public storefront:

- Home page loads.
- Category pages load.
- Product images load.
- Product modal opens.
- Search works.
- Add to cart works.
- Quantity update works.
- Coupon `WELCOME10` works.
- COD checkout creates an order.
- Track order works.

Admin:

- `/admin/` loads.
- Admin login works.
- Dashboard loads.
- Products load.
- Product price/stock update works.
- Featured toggle works.
- Orders load.
- Order status update works.
- Coupon create/list works.
- Cloudinary upload works if configured.

API:

```text
https://YOUR_DOMAIN/api/health
https://YOUR_DOMAIN/api/products?limit=3
```

Payments:

- Razorpay test checkout works.
- Razorpay webhook succeeds.
- Admin shows paid status.
- One small live payment works only after KYC/live mode is ready.

Email:

- COD order email arrives.
- Order status email arrives.

## 16. Client Handover

Give the client:

- Website URL.
- Admin URL: `https://YOUR_DOMAIN/admin/`.
- Admin email.
- Admin password through a password manager or secure channel, not normal chat.
- Razorpay account ownership/access.
- MongoDB Atlas ownership/access.
- Cloudinary ownership/access.
- SendGrid ownership/access.
- Domain registrar/DNS ownership/access.
- Short operations checklist.

Do not hand over:

- Raw `.env` file in chat.
- Secrets in a PDF/Markdown file.
- Your personal service accounts.

First-week operations:

- Check new orders daily.
- Check payment failures/webhook failures daily.
- Check hosting logs daily.
- Check email delivery/spam daily.
- Check Atlas usage and backups.
- Keep a manual backup/export habit until automated backups are confirmed.

## 17. If Something Breaks During The One Hour

Use this fallback order:

1. If AWS SSL/domain is slow, deploy Render/Heroku first and move to AWS later.
2. If Razorpay live is not approved, launch COD-only and finish Razorpay after KYC.
3. If SendGrid is not ready, launch with manual order follow-up, but tell the client emails are pending.
4. If custom domain DNS is slow, share the provider HTTPS URL immediately.
5. If admin build fails, rerun:

```powershell
npm run admin:install
npm run admin:build
```

6. If MongoDB connection fails, check Atlas Network Access, username/password, database name, and URL encoding.

## 18. Final Launch Checklist

- [ ] Real secrets are rotated.
- [ ] `backend/.env` is not committed.
- [ ] `.env.example` contains placeholders only.
- [ ] `npm test` passes.
- [ ] `npm run admin:build` passes.
- [ ] Hosting env vars are set.
- [ ] App boots.
- [ ] `/api/health` works.
- [ ] Production database seeded once.
- [ ] Admin login works with strong password.
- [ ] COD checkout works.
- [ ] Track order works.
- [ ] Admin order update works.
- [ ] Cloudinary upload works if enabled.
- [ ] SendGrid email works if enabled.
- [ ] Razorpay test payment works before live.
- [ ] Razorpay webhook succeeds.
- [ ] Custom domain HTTPS works.
- [ ] `FRONTEND_URL` and `ADMIN_URL` match the final HTTPS URL.
- [ ] Client has ownership/access for all production accounts.

## 19. Official Docs Checked

- Render Web Services: https://render.com/docs/web-services
- Render Node Express deploy: https://render.com/docs/deploy-node-express-app
- Render Node version: https://render.com/docs/node-version
- Heroku Node deploy/Procfile: https://devcenter.heroku.com/articles/getting-started-with-nodejs
- Heroku Node support: https://devcenter.heroku.com/articles/nodejs-support
- AWS Elastic Beanstalk Node platform: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs.container.html
- AWS Elastic Beanstalk supported platforms: https://docs.aws.amazon.com/elasticbeanstalk/latest/platforms/platforms-supported.html
- AWS Elastic Beanstalk Buildfile/Procfile: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/platforms-linux-extend.build-proc.html
- AWS App Runner source services and availability note: https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code.html
- AWS App Runner environment variables: https://docs.aws.amazon.com/apprunner/latest/dg/env-variable-manage.html
- MongoDB Atlas driver connection: https://www.mongodb.com/docs/atlas/driver-connection/
- Razorpay webhooks: https://razorpay.com/docs/webhooks/
- Razorpay webhook setup: https://razorpay.com/docs/payments/dashboard/account-settings/webhooks/
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
- SendGrid SMTP API: https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api
- Cloudinary Node quickstart: https://cloudinary.com/documentation/node_quickstart
