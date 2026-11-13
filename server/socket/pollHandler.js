const pollService = require('../services/pollService');

const registerPollHandler = (io, socket) => {
  // Create Poll live broadcast (Host/Co-host only)
  socket.on('poll-create', async ({ roomId, question, options, isAnonymous }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom) {
      if (typeof callback === 'function') callback({ success: false, message: 'Must be in a meeting room.' });
      return;
    }
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room access.' });
      return;
    }
    if (!socket.isHost && !socket.isCoHost) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can create polls.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can create polls.' });
      return;
    }

    try {
      const creator = {
        name: socket.userName || socket.user?.fullName || socket.user?.name || 'Host',
        id: socket.user ? (socket.user.id || socket.user._id) : socket.id
      };
      const poll = await pollService.createPoll(
        targetRoom,
        { question, options, isAnonymous },
        creator
      );

      io.in(targetRoom).emit('poll-created', poll);
      if (typeof callback === 'function') callback({ success: true, poll });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });

  // Vote on Poll live broadcast
  socket.on('poll-vote', async ({ roomId, pollId, optionId }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom || !pollId || !optionId) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room access.' });
      return;
    }

    try {
      const voterId = socket.user ? (socket.user.id || socket.user._id) : socket.id;
      const updatedPoll = await pollService.votePoll(targetRoom, pollId, optionId, voterId);

      // Broadcast updated results to all participants in room
      io.in(targetRoom).emit('poll-updated', updatedPoll);
      if (typeof callback === 'function') callback({ success: true, poll: updatedPoll });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });

  // End Poll live broadcast (Host/Co-host only)
  socket.on('poll-end', async ({ roomId, pollId }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom || !pollId) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room access.' });
      return;
    }
    if (!socket.isHost && !socket.isCoHost) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can end polls.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can end polls.' });
      return;
    }

    try {
      const endedPoll = await pollService.endPoll(targetRoom, pollId);
      io.in(targetRoom).emit('poll-ended', endedPoll);
      if (typeof callback === 'function') callback({ success: true, poll: endedPoll });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });
};

module.exports = {
  registerPollHandler
};
