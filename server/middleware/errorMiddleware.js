const logger = require('../utils/logger');
const { sendError } = require('../utils/responseHandler');

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global centralized error handler
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  logger.error(`[${req.method}] ${req.url} -> Error: ${err.message}`);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    logger.debug(err.stack);
  }

  // Handle specific known error types
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return sendError(res, 400, 'Validation Error', messages.join(', '));
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, 400, `Duplicate field value entered: ${field}`);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid authentication token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Authentication token expired');
  }

  return sendError(
    res,
    statusCode,
    err.message || 'Internal Server Error',
    process.env.NODE_ENV === 'production' ? null : err.stack
  );
};

module.exports = {
  notFoundHandler,
  errorHandler
};

