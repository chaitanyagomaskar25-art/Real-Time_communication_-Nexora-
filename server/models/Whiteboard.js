const mongoose = require('mongoose');

const whiteboardElementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['pencil', 'eraser', 'line', 'rectangle', 'circle', 'arrow', 'text'],
      required: true
    },
    points: [{ x: Number, y: Number }],
    startX: { type: Number },
    startY: { type: Number },
    endX: { type: Number },
    endY: { type: Number },
    text: { type: String },
    color: { type: String, default: '#3b82f6' },
    size: { type: Number, default: 3 },
    userId: { type: String, default: 'anonymous' },
    userName: { type: String, default: 'Participant' },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const whiteboardSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    elements: [whiteboardElementSchema],
    undoStack: [whiteboardElementSchema],
    isLocked: {
      type: Boolean,
      default: false
    },
    lastSnapshot: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Whiteboard = mongoose.model('Whiteboard', whiteboardSchema);

module.exports = Whiteboard;

