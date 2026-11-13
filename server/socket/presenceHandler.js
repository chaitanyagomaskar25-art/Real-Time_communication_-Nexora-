const presenceService = require('../services/presenceService');
const notificationService = require('../services/notificationService');

const registerPresenceHandler = (io, socket) => {
  // Client identifies user session for global presence & direct calling
  socket.on('register-presence', async ({ user }) => {
    if (user && (user.id || user._id)) {
      socket.user = user;
      await presenceService.registerSocket(socket, {
        id: user.id || user._id,
        fullName: user.fullName || user.name,
        email: user.email,
        presenceStatus: user.presenceStatus
      });
    }
  });

  // Client updates explicit presence status (available, busy, away)
  socket.on('update-presence-status', async ({ status }) => {
    if (socket.user && (socket.user.id || socket.user._id)) {
      const uid = socket.user.id || socket.user._id;
      await presenceService.setUserStatus(uid, status);
    }
  });

  // Direct incoming call response (Accept / Decline)
  socket.on('call-response', ({ callerId, meetingId, accepted }) => {
    if (callerId) {
      const callerSockets = presenceService.getUserSockets(callerId);
      callerSockets.forEach((sid) => {
        io.to(sid).emit('call-response-received', {
          responderId: socket.user ? (socket.user.id || socket.user._id) : null,
          responderName: socket.user ? (socket.user.fullName || socket.user.name) : 'User',
          meetingId,
          accepted
        });
      });
    }
  });

  // Direct Call User Event
  socket.on('call-user', async ({ recipientId, meetingId }) => {
    if (socket.user && recipientId && meetingId) {
      await notificationService.callContact(socket.user, recipientId, meetingId);
    }
  });
};

module.exports = {
  registerPresenceHandler
};

