const meetingService = require('../services/meetingService');
const chatService = require('../services/chatService');
const recordingService = require('../services/recordingService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// Track room participants: roomId -> Map<socketId, { socketId, userId, userName, role, audio, video, isHandRaised, handRaisedAt, isSpeaking, connectionState }>
const roomPeers = new Map();

// Track active presenter: roomId -> { socketId, userId, userName } | null
const roomPresenters = new Map();

// Track waiting room: roomId -> Map<socketId, { socketId, userId, userName, requestedAt }>
const waitingRoomPeers = new Map();

// Track room permissions: roomId -> { isLocked, allowScreenShare, allowParticipantUnmute, allowParticipantVideo, allowParticipantWhiteboard, allowNameChange }
const roomPermissions = new Map();

const getRoomPermissions = (roomId) => {
  if (!roomPermissions.has(roomId)) {
    roomPermissions.set(roomId, {
      isLocked: false,
      allowScreenShare: true,
      allowParticipantUnmute: true,
      allowParticipantVideo: true,
      allowParticipantWhiteboard: true,
      allowNameChange: true
    });
  }
  return roomPermissions.get(roomId);
};

// Permission Helpers
const isMainHost = (socket) => Boolean(socket.isHost);
const canManageParticipants = (socket) => Boolean(socket.isHost || socket.isCoHost);

const registerWebRTCSignaling = (io, socket) => {
  // Join Meeting / Room
  socket.on('join-room', async ({ roomId, userId, userName, _isHost, isCoHost, requiresWaitingRoom }) => {
    if (!roomId) return;

    const cleanRoomId = roomId.toLowerCase().trim();

    // Authenticated socket binding to prevent user ID / name spoofing
    if (socket.isAuthenticated && socket.user) {
      socket.userId = socket.user.id;
      socket.userName = socket.user.fullName || socket.user.username || userName || 'User';
    } else {
      socket.userId = userId || socket.id;
      socket.userName = userName || 'Guest';
    }

    // Role-based privilege verification: Prevent spoofing host privileges
    let verifiedHost = false;
    let meeting = null;
    try {
      meeting = await meetingService.getMeetingById(cleanRoomId);
      if (meeting) {
        if (meeting.status === 'cancelled' || meeting.status === 'ended') {
          socket.emit('error-notification', { message: `Cannot join. This meeting is ${meeting.status}.` });
          return;
        }
        if (meeting.host) {
          verifiedHost = Boolean(socket.userId && meeting.host.toString() === socket.userId.toString());
        } else {
          verifiedHost = Boolean(_isHost);
        }
      } else {
        // Ad-hoc testing rooms without database records
        verifiedHost = Boolean(_isHost);
      }
    } catch {
      verifiedHost = Boolean(_isHost);
    }

    const effectiveRoomId = meeting?.meetingId ? meeting.meetingId.toLowerCase().trim() : cleanRoomId;

    socket.roomId = effectiveRoomId;
    socket.isHost = verifiedHost;
    socket.isCoHost = Boolean(isCoHost && !verifiedHost);

    // If waiting room is active and participant is NOT host
    const waitingRoomActive = Boolean(meeting?.settings?.waitingRoomEnabled || requiresWaitingRoom);
    if (waitingRoomActive && !socket.isHost) {
      if (!waitingRoomPeers.has(effectiveRoomId)) {
        waitingRoomPeers.set(effectiveRoomId, new Map());
      }

      waitingRoomPeers.get(effectiveRoomId).set(socket.id, {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
        requestedAt: new Date()
      });

      socket.emit('waiting-room-status', {
        inWaitingRoom: true,
        message: 'Please wait, the meeting host will let you in soon.'
      });

      // Notify host and co-hosts in the room about the waiting participant
      socket.to(effectiveRoomId).emit('participant-waiting', {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName
      });

      logger.info(`User [${socket.userName}] placed in waiting room for [${effectiveRoomId}]`);
      return;
    }

    // Direct entry into meeting
    await admitSocketToRoom(io, socket, effectiveRoomId);
  });

  // Host / Co-host Admits a Participant from Waiting Room
  socket.on('admit-participant', async ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'You do not have permission to admit participants.' });
      return;
    }

    const waitingMap = waitingRoomPeers.get(roomId);
    if (!waitingMap || !waitingMap.has(targetSocketId)) return;

    const targetPeer = waitingMap.get(targetSocketId);
    waitingMap.delete(targetSocketId);

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      const perms = getRoomPermissions(roomId);
      targetSocket.emit('admitted-to-meeting', { permissions: perms });
      await admitSocketToRoom(io, targetSocket, roomId);
      logger.info(`Admin [${socket.userName}] admitted [${targetPeer.userName}] into [${roomId}]`);
    }

    // Update remaining waiting list for host/co-hosts
    io.in(roomId).emit('waiting-list-updated', {
      waiting: Array.from(waitingMap.values())
    });
  });

  // Host / Co-host Rejects a Participant from Waiting Room
  socket.on('reject-participant', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'You do not have permission to reject participants.' });
      return;
    }

    const waitingMap = waitingRoomPeers.get(roomId);
    if (waitingMap && waitingMap.has(targetSocketId)) {
      const targetPeer = waitingMap.get(targetSocketId);
      waitingMap.delete(targetSocketId);

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('rejected-from-meeting', {
          message: 'The meeting host has declined your request to join.'
        });
        targetSocket.leave(roomId);
      }

      logger.info(`Admin [${socket.userName}] rejected [${targetPeer.userName}] from [${roomId}]`);

      // Update remaining waiting list
      io.in(roomId).emit('waiting-list-updated', {
        waiting: Array.from(waitingMap.values())
      });
    }
  });

  // Host / Co-host Locks / Unlocks Meeting
  socket.on('toggle-meeting-lock', async ({ isLocked }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Only hosts and co-hosts can lock/unlock meetings.' });
      return;
    }

    try {
      const perms = getRoomPermissions(roomId);
      perms.isLocked = Boolean(isLocked);

      await meetingService.updateMeetingSettings(roomId, { isLocked: Boolean(isLocked) }, socket.userId);
      io.in(roomId).emit('meeting-lock-status', {
        isLocked: Boolean(isLocked),
        updatedBy: socket.userName
      });
      logger.info(`Admin [${socket.userName}] set lock = ${isLocked} for room [${roomId}]`);
    } catch (err) {
      socket.emit('error-notification', { message: err.message });
    }
  });

  // End Meeting / Call for Everyone
  socket.on('end-meeting-for-all', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const peersInRoom = roomPeers.get(roomId);
    const isDirectCall = roomId.startsWith('dm-') || roomId.startsWith('voice-') || (peersInRoom && peersInRoom.size <= 2);

    if (!isDirectCall && !isMainHost(socket)) {
      socket.emit('error-notification', { message: 'Only the meeting host can end the meeting for all participants.' });
      return;
    }

    try {
      await meetingService.updateMeetingStatus(roomId, 'ended', socket.userId);
      chatService.markCallAsEnded(roomId);
      io.in(roomId).emit('meeting-ended', {
        message: 'The call has ended.'
      });
      io.emit('call-session-ended', { roomId });
      logger.info(`Call/Meeting [${roomId}] ended by [${socket.userName}].`);

      // Clean up waiting room if any
      if (waitingRoomPeers.has(roomId)) {
        waitingRoomPeers.get(roomId).forEach((peer, sId) => {
          const s = io.sockets.sockets.get(sId);
          if (s) {
            s.emit('meeting-ended', { message: 'The call has ended.' });
          }
        });
        waitingRoomPeers.delete(roomId);
      }
    } catch (err) {
      socket.emit('error-notification', { message: err.message });
    }
  });

  // =========================================================================
  // Advanced Host & Co-Host Participant Management Handlers
  // =========================================================================

  // 1. Force Mute an Individual Participant
  socket.on('host-mute-participant', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot mute participants.' });
      return;
    }

    const peersInRoom = roomPeers.get(roomId);
    if (!peersInRoom || !peersInRoom.has(targetSocketId)) return;

    const targetPeer = peersInRoom.get(targetSocketId);
    targetPeer.audio = false;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('force-mute-audio', {
        message: `You have been muted by ${socket.userName}.`
      });
    }

    io.in(roomId).emit('peer-media-toggled', {
      socketId: targetSocketId,
      kind: 'audio',
      enabled: false
    });

    logger.info(`Admin [${socket.userName}] muted participant [${targetPeer.userName}] in [${roomId}]`);
  });

  // 2. Force Disable an Individual Participant's Camera
  socket.on('host-disable-video', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot disable cameras.' });
      return;
    }

    const peersInRoom = roomPeers.get(roomId);
    if (!peersInRoom || !peersInRoom.has(targetSocketId)) return;

    const targetPeer = peersInRoom.get(targetSocketId);
    targetPeer.video = false;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('force-disable-video', {
        message: `Your camera has been disabled by ${socket.userName}.`
      });
    }

    io.in(roomId).emit('peer-media-toggled', {
      socketId: targetSocketId,
      kind: 'video',
      enabled: false
    });

    logger.info(`Admin [${socket.userName}] disabled video for [${targetPeer.userName}] in [${roomId}]`);
  });

  // 3. Remove a Participant from Meeting
  socket.on('host-remove-participant', ({ targetSocketId, reason = 'Removed by meeting host' }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot remove participants.' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) return;

    // Safety check: Cannot remove the main host
    if (targetSocket.isHost) {
      socket.emit('error-notification', { message: 'The main meeting host cannot be removed.' });
      return;
    }

    // Safety check: Co-host cannot remove another co-host
    if (socket.isCoHost && targetSocket.isCoHost) {
      socket.emit('error-notification', { message: 'Co-hosts cannot remove other co-hosts.' });
      return;
    }

    const targetName = targetSocket.userName || 'Participant';

    targetSocket.emit('removed-from-meeting', {
      message: reason || 'You have been removed from the meeting by the host.'
    });

    logger.info(`Admin [${socket.userName}] removed participant [${targetName}] from [${roomId}]`);

    // Cleanly disconnect target peer from room
    handlePeerDisconnect(io, targetSocket);
  });

  // 4. Promote Participant to Co-Host (Main Host Only)
  socket.on('host-promote-cohost', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !isMainHost(socket)) {
      socket.emit('error-notification', { message: 'Only the meeting host can assign co-hosts.' });
      return;
    }

    const peersInRoom = roomPeers.get(roomId);
    if (!peersInRoom || !peersInRoom.has(targetSocketId)) return;

    const targetPeer = peersInRoom.get(targetSocketId);
    targetPeer.role = 'co-host';

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.isCoHost = true;
      targetSocket.emit('cohost-status-changed', {
        isCoHost: true,
        message: 'You have been promoted to Co-Host.'
      });
    }

    io.in(roomId).emit('participant-role-changed', {
      socketId: targetSocketId,
      role: 'co-host',
      updatedBy: socket.userName
    });

    chatService.createSystemMessage({
      roomId,
      content: `⭐ ${targetPeer.userName} was promoted to Co-Host by ${socket.userName}`
    }).then((sysMsg) => {
      io.in(roomId).emit('new-message', sysMsg);
    }).catch(() => {});

    logger.info(`Host [${socket.userName}] promoted [${targetPeer.userName}] to co-host in [${roomId}]`);
  });

  // 5. Revoke Co-Host Permissions (Main Host Only)
  socket.on('host-revoke-cohost', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !isMainHost(socket)) {
      socket.emit('error-notification', { message: 'Only the meeting host can revoke co-hosts.' });
      return;
    }

    const peersInRoom = roomPeers.get(roomId);
    if (!peersInRoom || !peersInRoom.has(targetSocketId)) return;

    const targetPeer = peersInRoom.get(targetSocketId);
    targetPeer.role = 'participant';

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.isCoHost = false;
      targetSocket.emit('cohost-status-changed', {
        isCoHost: false,
        message: 'Your Co-Host privileges have been revoked.'
      });
    }

    io.in(roomId).emit('participant-role-changed', {
      socketId: targetSocketId,
      role: 'participant',
      updatedBy: socket.userName
    });

    chatService.createSystemMessage({
      roomId,
      content: `${targetPeer.userName} is now a participant`
    }).then((sysMsg) => {
      io.in(roomId).emit('new-message', sysMsg);
    }).catch(() => {});

    logger.info(`Host [${socket.userName}] revoked co-host status for [${targetPeer.userName}] in [${roomId}]`);
  });

  // 6. Update Room-Wide Permissions (Screen share, Unmute, Video, Whiteboard, Name Change)
  socket.on('host-update-room-permissions', ({ permissions }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot update room permissions.' });
      return;
    }

    const currentPerms = getRoomPermissions(roomId);
    const updated = {
      ...currentPerms,
      ...permissions
    };
    roomPermissions.set(roomId, updated);

    io.in(roomId).emit('room-permissions-updated', {
      permissions: updated,
      updatedBy: socket.userName
    });

    logger.info(`Admin [${socket.userName}] updated room permissions in [${roomId}]: ${JSON.stringify(permissions)}`);
  });

  // =========================================================================
  // Participant Interactive Features (Raise hand, Reactions, Display Name)
  // =========================================================================

  // Raise Hand
  socket.on('raise-hand', () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom && peersInRoom.has(socket.id)) {
      const peer = peersInRoom.get(socket.id);
      peer.isHandRaised = true;
      peer.handRaisedAt = new Date();

      io.in(roomId).emit('participant-hand-toggled', {
        socketId: socket.id,
        userName: socket.userName,
        isHandRaised: true,
        handRaisedAt: peer.handRaisedAt
      });
    }
  });

  // Lower Hand (Self or Admin lowering another participant's hand)
  socket.on('lower-hand', ({ targetSocketId = null } = {}) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const targetId = targetSocketId || socket.id;

    // If lowering someone else's hand, verify admin permissions
    if (targetId !== socket.id && !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot lower other participants hands.' });
      return;
    }

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom && peersInRoom.has(targetId)) {
      const peer = peersInRoom.get(targetId);
      peer.isHandRaised = false;
      peer.handRaisedAt = null;

      io.in(roomId).emit('participant-hand-toggled', {
        socketId: targetId,
        userName: peer.userName,
        isHandRaised: false
      });
    }
  });

  // Lower All Hands (Host / Co-Host)
  socket.on('lower-all-hands', () => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) return;

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom) {
      peersInRoom.forEach((peer) => {
        peer.isHandRaised = false;
        peer.handRaisedAt = null;
      });

      io.in(roomId).emit('all-hands-lowered', {
        updatedBy: socket.userName
      });
    }
  });

  // Change Display Name
  socket.on('change-display-name', ({ newName }) => {
    const roomId = socket.roomId;
    if (!roomId || !newName || typeof newName !== 'string') return;

    const trimmed = newName.trim().substring(0, 32);
    if (trimmed.length === 0) return;

    const perms = getRoomPermissions(roomId);
    if (!perms.allowNameChange && !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Display name changes are disabled for participants in this meeting.' });
      return;
    }

    const oldName = socket.userName;
    socket.userName = trimmed;

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom && peersInRoom.has(socket.id)) {
      peersInRoom.get(socket.id).userName = trimmed;
    }

    io.in(roomId).emit('participant-name-changed', {
      socketId: socket.id,
      oldName,
      newName: trimmed,
      userName: trimmed
    });

    logger.info(`User [${oldName} -> ${trimmed}] updated display name in [${roomId}]`);
  });

  // Live Floating Emoji Reactions
  socket.on('send-reaction', ({ emoji }) => {
    const roomId = socket.roomId;
    if (!roomId || !emoji) return;

    const reactionPayload = {
      id: 'react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      socketId: socket.id,
      userName: socket.userName,
      emoji: String(emoji).substring(0, 8),
      timestamp: Date.now()
    };

    io.in(roomId).emit('reaction-received', reactionPayload);
  });

  // Speaking indicator tracking
  socket.on('speaking-state-changed', ({ isSpeaking }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom && peersInRoom.has(socket.id)) {
      peersInRoom.get(socket.id).isSpeaking = Boolean(isSpeaking);
    }

    socket.to(roomId).emit('peer-speaking-state', {
      socketId: socket.id,
      isSpeaking: Boolean(isSpeaking)
    });
  });

  // Connection State reporting
  socket.on('connection-state-changed', ({ state }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const peersInRoom = roomPeers.get(roomId);
    if (peersInRoom && peersInRoom.has(socket.id)) {
      peersInRoom.get(socket.id).connectionState = state;
    }

    socket.to(roomId).emit('peer-connection-state', {
      socketId: socket.id,
      state
    });
  });

  // =========================================================================
  // WebRTC Signaling Handlers & Permission Checks
  // =========================================================================

  // WebRTC SDP Offer
  socket.on('signal-offer', ({ targetSocketId, sdp }) => {
    io.to(targetSocketId).emit('signal-offer', {
      callerSocketId: socket.id,
      callerUserName: socket.userName,
      sdp
    });
  });

  // WebRTC SDP Answer
  socket.on('signal-answer', ({ targetSocketId, sdp }) => {
    io.to(targetSocketId).emit('signal-answer', {
      responderSocketId: socket.id,
      sdp
    });
  });

  // WebRTC ICE Candidate
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    if (candidate) {
      io.to(targetSocketId).emit('ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    }
  });

  // WebRTC ICE Restart Request
  socket.on('request-ice-restart', ({ targetSocketId }) => {
    io.to(targetSocketId).emit('request-ice-restart', {
      requesterSocketId: socket.id
    });
  });

  // Media toggles with Server-Side Permission Checks
  socket.on('toggle-media', ({ kind, enabled }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const perms = getRoomPermissions(roomId);

    // Permission enforcement: Disallow unmuting if restricted
    if (kind === 'audio' && enabled && !perms.allowParticipantUnmute && !canManageParticipants(socket)) {
      socket.emit('error-notification', {
        message: 'The host has disabled microphone unmuting for participants.'
      });
      return;
    }

    // Permission enforcement: Disallow camera if restricted
    if (kind === 'video' && enabled && !perms.allowParticipantVideo && !canManageParticipants(socket)) {
      socket.emit('error-notification', {
        message: 'The host has disabled camera sharing for participants.'
      });
      return;
    }

    if (roomPeers.has(roomId)) {
      const peer = roomPeers.get(roomId).get(socket.id);
      if (peer) {
        if (kind === 'audio') peer.audio = enabled;
        if (kind === 'video') peer.video = enabled;
      }
      socket.to(roomId).emit('peer-media-toggled', {
        socketId: socket.id,
        kind,
        enabled
      });
    }
  });

  // Screen share request to start presenting (Enforces permissions and single presenter)
  socket.on('start-screen-share', () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const perms = getRoomPermissions(roomId);
    if (!perms.allowScreenShare && !canManageParticipants(socket)) {
      socket.emit('screen-share-rejected', {
        message: 'Screen sharing is restricted to host and co-hosts.'
      });
      return;
    }

    const currentPresenter = roomPresenters.get(roomId);
    if (currentPresenter && currentPresenter.socketId !== socket.id) {
      socket.emit('screen-share-rejected', {
        message: `${currentPresenter.userName} is currently sharing their screen. Only one presenter is allowed at a time.`
      });
      return;
    }

    const presenterInfo = {
      socketId: socket.id,
      userId: socket.userId,
      userName: socket.userName
    };
    roomPresenters.set(roomId, presenterInfo);

    io.in(roomId).emit('presenter-changed', { presenter: presenterInfo });
    socket.to(roomId).emit('peer-screen-toggled', {
      socketId: socket.id,
      userName: socket.userName,
      isSharing: true
    });
    logger.info(`User [${socket.userName}] started presenting in [${roomId}]`);
  });

  // Screen share stop presenting
  socket.on('stop-screen-share', () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const currentPresenter = roomPresenters.get(roomId);
    if (currentPresenter && currentPresenter.socketId === socket.id) {
      roomPresenters.delete(roomId);
      io.in(roomId).emit('presenter-changed', { presenter: null });
      socket.to(roomId).emit('peer-screen-toggled', {
        socketId: socket.id,
        userName: socket.userName,
        isSharing: false
      });
      logger.info(`User [${socket.userName}] stopped presenting in [${roomId}]`);
    }
  });

  // Host / Co-host stops another participant's screen share
  socket.on('host-stop-screen-share', ({ targetSocketId }) => {
    const roomId = socket.roomId;
    if (!roomId || !canManageParticipants(socket)) {
      socket.emit('error-notification', { message: 'Permission denied: Cannot stop participants screen share.' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit('force-stop-screen-share', {
        message: `Your screen sharing was stopped by ${socket.userName}.`
      });
    }

    roomPresenters.delete(roomId);
    io.in(roomId).emit('presenter-changed', { presenter: null });
    io.in(roomId).emit('peer-screen-toggled', {
      socketId: targetSocketId,
      userName: targetSocket ? targetSocket.userName : 'Participant',
      isSharing: false
    });
    logger.info(`Admin [${socket.userName}] stopped screen share for [${targetSocketId}] in [${roomId}]`);
  });

  // Screen share toggle (legacy fallback)
  socket.on('toggle-screen-share', ({ isSharing }) => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.to(roomId).emit('peer-screen-toggled', {
        socketId: socket.id,
        userName: socket.userName,
        isSharing
      });
    }
  });

  // Live Meeting Recording: Start (Host/Co-host)
  socket.on('recording-start', async ({ meetingId }, callback) => {
    const targetRoom = socket.roomId || meetingId;
    if (!targetRoom) return;

    if (!canManageParticipants(socket)) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can start recording.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can start recording.' });
      return;
    }

    try {
      const recording = await recordingService.startRecording({
        meetingId: targetRoom,
        hostId: socket.userId,
        hostName: socket.userName
      });

      io.in(targetRoom).emit('recording-started', {
        recordingId: recording.recordingId,
        hostName: socket.userName,
        startedAt: recording.startedAt,
        message: 'This meeting is being recorded by the host.'
      });

      if (typeof callback === 'function') callback({ success: true, recording });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
      else socket.emit('error-notification', { message: err.message });
    }
  });

  // Live Meeting Recording: Stop (Host/Co-host)
  socket.on('recording-stop', async ({ meetingId, recordingId, duration } = {}, callback) => {
    const targetRoom = socket.roomId || meetingId;
    if (!targetRoom) return;

    if (!canManageParticipants(socket)) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can stop recording.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can stop recording.' });
      return;
    }

    try {
      const stoppedRec = await recordingService.stopRecording({
        meetingId: targetRoom,
        recordingId,
        duration
      });

      const recId = stoppedRec?.recordingId || recordingId;
      io.in(targetRoom).emit('recording-stopped', {
        recordingId: recId,
        stoppedAt: new Date()
      });
      if (typeof callback === 'function') callback({ success: true, recording: stoppedRec });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: err.message });
    }
  });

  // Live Meeting Recording: Participant Consent
  socket.on('recording-consent', async ({ recordingId, consented = true }) => {
    if (!consented) return;
    try {
      await recordingService.recordConsent({
        recordingId,
        meetingId: socket.roomId,
        participant: {
          userId: socket.userId,
          socketId: socket.id,
          name: socket.userName
        }
      });
    } catch {
      // Safe ignore
    }
  });

  // Live Meeting AI Transcription Toggle (Host/Co-host)
  socket.on('transcription-toggle', ({ meetingId, enabled }, callback) => {
    const targetRoom = socket.roomId || meetingId;
    if (!targetRoom) return;

    if (!canManageParticipants(socket)) {
      if (typeof callback === 'function') callback({ success: false, message: 'Only hosts and co-hosts can enable transcription.' });
      else socket.emit('error-notification', { message: 'Only hosts and co-hosts can enable transcription.' });
      return;
    }

    const isEnabled = Boolean(enabled);
    io.in(targetRoom).emit('transcription-status-changed', {
      isTranscribing: isEnabled,
      hostName: socket.userName,
      message: isEnabled
        ? 'Live transcription is enabled. Spoken audio is being processed into text.'
        : 'Live transcription has been disabled.'
    });

    if (typeof callback === 'function') callback({ success: true, isTranscribing: isEnabled });
  });

  // Live Speech Recognition Segment Stream
  socket.on('transcript-segment', async ({ meetingId, text, startTime, endTime }) => {
    const targetRoom = socket.roomId || meetingId;
    if (!targetRoom || !text || text.trim().length === 0) return;

    try {
      const segment = await aiService.appendTranscriptSegment({
        meetingId: targetRoom,
        speakerId: socket.userId || socket.id,
        speakerName: socket.userName || 'Participant',
        text: text.trim(),
        startTime,
        endTime
      });

      if (segment) {
        io.in(targetRoom).emit('transcript-segment-received', {
          meetingId: targetRoom,
          segment
        });
      }
    } catch {
      // Safe ignore
    }
  });

  // Leave Meeting
  socket.on('leave-room', () => {
    handlePeerDisconnect(io, socket);
  });
};

// Helper to admit socket directly to room
const admitSocketToRoom = async (io, socket, rawRoomId) => {
  const roomId = (rawRoomId || socket.roomId || '').toLowerCase().trim();
  socket.roomId = roomId;
  socket.join(roomId);

  if (!roomPeers.has(roomId)) {
    roomPeers.set(roomId, new Map());
  }

  const peersInRoom = roomPeers.get(roomId);
  const perms = getRoomPermissions(roomId);

  // Collect existing participants
  const existingPeers = [];
  peersInRoom.forEach((peer, peerSocketId) => {
    existingPeers.push({
      socketId: peerSocketId,
      userId: peer.userId,
      userName: peer.userName,
      role: peer.role,
      audio: peer.audio ?? true,
      video: peer.video ?? true,
      isHandRaised: Boolean(peer.isHandRaised),
      handRaisedAt: peer.handRaisedAt,
      isSpeaking: Boolean(peer.isSpeaking),
      connectionState: peer.connectionState || 'connected'
    });
  });

  const role = socket.isHost ? 'host' : socket.isCoHost ? 'co-host' : 'participant';

  // Add socket to room map
  peersInRoom.set(socket.id, {
    socketId: socket.id,
    userId: socket.userId,
    userName: socket.userName,
    role,
    audio: true,
    video: true,
    isHandRaised: false,
    handRaisedAt: null,
    isSpeaking: false,
    connectionState: 'connected'
  });

  // Record join in database/store
  meetingService.recordParticipantJoin(roomId, {
    userId: socket.userId,
    name: socket.userName,
    role
  }).catch(() => {});

  logger.info(`User [${socket.userName} (${socket.id})] joined room [${roomId}] as [${role}]. Total in room: ${peersInRoom.size}`);

  // Send existing peers, permissions & current presenter to newly admitted user
  socket.emit('existing-participants', {
    participants: existingPeers,
    participantCount: peersInRoom.size,
    presenter: roomPresenters.get(roomId) || null,
    permissions: perms,
    myRole: role,
    isCoHost: role === 'co-host'
  });

  // Broadcast to other peers that a new user connected
  socket.to(roomId).emit('user-connected', {
    socketId: socket.id,
    userId: socket.userId,
    userName: socket.userName,
    role,
    audio: true,
    video: true,
    isHandRaised: false,
    participantCount: peersInRoom.size
  });

  // If newly admitted user is host/co-host, send any currently waiting participants
  if (canManageParticipants(socket) && waitingRoomPeers.has(roomId)) {
    const waitingList = Array.from(waitingRoomPeers.get(roomId).values());
    if (waitingList.length > 0) {
      socket.emit('waiting-list-updated', { waiting: waitingList });
    }
  }

  // System message for participant joining
  chatService.createSystemMessage({
    roomId,
    content: `${socket.userName} joined the meeting`
  }).then((sysMsg) => {
    io.in(roomId).emit('new-message', sysMsg);
  }).catch(() => {});

  // Inform newly joined participant if meeting is actively being recorded
  recordingService.getActiveRecording(roomId).then((activeRec) => {
    if (activeRec) {
      socket.emit('recording-started', {
        recordingId: activeRec.recordingId,
        hostName: activeRec.hostName,
        startedAt: activeRec.startedAt,
        message: 'This meeting is being recorded by the host.'
      });
    }
  }).catch(() => {});
};

const handlePeerDisconnect = (io, socket) => {
  const roomId = socket.roomId;
  if (!roomId) return;

  // Clean from waiting room if disconnecting from there
  if (waitingRoomPeers.has(roomId)) {
    waitingRoomPeers.get(roomId).delete(socket.id);
  }

  // Clean presenter if disconnecting user was sharing screen
  if (roomPresenters.has(roomId) && roomPresenters.get(roomId).socketId === socket.id) {
    roomPresenters.delete(roomId);
    socket.to(roomId).emit('presenter-changed', { presenter: null });
    logger.info(`Presenter [${socket.userName}] disconnected; screen share cleared for [${roomId}].`);
  }

  if (roomPeers.has(roomId)) {
    const peersInRoom = roomPeers.get(roomId);
    peersInRoom.delete(socket.id);

    // Record leave in database
    meetingService.recordParticipantLeave(roomId, socket.userId || socket.userName).catch(() => {});

    // If it's a 1-on-1 direct call (dm- or voice-), ending by either party terminates the call
    const isDirectCall = roomId.startsWith('dm-') || roomId.startsWith('voice-');
    if (isDirectCall) {
      meetingService.updateMeetingStatus(roomId, 'ended', socket.userId).catch(() => {});
      chatService.markCallAsEnded(roomId).catch(() => {});
      socket.to(roomId).emit('meeting-ended', {
        message: 'The call has ended.'
      });
      io.emit('call-session-ended', { roomId });
    }

    if (peersInRoom.size === 0) {
      roomPeers.delete(roomId);
      roomPermissions.delete(roomId);
      meetingService.updateMeetingStatus(roomId, 'ended').catch(() => {});
      chatService.markCallAsEnded(roomId).catch(() => {});
      io.emit('call-session-ended', { roomId });
      logger.info(`Room [${roomId}] is now empty and cleaned up.`);
    } else {
      logger.info(`User [${socket.userName} (${socket.id})] left room [${roomId}]. Remaining: ${peersInRoom.size}`);
    }

    socket.to(roomId).emit('user-disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      userName: socket.userName,
      participantCount: peersInRoom.size
    });

    // System message for participant leaving
    chatService.createSystemMessage({
      roomId,
      content: `${socket.userName} left the meeting`
    }).then((sysMsg) => {
      socket.to(roomId).emit('new-message', sysMsg);
    }).catch(() => {});
  }

  socket.leave(roomId);
  socket.roomId = null;
};

module.exports = {
  registerWebRTCSignaling,
  handlePeerDisconnect
};
