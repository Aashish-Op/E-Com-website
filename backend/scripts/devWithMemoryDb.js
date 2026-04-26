const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDatabase = require('../config/database');
const { seedCatalog } = require('./seedCatalog');

let memoryServer;

async function main() {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_memory_secret_change_me';
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sunnyfurniture.com';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

  await connectDatabase(process.env.MONGODB_URI);
  const count = await seedCatalog();
  await mongoose.disconnect();

  console.log(`Memory MongoDB ready. Seeded ${count} products.`);
  require('../server').start();
}

process.on('SIGINT', async () => {
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) await memoryServer.stop();
  process.exit(0);
});

main().catch(async err => {
  console.error(err);
  if (memoryServer) await memoryServer.stop();
  process.exit(1);
});
