const chatService = require('../services/chatService');
const logger = require('../utils/logger');

const registerChatHandler = (io, socket) => {
  // 0. Join / Leave persistent Group Chat or Conversation Channel
  socket.on('join-conversation', ({ conversationId }) => {
    if (!conversationId) return;
    const cleanId = conversationId.toLowerCase().trim();
    socket.join(cleanId);
    socket.conversationId = cleanId;
  });

  socket.on('leave-conversation', ({ conversationId }) => {
    if (!conversationId) return;
    const cleanId = conversationId.toLowerCase().trim();
    socket.leave(cleanId);
    if (socket.conversationId === cleanId) {
      socket.conversationId = null;
    }
  });

  // 1. Send In-Room or In-Conversation Message (Group or Private Direct Message)
  socket.on(
    'send-message',
    async ({
      roomId,
      conversationId,
      content,
      file = null,
      isPrivate = false,
      recipientSocketId = null,
      recipientUserId = null,
      recipientName = null,
      replyTo = null
    }) => {
      const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
        .toLowerCase()
        .trim();
      if (!targetRoomId || ((!content || content.trim().length === 0) && !file)) return;

      try {
        // Security check for private messages: Verify recipient is in the same room
        if (isPrivate && recipientSocketId) {
          const recipientSocket = io.sockets.sockets.get(recipientSocketId);
          if (!recipientSocket || (recipientSocket.roomId !== targetRoomId && recipientSocket.conversationId !== targetRoomId)) {
            socket.emit('error-notification', { message: 'Recipient is not reachable in this conversation.' });
            return;
          }
        }

        const messageText = content ? content.trim() : (file ? `[Attachment: ${file.name || 'file'}]` : '');

        const savedMessage = await chatService.createMessage({
          roomId: targetRoomId,
          senderId: socket.userId || socket.id,
          senderName: socket.userName || 'Anonymous',
          senderAvatar: socket.userAvatar || '',
          content: messageText,
          file,
          isPrivate: Boolean(isPrivate),
          recipientId: isPrivate ? (recipientUserId || recipientSocketId) : null,
          recipientName: isPrivate ? recipientName : null,
          replyTo
        });

        if (isPrivate && recipientSocketId) {
          // Deliver only to target recipient and sender
          io.to(recipientSocketId).emit('new-message', savedMessage);
          socket.emit('new-message', savedMessage);
        } else {
          // Broadcast to everyone in the conversation / meeting room
          io.in(targetRoomId).emit('new-message', savedMessage);
        }
      } catch (err) {
        logger.error(`Error sending chat message in room [${targetRoomId}]: ${err.message}`);
        socket.emit('error-notification', { message: 'Failed to send message.' });
      }
    }
  );

  // 2. Edit Own Message
  socket.on('edit-message', async ({ messageId, roomId, conversationId, newContent }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId || !messageId || !newContent || newContent.trim().length === 0) return;

    try {
      const updated = await chatService.editMessage({
        messageId,
        roomId: targetRoomId,
        newContent: newContent.trim(),
        userId: socket.userId || socket.id
      });

      io.in(targetRoomId).emit('message-edited', {
        messageId,
        newContent: updated.content,
        isEdited: true
      });
    } catch (err) {
      socket.emit('error-notification', { message: err.message || 'Failed to edit message.' });
    }
  });

  // 3. Delete Own Message (or Host override)
  socket.on('delete-message', async ({ messageId, alternateId, roomId, conversationId, userId }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId || !messageId) return;

    try {
      await chatService.deleteMessage({
        messageId,
        alternateId,
        roomId: targetRoomId,
        userId: userId || socket.userId || socket.id,
        isHost: Boolean(socket.isHost)
      });

      io.in(targetRoomId).emit('message-deleted', { messageId, alternateId, roomId: targetRoomId });
    } catch (err) {
      socket.emit('error-notification', { message: err.message || 'Failed to delete message.' });
    }
  });

  // 4. Emoji Reaction Toggle (Adds if not present, removes if already reacted)
  socket.on('message-reaction', async ({ messageId, roomId, conversationId, emoji, userId, userName }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId || !messageId || !emoji) return;

    try {
      const result = await chatService.toggleReaction({
        messageId,
        roomId: targetRoomId,
        emoji,
        user: {
          userId: userId || socket.userId || socket.id,
          userName: userName || socket.userName || 'Participant'
        }
      });

      io.in(targetRoomId).emit('reaction-updated', {
        ...result,
        roomId: targetRoomId
      });
    } catch (err) {
      logger.warn(`Reaction toggle failed: ${err.message}`);
    }
  });

  // 5. Typing Indicators (Group or Private)
  socket.on('typing', ({ isTyping, roomId, conversationId, recipientSocketId = null }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId && !recipientSocketId) return;

    const payload = {
      userId: socket.userId || socket.id,
      userName: socket.userName || 'Someone',
      conversationId: targetRoomId,
      isTyping: Boolean(isTyping),
      isPrivate: Boolean(recipientSocketId)
    };

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', payload);
    } else if (targetRoomId) {
      socket.to(targetRoomId).emit('user-typing', payload);
    }
  });

  // 6. Clear Conversation Chat
  socket.on('clear-chat', async ({ conversationId, roomId }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId) return;

    try {
      await chatService.clearRoomMessages(targetRoomId);
      io.in(targetRoomId).emit('chat-cleared', { roomId: targetRoomId });
    } catch (err) {
      logger.warn(`Clear chat failed: ${err.message}`);
    }
  });

  // 7. Pin / Unpin Message
  socket.on('pin-message', async ({ messageId, alternateId, conversationId, roomId }) => {
    const targetRoomId = (conversationId || roomId || socket.roomId || socket.conversationId || '')
      .toLowerCase()
      .trim();
    if (!targetRoomId || !messageId) return;

    try {
      const result = await chatService.togglePinMessage({
        messageId,
        alternateId,
        roomId: targetRoomId
      });

      io.in(targetRoomId).emit('message-pinned', {
        ...result,
        roomId: targetRoomId
      });
    } catch (err) {
      logger.warn(`Pin message failed: ${err.message}`);
    }
  });
};

module.exports = {
  registerChatHandler
};
