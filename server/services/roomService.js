const crypto = require('crypto');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const Message = require('../models/Message');
const logger = require('../utils/logger');

// In-memory fallback map for active rooms
const inMemoryRooms = new Map();
const inMemoryMessages = new Map(); // roomId -> Array<Message>

class RoomService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  generateRoomId() {
    // Generate clean format: xxx-yyyy-zzz
    const p1 = crypto.randomBytes(2).toString('hex');
    const p2 = crypto.randomBytes(2).toString('hex');
    const p3 = crypto.randomBytes(2).toString('hex');
    return `${p1}-${p2}-${p3}`;
  }

  async createRoom({ title, hostId, hostName, isLocked }) {
    const roomId = this.generateRoomId();
    const roomTitle = title && title.trim().length > 0 ? title.trim() : 'ConnectSphere Meeting';

    if (this.isDbConnected()) {
      try {
        const room = await Room.create({
          roomId,
          title: roomTitle,
          host: hostId || null,
          hostName: hostName || 'Host',
          isLocked: Boolean(isLocked),
          participants: hostName ? [{ name: hostName, joinedAt: new Date() }] : []
        });

        return {
          id: room._id,
          roomId: room.roomId,
          title: room.title,
          hostName: room.hostName,
          isLocked: room.isLocked,
          createdAt: room.createdAt
        };
      } catch (err) {
        logger.warn(`RoomService MongoDB fallback active: ${err.message}`);
      }
    }

    const mockRoom = {
      id: 'mem_room_' + roomId,
      roomId,
      title: roomTitle,
      hostId: hostId || null,
      hostName: hostName || 'Host',
      isLocked: Boolean(isLocked),
      createdAt: new Date(),
      participants: []
    };

    inMemoryRooms.set(roomId, mockRoom);
    return mockRoom;
  }

  async getRoomById(roomId) {
    if (this.isDbConnected()) {
      try {
        const room = await Room.findOne({ roomId });
        if (room) {
          return {
            id: room._id,
            roomId: room.roomId,
            title: room.title,
            host: room.host,
            hostName: room.hostName,
            isLocked: room.isLocked,
            createdAt: room.createdAt
          };
        }
      } catch (err) {
        logger.warn(`RoomService getRoomById fallback: ${err.message}`);
      }
    }

    if (inMemoryRooms.has(roomId)) {
      return inMemoryRooms.get(roomId);
    }

    // Auto-create room dynamically on join if it doesn't exist yet (Zoom/Google Meet style)
    const autoCreated = {
      id: 'mem_room_' + roomId,
      roomId,
      title: 'Instant Meeting',
      hostName: 'Host',
      isLocked: false,
      createdAt: new Date(),
      participants: []
    };
    inMemoryRooms.set(roomId, autoCreated);
    return autoCreated;
  }

  async saveMessage({ roomId, senderId, senderName, content }) {
    const msg = {
      roomId,
      senderId: senderId || '',
      senderName: senderName || 'Anonymous',
      content,
      timestamp: new Date()
    };

    if (this.isDbConnected()) {
      try {
        const saved = await Message.create(msg);
        return saved;
      } catch (err) {
        logger.warn(`RoomService saveMessage fallback: ${err.message}`);
      }
    }

    if (!inMemoryMessages.has(roomId)) {
      inMemoryMessages.set(roomId, []);
    }
    inMemoryMessages.get(roomId).push(msg);
    return msg;
  }

  async getRoomMessages(roomId) {
    if (this.isDbConnected()) {
      try {
        const messages = await Message.find({ roomId }).sort({ timestamp: 1 }).limit(50);
        if (messages && messages.length > 0) {
          return messages;
        }
      } catch (err) {
        // Fallback
      }
    }

    return inMemoryMessages.get(roomId) || [];
  }
}

module.exports = new RoomService();
