const breakoutService = require('../services/breakoutService');

const registerBreakoutHandler = (io, socket) => {
  // Host creates breakout rooms (Host/Co-host only)
  socket.on('breakout-create', ({ roomId, roomNames, allowSwitching, assignments }, callback) => {
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
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can create breakout rooms.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can create breakout rooms.' });
      return;
    }

    try {
      const data = breakoutService.createBreakouts(targetRoom, {
        roomNames,
        allowSwitching,
        assignments
      });

      // Broadcast to all participants in main room
      io.in(targetRoom).emit('breakout-rooms-created', data);
      if (typeof callback === 'function') callback({ success: true, data });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });

  // Participant joins / switches breakout room
  socket.on('breakout-join', ({ roomId, subRoomId }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room access.' });
      return;
    }

    try {
      const data = breakoutService.joinBreakout(targetRoom, subRoomId, socket.id);
      io.in(targetRoom).emit('breakout-state-updated', data);
      socket.emit('breakout-joined', { subRoomId });
      if (typeof callback === 'function') callback({ success: true, subRoomId });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });

  // Host broadcasts message to all breakout rooms
  socket.on('breakout-broadcast', ({ roomId, message }) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom || !message) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      socket.emit('error-notification', { message: 'Unauthorized room access.' });
      return;
    }
    if (!socket.isHost && !socket.isCoHost) {
      socket.emit('error-notification', { message: 'Only hosts and co-hosts can broadcast to breakout rooms.' });
      return;
    }

    io.in(targetRoom).emit('breakout-announcement', {
      message,
      senderName: socket.userName || 'Host',
      timestamp: Date.now()
    });
  });

  // Host closes all breakout rooms
  socket.on('breakout-close-all', ({ roomId }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room access.' });
      return;
    }
    if (!socket.isHost && !socket.isCoHost) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can close breakout rooms.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can close breakout rooms.' });
      return;
    }

    try {
      breakoutService.closeBreakouts(targetRoom);
      io.in(targetRoom).emit('breakout-rooms-closed', {
        message: 'The host has ended breakout rooms. All participants returned to main room.'
      });
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });
};

module.exports = {
  registerBreakoutHandler
};
