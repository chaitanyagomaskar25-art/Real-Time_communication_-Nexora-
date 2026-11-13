const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      trim: true
    },
    title: {
      type: String,
      default: 'ConnectSphere Meeting',
      trim: true
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hostName: {
      type: String,
      default: 'Host'
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    isCleared: {
      type: Boolean,
      default: false
    },
    clearedAt: {
      type: Date,
      default: null
    },
    maxParticipants: {
      type: Number,
      default: 20
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        name: {
          type: String,
          required: true
        },
        joinedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Room', roomSchema);

