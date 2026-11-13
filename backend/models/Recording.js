const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema(
  {
    recordingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    meetingId: {
      type: String,
      required: true,
      index: true
    },
    meetingTitle: {
      type: String,
      default: 'Meeting Recording'
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    hostName: {
      type: String,
      default: 'Meeting Host'
    },
    storageProvider: {
      type: String,
      enum: ['local', 'cloudinary', 's3'],
      default: 'local'
    },
    storagePath: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      default: 'recording.webm'
    },
    fileSize: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: 'video/webm'
    },
    duration: {
      type: Number, // in seconds
      default: 0
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['recording', 'processing', 'ready', 'failed'],
      default: 'recording',
      index: true
    },
    participantsConsent: [
      {
        userId: String,
        socketId: String,
        name: String,
        consentedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    accessSettings: {
      isPublic: {
        type: Boolean,
        default: false
      },
      allowedRoles: {
        type: [String],
        default: ['host', 'participant']
      },
      allowedUsers: {
        type: [String],
        default: []
      }
    }
  },
  {
    timestamps: true
  }
);

recordingSchema.methods.toSafeObject = function (requestingUserId) {
  const isHost = this.host && requestingUserId && this.host.toString() === requestingUserId.toString();
  return {
    id: this._id ? this._id.toString() : this.recordingId,
    recordingId: this.recordingId,
    meetingId: this.meetingId,
    meetingTitle: this.meetingTitle,
    hostName: this.hostName,
    isHost,
    fileSize: this.fileSize,
    mimeType: this.mimeType,
    duration: this.duration,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    status: this.status,
    consentCount: this.participantsConsent?.length || 0,
    accessSettings: this.accessSettings,
    streamUrl: `/api/recordings/${this.recordingId}/stream`,
    downloadUrl: `/api/recordings/${this.recordingId}/download`,
    createdAt: this.createdAt
  };
};

// Compound indexes for user library and in-room recording lookups
recordingSchema.index({ host: 1, createdAt: -1 });
recordingSchema.index({ meetingId: 1, createdAt: -1 });

module.exports = mongoose.model('Recording', recordingSchema);

