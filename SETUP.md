# Sunny Furniture - Setup Guide

This guide explains how to set up and run the Sunny Furniture e-commerce application on your local machine.

## Prerequisites

Before you start, make sure you have installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MongoDB Compass** (optional, for database visualization) - [Download](https://www.mongodb.com/products/compass)
- **Git** - [Download](https://git-scm.com/)

Check your versions:
```powershell
node --version
npm --version
git --version
```

## Project Structure

```
project/
├── backend/                 # Express.js API server
│   ├── config/             # Database and service configs
│   ├── models/             # MongoDB schemas (User, Product, Order, etc.)
│   ├── routes/             # API endpoints (auth, products, orders, etc.)
│   ├── middleware/         # Authentication, error handling, CSRF
│   ├── services/           # Business logic (payments, emails, uploads)
│   ├── scripts/            # Seed and utility scripts
│   ├── server.js           # Main server entry point
│   ├── package.json        # Backend dependencies
│   └── .env                # Environment variables (DO NOT COMMIT)
├── admin/                  # React admin dashboard
│   ├── src/
│   ├── package.json
│   └── dist/              # Built admin app (generated)
├── src/                   # Static storefront
│   ├── pages/            # HTML pages
│   ├── styles/           # CSS files
│   ├── scripts/          # JavaScript files
│   └── assets/           # Images and media
└── package.json          # Root package.json
```

## Installation Steps

### 1. Clone the Repository
```powershell
git clone https://github.com/your-username/sunny-furniture.git
cd sunny-furniture
```

### 2. Install Root Dependencies
```powershell
npm install
```

### 3. Install Backend Dependencies
```powershell
cd backend
npm install
cd ..
```

### 4. Install Admin Dashboard Dependencies
```powershell
cd admin
npm install
cd ..
```

## Environment Setup

### 1. Create Backend Environment File

Copy the `.env.example` to `.env`:
```powershell
copy backend\.env.example backend\.env
```

### 2. Configure `.env` File

Edit `backend/.env` and set up your configuration:

```dotenv
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sunny-furniture?retryWrites=true&w=majority

# Server Configuration
PORT=5000
NODE_ENV=development
RATE_LIMIT_MAX=600

# JWT Configuration
JWT_SECRET=your-generated-secret-key
JWT_EXPIRE=7d
CSRF_STRICT=false

# Admin Credentials (for initial setup)
ADMIN_EMAIL=admin@sunnyfurniture.com
ADMIN_PASSWORD=Admin@123
ADMIN_NAME=Sunny Admin

# Razorpay Configuration (Payment Gateway)
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=xxxx

# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@sunnyfurniture.com

# Cloudinary Configuration (Image Storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Store Rules
FREE_DELIVERY_THRESHOLD_PAISE=1500000
DELIVERY_FEE_PAISE=0
SEED_DEFAULT_STOCK=12

# Frontend URLs (for CORS)
FRONTEND_URL=http://localhost:5000
ADMIN_URL=http://localhost:3001
```

## Setting Up MongoDB Atlas

1. **Sign up** at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Create a cluster** in your preferred region
3. **Create a database user** with `readWrite` permissions
4. **Whitelist your IP** in Network Access
5. **Get your connection string** and add it to `.env` as `MONGODB_URI`

Example MongoDB URI:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sunny-furniture?retryWrites=true&w=majority
```

## Database Seeding

The first time you run the app, seed the database with products and admin user:

```powershell
cd backend
node scripts/seedCatalog.js
```

This will:
- ✅ Create 96 furniture products
- ✅ Add WELCOME10 coupon (10% discount)
- ✅ Create admin user with credentials from `.env`

## Running the Application

### Option 1: Run Everything (Recommended)

In the root directory:

```powershell
npm start
```

This will start:
- **Backend API** on `http://localhost:5000`
- **Admin Dashboard** on `http://localhost:3001` (built version)
- **Storefront** on `http://localhost:5000`

### Option 2: Run Components Separately

**Terminal 1 - Start Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Start Admin Dashboard (Development):**
```powershell
cd admin
npm run dev
```

The storefront is served by the backend at `http://localhost:5000`.

## Testing the Application

### 1. Access the Storefront
```
http://localhost:5000
```
Browse products, add to cart, test checkout (COD or Razorpay test keys).

### 2. Access the Admin Dashboard
```
http://localhost:5000/admin
```
(or `http://localhost:3001` if running separately)

**Credentials:**
- Email: `admin@sunnyfurniture.com`
- Password: `Admin@123`

### 3. Login Actions
- View products, orders, and customers
- Manage inventory
- Create and manage coupons
- Upload product images to Cloudinary

### 4. Verify MongoDB Connection
Open **MongoDB Compass** and connect to your MongoDB Atlas cluster to view:
- **Databases:** `sunny-furniture`
- **Collections:** products, users, orders, carts, coupons, etc.

## Fixing the Admin User

If you can't log in, recreate the admin user:

```powershell
cd backend
node scripts/fixAdminUser.js
```

This will delete the old admin user and create a fresh one with credentials from `.env`.

## Available Scripts

```powershell
# Root level
npm start              # Start the full application
npm run seed           # Run database seed

# Backend
cd backend
npm start              # Start production server
npm run dev            # Start with nodemon (development)
npm test               # Run tests (if configured)

# Admin
cd admin
npm run dev            # Start Vite development server
npm run build          # Build for production
npm run preview        # Preview production build
```

## Troubleshooting

### MongoDB Connection Error
- ✅ Check your MongoDB URI in `.env`
- ✅ Verify cluster is active in MongoDB Atlas
- ✅ Check IP whitelist in Network Access
- ✅ Ensure database name is `sunny-furniture`

### Login Fails
- ✅ Run `node scripts/fixAdminUser.js` in backend
- ✅ Check browser console (F12) for errors
- ✅ Verify `.env` credentials match

### Ports Already in Use
- ✅ Change PORT in `.env` (default: 5000)
- ✅ Kill process: `netstat -ano | findstr :5000` then `taskkill /PID xxxx`

### Admin Dashboard Not Loading
- ✅ Run `npm run build` in `admin` folder
- ✅ Check if `admin/dist/` folder exists
- ✅ Restart backend server

### Products Not Showing
- ✅ Run `npm run seed` from root directory
- ✅ Verify products in MongoDB Compass
- ✅ Check backend logs for errors

## Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| MONGODB_URI | Database connection string | mongodb+srv://user:pass@cluster.mongodb.net/db |
| JWT_SECRET | Signs authentication tokens | Long random string (keep secret!) |
| RAZORPAY_* | Payment gateway credentials | Get from Razorpay dashboard |
| EMAIL_* | Email sending configuration | SendGrid SMTP details |
| CLOUDINARY_* | Image upload service | Get from Cloudinary dashboard |
| ADMIN_* | Initial admin user setup | Used during seed |

## Security Notes

⚠️ **IMPORTANT:**
- ✅ Never commit `.env` files to Git (use `.gitignore`)
- ✅ Use strong passwords in production
- ✅ Keep JWT_SECRET safe
- ✅ Enable CSRF_STRICT=true before production
- ✅ Use Razorpay live keys (not test) in production
- ✅ Store credentials in password manager, not in code

## Production Deployment

For deployment to Heroku or other platforms:
1. Set all environment variables in hosting provider's config vars
2. Change NODE_ENV to `production`
3. Use `npm start` (not development mode)
4. Enable CSRF_STRICT=true
5. Use real Razorpay keys
6. Configure email service (SendGrid, etc.)

See `PRODUCTION_DEPLOYMENT_PLAN.md` for detailed deployment steps.

## Getting Help

- Check server logs: Look at terminal output for errors
- Check browser console: Press F12 in browser
- Check MongoDB Compass: Verify data is being saved
- Read error messages carefully - they often suggest the fix

## Next Steps

1. ✅ Set up MongoDB Atlas
2. ✅ Configure `.env` file
3. ✅ Run `npm install` in all directories
4. ✅ Run `npm run seed`
5. ✅ Run `npm start`
6. ✅ Test storefront and admin dashboard
7. ✅ Start developing!

---

Happy coding! 🚀
