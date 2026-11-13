const mongoose = require('mongoose');

const transcriptSegmentSchema = new mongoose.Schema(
  {
    segmentId: {
      type: String,
      required: true
    },
    speakerId: {
      type: String,
      default: 'speaker_unknown'
    },
    speakerName: {
      type: String,
      default: 'Participant'
    },
    speakerAvatar: {
      type: String,
      default: ''
    },
    text: {
      type: String,
      required: true
    },
    startTime: {
      type: Number, // Offset in seconds from meeting start
      default: 0
    },
    endTime: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const meetingTranscriptSchema = new mongoose.Schema(
  {
    transcriptId: {
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
    language: {
      type: String,
      default: 'en'
    },
    isLive: {
      type: Boolean,
      default: true
    },
    segments: [transcriptSegmentSchema]
  },
  {
    timestamps: true
  }
);

meetingTranscriptSchema.methods.toSafeObject = function () {
  return {
    transcriptId: this.transcriptId,
    meetingId: this.meetingId,
    language: this.language,
    isLive: this.isLive,
    segments: this.segments || [],
    totalSegments: this.segments?.length || 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('MeetingTranscript', meetingTranscriptSchema);

