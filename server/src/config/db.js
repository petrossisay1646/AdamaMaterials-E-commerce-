const mongoose = require('mongoose');
const seedData = require('../jobs/seed');

const connectDB = async () => {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/managed-marketplace';

  try {
    console.log(`Connecting to primary MongoDB URI: ${dbUri}... 💾`);
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to primary MongoDB server successfully! 🚀');

    // If primary DB lacks map places or initial data, safely seed
    try {
      const MapPlace = require('../models/MapPlace');
      const count = await MapPlace.countDocuments();
      if (count === 0) {
        console.log('🌱 Primary database has 0 map places. Performing safe initial seed...');
        await seedData(false);
      }
    } catch (seedErr) {
      console.warn('Auto-seed check note:', seedErr.message);
    }
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
