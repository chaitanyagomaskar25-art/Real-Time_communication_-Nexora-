const roomService = require('../services/roomService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const createRoom = async (req, res, next) => {
  try {
    const { title, isLocked } = req.body;
    const hostId = req.user ? (req.user._id || req.user.id) : null;
    const hostName = req.user ? req.user.name : (req.body.hostName || 'Host');

    const room = await roomService.createRoom({
      title,
      hostId,
      hostName,
      isLocked
    });

    return sendSuccess(res, 201, 'Room created successfully', room);
  } catch (error) {
    next(error);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return sendError(res, 400, 'Room ID is required');
    }

    const room = await roomService.getRoomById(roomId);
    if (!room) {
      return sendError(res, 404, 'Room not found');
    }

    return sendSuccess(res, 200, 'Room details retrieved', room);
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const messages = await roomService.getRoomMessages(roomId);
    return sendSuccess(res, 200, 'Messages retrieved', messages);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getRoom,
  getMessages
};

