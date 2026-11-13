const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

// Global maps: userId -> Set<socketId> and socketId -> userId
const userSockets = new Map();
const socketUsers = new Map();
// In-memory status override map: userId -> status string
const userStatusOverrides = new Map();

class PresenceService {
  constructor() {
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Register user socket on connection
  async registerSocket(socket, user) {
    if (!user || (!user.id && !user._id)) return;
    const userId = (user.id || user._id).toString();

    // If client supplied existing presence status, keep it
    if (user.presenceStatus) {
      userStatusOverrides.set(userId, user.presenceStatus);
    }

    socketUsers.set(socket.id, userId);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // If first connection for this user, mark online
    const wasOffline = userSockets.get(userId).size === 1;
    if (wasOffline) {
      await this.setUserOnline(userId, true);
    }

    const currentStatus = this.getUserStatus(userId);
    this.broadcastPresence(userId, {
      userId,
      isOnline: currentStatus !== 'offline',
      presenceStatus: currentStatus,
      lastSeen: new Date()
    });
  }

  // Unregister user socket on disconnect
  async unregisterSocket(socket) {
    const userId = socketUsers.get(socket.id);
    if (!userId) return;

    socketUsers.delete(socket.id);

    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        userSockets.delete(userId);
        await this.setUserOnline(userId, false);

        this.broadcastPresence(userId, {
          userId,
          isOnline: false,
          presenceStatus: 'offline',
          lastSeen: new Date()
        });
      }
    }
  }

  // Mark online or offline in DB and memory
  async setUserOnline(userId, isOnline) {
    if (this.isDbConnected()) {
      try {
        let statusToSet = 'available';
        const uidStr = userId.toString();
        if (isOnline) {
          if (userStatusOverrides.has(uidStr)) {
            statusToSet = userStatusOverrides.get(uidStr);
          } else {
            const existingUser = await User.findById(userId).select('presenceStatus');
            if (existingUser && existingUser.presenceStatus) {
              statusToSet = existingUser.presenceStatus;
              userStatusOverrides.set(uidStr, statusToSet);
            }
          }
        } else {
          statusToSet = 'offline';
        }

        await User.findByIdAndUpdate(userId, {
          isOnline: statusToSet !== 'offline',
          lastSeen: new Date(),
          presenceStatus: statusToSet
        });
      } catch (err) {
        logger.warn(`setUserOnline DB error: ${err.message}`);
      }
    }
  }

  // Set explicit presence status ('available', 'busy', 'in-meeting', 'away')
  async setUserStatus(userId, status) {
    const valid = ['available', 'busy', 'in-meeting', 'away', 'offline'];
    const cleanStatus = valid.includes(status) ? status : 'available';

    userStatusOverrides.set(userId.toString(), cleanStatus);

    if (this.isDbConnected()) {
      try {
        await User.findByIdAndUpdate(userId, {
          presenceStatus: cleanStatus
        });
      } catch (err) {
        logger.warn(`setUserStatus DB error: ${err.message}`);
      }
    }

    const isOnline = this.isUserOnline(userId);
    this.broadcastPresence(userId, {
      userId,
      isOnline,
      presenceStatus: isOnline ? cleanStatus : 'offline',
      lastSeen: new Date()
    });

    return cleanStatus;
  }

  getUserStatus(userId) {
    if (!this.isUserOnline(userId)) return 'offline';
    return userStatusOverrides.get(userId.toString()) || 'available';
  }

  isUserOnline(userId) {
    if (!userId) return false;
    const socketSet = userSockets.get(userId.toString());
    return Boolean(socketSet && socketSet.size > 0);
  }

  getUserSockets(userId) {
    if (!userId) return [];
    const socketSet = userSockets.get(userId.toString());
    return socketSet ? Array.from(socketSet) : [];
  }

  broadcastPresence(userId, payload) {
    if (this.io) {
      this.io.emit('user-presence-changed', payload);
    }
  }
}

const presenceService = new PresenceService();
module.exports = presenceService;

