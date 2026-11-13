const mongoose = require('mongoose');

const meetingNoteSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    content: {
      type: String,
      default: ''
    },
    lastEditedBy: {
      type: String,
      default: 'Participant'
    },
    lastEditedById: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MeetingNote', meetingNoteSchema);

