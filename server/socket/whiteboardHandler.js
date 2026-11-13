const whiteboardService = require('../services/whiteboardService');
const logger = require('../utils/logger');

const registerWhiteboardHandler = (io, socket) => {
  // 1. Initial State Request
  socket.on('whiteboard-init', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    try {
      const state = await whiteboardService.getWhiteboard(roomId);
      socket.emit('whiteboard-state', state);
    } catch (err) {
      logger.error(`Error loading whiteboard state for [${roomId}]: ${err.message}`);
    }
  });

  // 2. Real-Time Drawing Start (in-progress shape/pencil)
  socket.on('whiteboard-draw-start', async ({ element }) => {
    const roomId = socket.roomId;
    if (!roomId || !element) return;

    const board = await whiteboardService.getWhiteboard(roomId);
    if (board.isLocked && !socket.isHost && !socket.isCoHost) {
      socket.emit('whiteboard-error', { message: 'Whiteboard is currently locked by the host.' });
      return;
    }

    socket.to(roomId).emit('whiteboard-draw-start', {
      element,
      userId: socket.userId || socket.id,
      userName: socket.userName || 'Participant'
    });
  });

  // 3. Real-Time Drawing Step (point streaming for freehand strokes)
  socket.on('whiteboard-draw-step', ({ elementId, point }) => {
    const roomId = socket.roomId;
    if (!roomId || !elementId || !point) return;

    socket.to(roomId).emit('whiteboard-draw-step', {
      elementId,
      point,
      userId: socket.userId || socket.id
    });
  });

  // 4. Commit Finished Drawing Element
  socket.on('whiteboard-draw-end', async ({ element }) => {
    const roomId = socket.roomId;
    if (!roomId || !element) return;

    const board = await whiteboardService.getWhiteboard(roomId);
    if (board.isLocked && !socket.isHost && !socket.isCoHost) {
      socket.emit('whiteboard-error', { message: 'Whiteboard is currently locked by the host.' });
      return;
    }

    try {
      const savedElement = {
        ...element,
        userId: socket.userId || socket.id,
        userName: socket.userName || 'Participant',
        timestamp: new Date()
      };

      await whiteboardService.addElement(roomId, savedElement);

      // Broadcast committed element to other participants
      socket.to(roomId).emit('whiteboard-draw-end', { element: savedElement });
    } catch (err) {
      logger.error(`Error saving drawing element in room [${roomId}]: ${err.message}`);
    }
  });

  // 5. Live Peer Cursor Tracking
  socket.on('whiteboard-cursor', ({ x, y }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    socket.to(roomId).emit('whiteboard-cursor', {
      x,
      y,
      userId: socket.userId || socket.id,
      userName: socket.userName || 'Participant'
    });
  });

  // 6. Undo Action
  socket.on('whiteboard-undo', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    try {
      const result = await whiteboardService.undo(roomId, socket.userId || socket.id, socket.isHost);
      if (result) {
        io.in(roomId).emit('whiteboard-sync', { elements: result.remainingElements });
      }
    } catch (err) {
      logger.error(`Whiteboard undo error in room [${roomId}]: ${err.message}`);
    }
  });

  // 7. Redo Action
  socket.on('whiteboard-redo', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    try {
      const result = await whiteboardService.redo(roomId, socket.userId || socket.id, socket.isHost);
      if (result) {
        io.in(roomId).emit('whiteboard-sync', { elements: result.currentElements });
      }
    } catch (err) {
      logger.error(`Whiteboard redo error in room [${roomId}]: ${err.message}`);
    }
  });

  // 8. Clear Board Action
  socket.on('whiteboard-clear', async () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const board = await whiteboardService.getWhiteboard(roomId);
    if (board.isLocked && !socket.isHost && !socket.isCoHost) {
      socket.emit('whiteboard-error', { message: 'Only the host or co-host can clear a locked whiteboard.' });
      return;
    }

    try {
      await whiteboardService.clearWhiteboard(roomId);
      io.in(roomId).emit('whiteboard-cleared');
    } catch (err) {
      logger.error(`Whiteboard clear error in room [${roomId}]: ${err.message}`);
    }
  });

  // 9. Toggle Drawing Lock (Host / Co-Host)
  socket.on('whiteboard-toggle-lock', async ({ isLocked }) => {
    const roomId = socket.roomId;
    if (!roomId || (!socket.isHost && !socket.isCoHost)) return;

    try {
      const lockedStatus = await whiteboardService.toggleLock(roomId, isLocked);
      io.in(roomId).emit('whiteboard-lock-status', { isLocked: lockedStatus });
    } catch (err) {
      logger.error(`Whiteboard toggle-lock error in room [${roomId}]: ${err.message}`);
    }
  });

  // 10. Save Periodic Snapshot
  socket.on('whiteboard-save-snapshot', async ({ snapshot }) => {
    const roomId = socket.roomId;
    if (!roomId || !snapshot) return;

    try {
      await whiteboardService.saveSnapshot(roomId, snapshot);
    } catch (err) {
      logger.warn(`Failed to save whiteboard snapshot: ${err.message}`);
    }
  });
};

module.exports = {
  registerWhiteboardHandler
};

