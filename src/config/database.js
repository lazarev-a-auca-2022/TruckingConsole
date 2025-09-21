const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trucking_permits';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    // Don't throw error in console mode - allow app to work without DB
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Running without database in production mode');
    }
  }
}

module.exports = { connectDatabase };
