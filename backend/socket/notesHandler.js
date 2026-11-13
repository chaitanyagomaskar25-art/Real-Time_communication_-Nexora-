const notesService = require('../services/notesService');

const registerNotesHandler = (io, socket) => {
  // Sync notes content live across room participants
  socket.on('notes-update', async ({ roomId, content }) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom) {
      socket.emit('error-notification', { message: 'You must join a meeting room to edit notes.' });
      return;
    }
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      socket.emit('error-notification', { message: 'Unauthorized: Cannot modify notes for a different room.' });
      return;
    }

    const senderName = socket.userName || socket.user?.fullName || socket.user?.name || 'Participant';
    const payload = {
      meetingId: targetRoom,
      content: content || '',
      lastEditedBy: senderName,
      timestamp: Date.now()
    };

    // Broadcast to other peers in room
    socket.to(targetRoom).emit('notes-updated', payload);

    // Save notes to persistent store
    try {
      await notesService.saveNotes(targetRoom, content, {
        fullName: senderName,
        id: socket.user ? (socket.user.id || socket.user._id) : null
      });
    } catch {
      // Safe ignore
    }
  });

  // Request latest notes
  socket.on('get-notes', async ({ roomId }, callback) => {
    const targetRoom = socket.roomId || roomId;
    if (!targetRoom) return;
    if (socket.roomId && roomId && socket.roomId !== roomId) {
      if (typeof callback === 'function') callback(null);
      return;
    }
    try {
      const data = await notesService.getNotes(targetRoom);
      if (typeof callback === 'function') callback(data);
      else socket.emit('notes-synced', data);
    } catch {
      // Safe ignore
    }
  });
};

module.exports = {
  registerNotesHandler
};

