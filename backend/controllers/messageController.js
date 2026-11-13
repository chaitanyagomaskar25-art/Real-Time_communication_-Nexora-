const chatService = require('../services/chatService');
const storageService = require('../services/storageService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// @route   GET /api/messages/:conversationId
// @desc    Get paginated messages for a group or direct conversation from MongoDB
// @access  Optional Auth / Private
const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 20, before = null } = req.query;
    const userId = req.user ? (req.user.id || req.user._id) : null;

    const result = await chatService.getMeetingMessages(conversationId.toLowerCase().trim(), {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      before,
      userId
    });

    return sendSuccess(res, 200, 'Conversation messages retrieved', result);
  } catch (error) {
    logger.error(`Error in getConversationMessages: ${error.message}`);
    next(error);
  }
};

// @route   POST /api/messages/:conversationId
// @desc    Store a message in MongoDB and broadcast via Socket.IO
// @access  Optional Auth / Private
const sendConversationMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, file, replyTo, isPrivate = false, recipientId = null, recipientName = null, clientTempId = null, messageType = 'user' } = req.body;

    if ((!content || content.trim().length === 0) && !file) {
      return res.status(400).json({
        success: false,
        message: 'Message content or file cannot be empty.'
      });
    }

    const senderId = req.user ? (req.user.id || req.user._id) : (req.body.senderId || 'guest');
    const senderName = req.user ? (req.user.fullName || req.user.name) : (req.body.senderName || 'Anonymous');
    const senderAvatar = req.user ? req.user.avatar : (req.body.senderAvatar || '');

    const messageText = content ? content.trim() : '';
    const determinedMessageType = messageType === 'system' ||
      (messageText && (messageText.startsWith('📞') || messageText.includes('Started a voice call') || messageText.includes('Started a video call')))
      ? 'system'
      : (messageType || 'user');

    const savedMessage = await chatService.createMessage({
      roomId: conversationId.toLowerCase().trim(),
      senderId,
      senderName,
      senderAvatar,
      content: messageText,
      file,
      isPrivate: Boolean(isPrivate),
      recipientId,
      recipientName,
      clientTempId,
      messageType: determinedMessageType,
      replyTo: replyTo && replyTo.content ? {
        messageId: replyTo.messageId || replyTo.id || null,
        senderName: replyTo.senderName || replyTo.sender || 'Participant',
        content: replyTo.content
      } : null
    });

    // Broadcast in real-time via Socket.IO to this group room
    const io = req.app.get('io');
    if (io) {
      const room = conversationId.toLowerCase().trim();
      io.in(room).emit('new-message', savedMessage);
    }

    return sendSuccess(res, 201, 'Message saved and delivered', savedMessage);
  } catch (error) {
    logger.error(`Error in sendConversationMessage: ${error.message}`);
    next(error);
  }
};

// @route   PUT /api/messages/:conversationId/:messageId
// @desc    Edit a message in MongoDB
// @access  Optional Auth / Private
const editConversationMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const { newContent } = req.body;
    const userId = req.user ? (req.user.id || req.user._id) : (req.body.userId || null);

    const updated = await chatService.editMessage({
      messageId,
      roomId: conversationId.toLowerCase().trim(),
      newContent,
      userId
    });

    const io = req.app.get('io');
    if (io) {
      io.in(conversationId.toLowerCase().trim()).emit('message-edited', {
        messageId,
        newContent: updated.content,
        isEdited: true
      });
    }

    return sendSuccess(res, 200, 'Message updated', updated);
  } catch (error) {
    logger.error(`Error in editConversationMessage: ${error.message}`);
    next(error);
  }
};

// @route   DELETE /api/messages/:conversationId/:messageId
// @desc    Delete a message in MongoDB
// @access  Optional Auth / Private
const deleteConversationMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : (req.body?.userId || req.query?.userId || null);
    const alternateId = req.query?.alternateId || req.body?.alternateId || null;
    const isHost = req.user ? req.user.role === 'admin' : false;

    await chatService.deleteMessage({
      messageId,
      alternateId,
      roomId: conversationId.toLowerCase().trim(),
      userId,
      isHost
    });

    const io = req.app.get('io');
    if (io) {
      io.in(conversationId.toLowerCase().trim()).emit('message-deleted', { messageId, alternateId });
    }

    return sendSuccess(res, 200, 'Message deleted');
  } catch (error) {
    logger.error(`Error in deleteConversationMessage: ${error.message}`);
    next(error);
  }
};

// @route   POST /api/messages/:conversationId/upload or /api/messages/upload
// @desc    Upload an attachment image/document to Cloudinary (or local storage fallback)
// @access  Optional Auth / Private
const uploadMessageAttachment = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an image or document.'
      });
    }

    const conversationId = req.params.conversationId || req.body.conversationId || 'chat';

    const saved = await storageService.saveFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      meetingId: conversationId
    });

    return sendSuccess(res, 201, 'File uploaded successfully', {
      fileId: saved.fileId,
      name: saved.originalName,
      fileName: saved.fileName,
      size: saved.size,
      type: saved.mimeType,
      url: saved.fileUrl,
      publicId: saved.storagePath,
      storageProvider: saved.storageProvider
    });
  } catch (error) {
    logger.error(`Error uploading chat attachment: ${error.message}`);
    next(error);
  }
};

// @route   DELETE /api/messages/:conversationId/clear
// @desc    Clear all messages for a conversation
// @access  Optional Auth / Private
const clearConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    await chatService.clearRoomMessages(conversationId);

    const io = req.app.get('io');
    if (io) {
      io.in(conversationId.toLowerCase().trim()).emit('chat-cleared', {
        roomId: conversationId.toLowerCase().trim()
      });
    }

    return sendSuccess(res, 200, 'Conversation messages cleared');
  } catch (error) {
    logger.error(`Error in clearConversationMessages: ${error.message}`);
    next(error);
  }
};

// @route   PUT /api/messages/:conversationId/:messageId/pin
// @desc    Toggle pin status for a message
// @access  Optional Auth / Private
const togglePinMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const alternateId = req.query?.alternateId || req.body?.alternateId || null;

    const result = await chatService.togglePinMessage({
      messageId,
      alternateId,
      roomId: conversationId
    });

    const io = req.app.get('io');
    if (io) {
      io.in(conversationId.toLowerCase().trim()).emit('message-pinned', {
        roomId: conversationId.toLowerCase().trim(),
        messageId: result.messageId,
        alternateId: result.alternateId,
        isPinned: result.isPinned
      });
    }

    return sendSuccess(res, 200, 'Message pin updated', result);
  } catch (error) {
    logger.error(`Error in togglePinMessage: ${error.message}`);
    next(error);
  }
};

module.exports = {
  getConversationMessages,
  sendConversationMessage,
  editConversationMessage,
  deleteConversationMessage,
  uploadMessageAttachment,
  clearConversationMessages,
  togglePinMessage
};
