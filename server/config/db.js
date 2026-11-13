const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

let isConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });

    isConnected = true;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    isConnected = false;
    logger.warn(`MongoDB Connection Warning: ${error.message}`);
    logger.warn('Running with degraded database features. Reconnection will be attempted periodically.');
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('Mongoose event: connected to DB');
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    logger.warn(`Mongoose connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('Mongoose disconnected from DB');
  });
};

const getDBStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null
  };
};

module.exports = {
  connectDB,
  getDBStatus
};

