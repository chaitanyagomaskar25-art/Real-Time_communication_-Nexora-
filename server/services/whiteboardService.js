const mongoose = require('mongoose');
const Whiteboard = require('../models/Whiteboard');
const logger = require('../utils/logger');

// In-memory fallback map: meetingId -> { elements: [], undoStack: [], isLocked: false }
const inMemoryWhiteboards = new Map();

class WhiteboardService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  getMemoryBoard(meetingId) {
    const cleanId = meetingId.toLowerCase().trim();
    if (!inMemoryWhiteboards.has(cleanId)) {
      inMemoryWhiteboards.set(cleanId, {
        elements: [],
        undoStack: [],
        isLocked: false,
        lastSnapshot: ''
      });
    }
    return inMemoryWhiteboards.get(cleanId);
  }

  /**
   * Get or initialize whiteboard state for a meeting
   */
  async getWhiteboard(meetingId) {
    const cleanId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        let board = await Whiteboard.findOne({ meetingId: cleanId });
        if (!board) {
          board = await Whiteboard.create({
            meetingId: cleanId,
            elements: [],
            undoStack: [],
            isLocked: false
          });
        }

        const boardObj = board.toObject();
        // Update memory cache
        inMemoryWhiteboards.set(cleanId, {
          elements: boardObj.elements || [],
          undoStack: boardObj.undoStack || [],
          isLocked: Boolean(boardObj.isLocked),
          lastSnapshot: boardObj.lastSnapshot || ''
        });

        return {
          elements: boardObj.elements || [],
          isLocked: Boolean(boardObj.isLocked),
          lastSnapshot: boardObj.lastSnapshot || ''
        };
      } catch (err) {
        logger.warn(`Whiteboard MongoDB fetch error, using memory state: ${err.message}`);
      }
    }

    const mem = this.getMemoryBoard(cleanId);
    return {
      elements: mem.elements,
      isLocked: mem.isLocked,
      lastSnapshot: mem.lastSnapshot
    };
  }

  /**
   * Add a newly committed drawing element
   */
  async addElement(meetingId, element) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);

    // Append element and clear redo stack
    mem.elements.push(element);
    mem.undoStack = [];

    // Async persist to MongoDB
    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          {
            $push: { elements: element },
            $set: { undoStack: [] }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB addElement error: ${err.message}`);
      }
    }

    return element;
  }

  /**
   * Undo last drawing action
   */
  async undo(meetingId, userId, isHost = false) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);

    if (mem.elements.length === 0) return null;

    let targetIndex = -1;
    if (isHost) {
      targetIndex = mem.elements.length - 1;
    } else {
      // Find last element created by this user
      for (let i = mem.elements.length - 1; i >= 0; i--) {
        if (mem.elements[i].userId === userId) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) return null;

    const [removed] = mem.elements.splice(targetIndex, 1);
    mem.undoStack.push(removed);

    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          {
            $set: { elements: mem.elements },
            $push: { undoStack: removed }
          }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB undo error: ${err.message}`);
      }
    }

    return {
      removedElement: removed,
      remainingElements: mem.elements
    };
  }

  /**
   * Redo previously undone element
   */
  async redo(meetingId, userId, isHost = false) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);

    if (mem.undoStack.length === 0) return null;

    let targetIndex = -1;
    if (isHost) {
      targetIndex = mem.undoStack.length - 1;
    } else {
      for (let i = mem.undoStack.length - 1; i >= 0; i--) {
        if (mem.undoStack[i].userId === userId) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) return null;

    const [restored] = mem.undoStack.splice(targetIndex, 1);
    mem.elements.push(restored);

    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          {
            $set: { undoStack: mem.undoStack },
            $push: { elements: restored }
          }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB redo error: ${err.message}`);
      }
    }

    return {
      restoredElement: restored,
      currentElements: mem.elements
    };
  }

  /**
   * Clear all drawing elements from canvas
   */
  async clearWhiteboard(meetingId) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);

    mem.undoStack.push(...mem.elements);
    mem.elements = [];

    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          {
            $set: { elements: [] },
            $push: { undoStack: { $each: mem.undoStack } }
          }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB clear error: ${err.message}`);
      }
    }

    return { success: true };
  }

  /**
   * Toggle drawing lock (Host only)
   */
  async toggleLock(meetingId, isLocked) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);
    mem.isLocked = Boolean(isLocked);

    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          { $set: { isLocked: mem.isLocked } },
          { upsert: true }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB toggleLock error: ${err.message}`);
      }
    }

    return mem.isLocked;
  }

  /**
   * Save periodic snapshot
   */
  async saveSnapshot(meetingId, snapshotData) {
    const cleanId = meetingId.toLowerCase().trim();
    const mem = this.getMemoryBoard(cleanId);
    mem.lastSnapshot = snapshotData;

    if (this.isDbConnected()) {
      try {
        await Whiteboard.findOneAndUpdate(
          { meetingId: cleanId },
          { $set: { lastSnapshot: snapshotData } }
        );
      } catch (err) {
        logger.warn(`Whiteboard MongoDB saveSnapshot error: ${err.message}`);
      }
    }
  }
}

module.exports = new WhiteboardService();

