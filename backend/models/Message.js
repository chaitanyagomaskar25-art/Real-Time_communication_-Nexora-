const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: null,
      index: true
    },
    clientTempId: {
      type: String,
      default: null,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      index: true
    },
    senderId: {
      type: String,
      default: '',
      index: true
    },
    senderName: {
      type: String,
      required: true
    },
    senderAvatar: {
      type: String,
      default: ''
    },
    content: {
      type: String,
      default: '',
      trim: true
    },
    file: {
      name: { type: String, default: null },
      size: { type: Number, default: 0 },
      type: { type: String, default: null },
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      storageProvider: { type: String, default: 'local' }
    },
    isPrivate: {
      type: Boolean,
      default: false,
      index: true
    },
    recipientId: {
      type: String,
      default: null,
      index: true
    },
    recipientName: {
      type: String,
      default: null
    },
    replyTo: {
      messageId: { type: String, default: null },
      senderName: { type: String, default: null },
      content: { type: String, default: null }
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [
          {
            userId: { type: String, required: true },
            userName: { type: String, required: true }
          }
        ]
      }
    ],
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    messageType: {
      type: String,
      enum: ['user', 'system'],
      default: 'user'
    },
    isCallEnded: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['sent', 'delivered'],
      default: 'delivered'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Composite indexes for fast room message pagination and private message filtering
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, isPrivate: 1, recipientId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
