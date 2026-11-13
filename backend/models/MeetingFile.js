const mongoose = require('mongoose');

const meetingFileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    meetingId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    uploaderId: {
      type: String,
      required: true,
      index: true
    },
    uploaderName: {
      type: String,
      required: true,
      default: 'Participant'
    },
    uploaderAvatar: {
      type: String,
      default: ''
    },
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    fileName: {
      type: String,
      required: true
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
    fileUrl: {
      type: String,
      default: ''
    },
    mimeType: {
      type: String,
      required: true
    },
    extension: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret.fileId || ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for fast in-meeting file listing
meetingFileSchema.index({ meetingId: 1, isDeleted: 1, createdAt: -1 });

const MeetingFile = mongoose.model('MeetingFile', meetingFileSchema);

module.exports = MeetingFile;

