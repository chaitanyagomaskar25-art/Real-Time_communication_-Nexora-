const mongoose = require('mongoose');
const MeetingNote = require('../models/MeetingNote');
const logger = require('../utils/logger');

// In-memory fallback: meetingId -> note object
const inMemoryNotes = new Map();

class NotesService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Get shared notes for a meeting
  async getNotes(meetingId) {
    if (!meetingId) return { content: '', lastEditedBy: null, updatedAt: null };

    if (this.isDbConnected()) {
      try {
        const note = await MeetingNote.findOne({ meetingId });
        if (note) {
          return {
            meetingId: note.meetingId,
            content: note.content || '',
            lastEditedBy: note.lastEditedBy,
            lastEditedById: note.lastEditedById,
            updatedAt: note.updatedAt
          };
        }
      } catch (err) {
        logger.warn(`getNotes DB error: ${err.message}`);
      }
    }

    if (inMemoryNotes.has(meetingId)) {
      return inMemoryNotes.get(meetingId);
    }

    return {
      meetingId,
      content: '',
      lastEditedBy: null,
      lastEditedById: null,
      updatedAt: null
    };
  }

  // Save / Auto-save shared notes
  async saveNotes(meetingId, content, user) {
    if (!meetingId) throw new Error('Meeting ID is required.');
    const userName = user?.fullName || user?.name || 'Participant';
    const userId = user?.id || user?._id || null;

    if (this.isDbConnected()) {
      try {
        const updated = await MeetingNote.findOneAndUpdate(
          { meetingId },
          {
            content: content || '',
            lastEditedBy: userName,
            lastEditedById: userId ? userId.toString() : null
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return {
          meetingId: updated.meetingId,
          content: updated.content,
          lastEditedBy: updated.lastEditedBy,
          lastEditedById: updated.lastEditedById,
          updatedAt: updated.updatedAt
        };
      } catch (err) {
        logger.warn(`saveNotes DB error: ${err.message}`);
      }
    }

    const memNote = {
      meetingId,
      content: content || '',
      lastEditedBy: userName,
      lastEditedById: userId ? userId.toString() : null,
      updatedAt: new Date()
    };
    inMemoryNotes.set(meetingId, memNote);
    return memNote;
  }
}

const notesService = new NotesService();
module.exports = notesService;

