const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDatabase = require('../config/database');
const User = require('../models/User');

async function fixAdminUser() {
  try {
    await connectDatabase(process.env.MONGODB_URI);
    
    const email = process.env.ADMIN_EMAIL.toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Sunny Admin';
    
    console.log(`Fixing admin user: ${email}`);
    
    // Delete existing user first
    await User.deleteOne({ email });
    console.log('Deleted old admin user');
    
    // Hash password
    const passwordHash = await User.hashPassword(password);
    console.log('Password hashed');
    
    // Create new admin user
    const adminUser = new User({
      name,
      email,
      phone: '',
      role: 'admin',
      emailVerified: true,
      passwordHash,
      addresses: []
    });
    
    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixAdminUser();
