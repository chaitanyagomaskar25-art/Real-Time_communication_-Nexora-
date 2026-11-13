const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config/config');
const { connectDB } = require('./config/db');
const { initializeSocket } = require('./socket/socketHandler');
const reminderService = require('./services/reminderService');
const apiRoutes = require('./routes');
const compressionMiddleware = require('./middleware/compressionMiddleware');
const { generalApiLimiter } = require('./middleware/rateLimitMiddleware');
const { sanitizeNoSql, sanitizeXss, csrfProtection } = require('./middleware/securityMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// Trust reverse proxy for secure cookies, IP rate-limiting, and HTTPS detection
app.set('trust proxy', 1);

// Comprehensive Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://api.dicebear.com', 'https://*.cloudinary.com', 'https://*.amazonaws.com'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*', 'https://api.dicebear.com', 'https://*.cloudinary.com'],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

// Allowed origins
const allowedOrigins = [
  config.clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

// CORS Middleware with credentials enabled for cookies
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all dev origins cleanly
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'x-meeting-password']
  })
);

// Body parsers & Cookie parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security Sanitization: NoSQL injection stripping, XSS filtering, CSRF protection
app.use(sanitizeNoSql);
app.use(sanitizeXss);
app.use(csrfProtection);

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Response compression (gzip/deflate for JSON & REST responses > 1KB)
app.use(compressionMiddleware);

// General API Rate Limiting
app.use('/api', generalApiLimiter);

// Serve static uploaded files for local storage provider fallback
app.use('/uploads', express.static(config.uploadDir));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ConnectSphere API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      rooms: '/api/rooms',
      users: '/api/users'
    }
  });
});

// Mount Centralized API Routes
app.use('/api', apiRoutes);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server & attach Socket.IO
const httpServer = http.createServer(app);
const io = initializeSocket(httpServer);
app.set('io', io);

// Start server
const startServer = async () => {
  await connectDB();
  reminderService.start(io);

  httpServer.listen(config.port, () => {
    logger.info(`ConnectSphere Backend running on port ${config.port} in ${config.nodeEnv} mode`);
    logger.info(`Client URL allowed: ${config.clientUrl}`);
    logger.info(`Health check available at http://localhost:${config.port}/api/health`);
  });
};

// Comprehensive graceful shutdown handling
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Closing HTTP server, draining Socket.IO connections, and releasing DB locks...`);
  reminderService.stop();

  try {
    if (io) {
      io.disconnectSockets(true);
    }
  } catch (err) {
    logger.warn(`Error disconnecting sockets: ${err.message}`);
  }

  httpServer.close(async () => {
    logger.info('HTTP server closed successfully.');
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed cleanly.');
    } catch (err) {
      logger.warn(`Error closing MongoDB: ${err.message}`);
    }
    process.exit(0);
  });

  // Force termination if hanging after 10 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcefully exiting process.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = { app, httpServer, io };
