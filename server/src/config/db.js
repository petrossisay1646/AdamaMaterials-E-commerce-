const mongoose = require('mongoose');
const seedData = require('../jobs/seed');

const connectDB = async () => {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/managed-marketplace';

  try {
    console.log(`Connecting to primary MongoDB URI: ${dbUri}... 💾`);
    // Connect with a shorter timeout (3 seconds) to fail quickly if service is not running
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('Connected to primary MongoDB server successfully! 🚀');
  } catch (error) {
    console.warn('⚠️ Primary MongoDB connection failed. Reason:', error.message);
    console.log('🔄 Fallback: Initializing development-only in-memory MongoDB database... 🔌');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const memoryUri = mongoServer.getUri();

      console.log(`Memory MongoDB Server started at: ${memoryUri}`);
      await mongoose.connect(memoryUri);
      console.log('Connected to in-memory MongoDB server successfully! 🚀');

      // Programmatically seed data
      console.log('🌱 Programmatically seeding mock database with demo accounts & materials...');
      await seedData(true);
      console.log('🎉 Seeding completed in memory database! System is ready to test.');
    } catch (memError) {
      console.error('💥 Failed to start in-memory MongoDB server:', memError);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
