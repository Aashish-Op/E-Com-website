# Sunny Furniture E-Commerce Platform

A modern, full-stack e-commerce platform built with Node.js, React, and Vite for selling furniture products online.

## Features

- **Product Catalog**: Browse a wide variety of furniture items across multiple categories
- **Shopping Cart**: Add/remove items, manage quantities, and view cart summary
- **User Authentication**: Secure user registration and login with JWT tokens
- **Payment Integration**: Razorpay payment gateway for secure transactions
- **Order Management**: Track orders, view order history, and manage order details
- **Wishlist**: Save favorite items for later
- **Reviews & Ratings**: Customer reviews and product ratings
- **Admin Panel**: Manage products, orders, users, and coupons
- **Discount Coupons**: Apply coupon codes for discounts
- **Image Upload**: Cloudinary integration for product image management
- **Email Notifications**: Order confirmation and status update emails

## Project Structure

```
├── admin/              # Admin dashboard (React + Vite)
├── backend/            # Node.js backend server
│   ├── config/         # Database, Cloudinary, Razorpay configs
│   ├── middleware/     # Auth, CSRF, error handling
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── tests/          # Backend tests
│   └── utils/          # Helper functions
└── src/                # Frontend static pages and assets
    ├── pages/          # HTML pages
    ├── scripts/        # Frontend scripts
    └── styles/         # CSS stylesheets
```

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, React (Admin), Vite
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Payment**: Razorpay
- **Image Storage**: Cloudinary
- **Email**: Email service integration

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Aashish-Op/E-Com-website.git
cd E-Com-website
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install admin panel dependencies:
```bash
cd admin
npm install
```

4. Install frontend dependencies (if applicable):
```bash
npm install
```

## Configuration

Create a `.env` file in the backend directory with the following variables:

```
DATABASE_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
EMAIL_SERVICE=your_email_service
EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_password
```

## Running the Project

### Backend Server:
```bash
cd backend
npm start
```

### Admin Panel:
```bash
cd admin
npm run dev
```

### Production Deployment:
Follow the guidelines in `PRODUCTION_DEPLOYMENT_PLAN.md`

## API Routes

- **Authentication**: `/api/auth`
- **Products**: `/api/products`
- **Cart**: `/api/cart`
- **Orders**: `/api/orders`
- **Payments**: `/api/payments`
- **Wishlist**: `/api/wishlist`
- **Admin**: `/api/admin`

## Testing

Run backend tests:
```bash
cd backend
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, contact: [Your contact information]

## Project Documentation

- [Setup Guide](SETUP.md)
- [Production Deployment Plan](PRODUCTION_DEPLOYMENT_PLAN.md)
