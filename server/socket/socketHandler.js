const { Server } = require('socket.io');
const config = require('../config/config');
const { verifyToken } = require('../utils/tokenUtils');
const logger = require('../utils/logger');
const { registerWebRTCSignaling, handlePeerDisconnect } = require('./webrtcSignaling');
const { registerChatHandler } = require('./chatHandler');
const { registerWhiteboardHandler } = require('./whiteboardHandler');
const { registerPresenceHandler } = require('./presenceHandler');
const { registerNotesHandler } = require('./notesHandler');
const { registerPollHandler } = require('./pollHandler');
const { registerBreakoutHandler } = require('./breakoutHandler');
const presenceService = require('../services/presenceService');
const notificationService = require('../services/notificationService');
const breakoutService = require('../services/breakoutService');

const parseCookie = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((res, c) => {
    const [key, val] = c.trim().split('=');
    if (key && val) {
      res[key.trim()] = decodeURIComponent(val.trim());
    }
    return res;
  }, {});
};

const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Multi-instance horizontal scaling with Redis adapter if REDIS_URL is configured
  if (config.redisUrl) {
    try {
      // Dynamic require so local dev / single instance runs without hard dependency
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url: config.redisUrl });
      const subClient = pubClient.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('Socket.IO Redis adapter initialized for multi-instance horizontal scaling.');
        })
        .catch((err) => {
          logger.warn(`Socket.IO Redis adapter connection failed: ${err.message}. Falling back to in-memory adapter.`);
        });
    } catch {
      logger.info('Optional Redis adapter module not found. Operating with standard in-memory adapter.');
    }
  }

  // Secure Socket Handshake Authentication Middleware
  io.use((socket, next) => {
    try {
      let token = null;

      // 1. Handshake auth object
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }
      // 2. Authorization header
      else if (
        socket.handshake.headers.authorization &&
        socket.handshake.headers.authorization.startsWith('Bearer ')
      ) {
        token = socket.handshake.headers.authorization.split(' ')[1];
      }
      // 3. HttpOnly / Session Cookie
      else if (socket.handshake.headers.cookie) {
        const cookies = parseCookie(socket.handshake.headers.cookie);
        if (cookies.token && cookies.token !== 'none') {
          token = cookies.token;
        }
      }

      if (token) {
        try {
          const decoded = verifyToken(token);
          socket.user = decoded;
          socket.userId = decoded.id;
          socket.userName = decoded.fullName || decoded.username;
          socket.isAuthenticated = true;
        } catch {
          socket.isAuthenticated = false;
        }
      } else {
        socket.isAuthenticated = false;
      }
    } catch {
      socket.isAuthenticated = false;
    }
    next();
  });

  // Attach io to notification, presence and breakout services
  presenceService.setIO(io);
  notificationService.setIO(io);
  breakoutService.setIO(io);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Register Presence & Direct Calling
    registerPresenceHandler(io, socket);

    // Register WebRTC & Room events
    registerWebRTCSignaling(io, socket);

    // Register In-room Chat events
    registerChatHandler(io, socket);

    // Register Collaborative Whiteboard events
    registerWhiteboardHandler(io, socket);

    // Register Shared Notes events
    registerNotesHandler(io, socket);

    // Register Meeting Polls events
    registerPollHandler(io, socket);

    // Register Breakout Rooms events
    registerBreakoutHandler(io, socket);

    // Handle Disconnection
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
      await presenceService.unregisterSocket(socket);
      handlePeerDisconnect(io, socket);
    });
  });

  return io;
};

module.exports = {
  initializeSocket
};

