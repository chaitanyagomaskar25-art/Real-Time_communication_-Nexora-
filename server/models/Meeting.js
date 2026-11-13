const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const meetingParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      default: '',
      trim: true
    },
    avatar: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['host', 'co-host', 'participant'],
      default: 'participant'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const meetingInviteeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const meetingReminderSchema = new mongoose.Schema(
  {
    minutesBefore: {
      type: Number,
      default: 15
    },
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const meetingReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      default: () => 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reporterName: {
      type: String,
      default: 'Anonymous'
    },
    reason: {
      type: String,
      required: true,
      enum: ['harassment', 'inappropriate_content', 'spam', 'security_violation', 'other'],
      default: 'other'
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'dismissed'],
      default: 'pending'
    },
    resolutionNotes: {
      type: String,
      default: ''
    },
    resolvedBy: {
      type: String,
      default: ''
    },
    reportedAt: {
      type: Date,
      default: Date.now
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: [true, 'Meeting ID is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      default: 'ConnectSphere Meeting',
      trim: true,
      maxlength: [120, 'Meeting title cannot exceed 120 characters']
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hostName: {
      type: String,
      required: true,
      default: 'Host'
    },
    hostEmail: {
      type: String,
      default: ''
    },
    participants: [meetingParticipantSchema],
    invitees: [meetingInviteeSchema],
    reminders: {
      type: [meetingReminderSchema],
      default: () => [{ minutesBefore: 15, sent: false, sentAt: null }]
    },
    recurrence: {
      type: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none'
      },
      interval: {
        type: Number,
        default: 1
      },
      endDate: {
        type: Date,
        default: null
      }
    },
    isPasswordProtected: {
      type: Boolean,
      default: false
    },
    password: {
      type: String,
      select: false,
      default: null
    },
    scheduledDate: {
      type: Date,
      default: null
    },
    scheduledTime: {
      type: String,
      default: ''
    },
    duration: {
      type: Number, // Duration in minutes
      default: 30
    },
    startTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'active'
    },
    isScheduled: {
      type: Boolean,
      default: false,
      index: true
    },
    meetingType: {
      type: String,
      enum: ['scheduled', 'instant', 'chat_call'],
      default: 'instant',
      index: true
    },
    settings: {
      waitingRoomEnabled: {
        type: Boolean,
        default: false
      },
      isLocked: {
        type: Boolean,
        default: false
      },
      muteOnEntry: {
        type: Boolean,
        default: false
      },
      videoOffOnEntry: {
        type: Boolean,
        default: false
      },
      allowScreenShare: {
        type: Boolean,
        default: true
      },
      allowChat: {
        type: Boolean,
        default: true
      }
    },
    isReported: {
      type: Boolean,
      default: false,
      index: true
    },
    reports: [meetingReportSchema],
    isTerminatedByAdmin: {
      type: Boolean,
      default: false,
      index: true
    },
    adminTerminationReason: {
      type: String,
      default: ''
    },
    terminatedByAdminAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Hash password with bcrypt if provided and modified
meetingSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password && this.password.trim().length > 0) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.isPasswordProtected = true;
  }
  next();
});

// Compare entered password with hashed meeting password
meetingSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return true;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Safe object representation for responses
meetingSchema.methods.toSafeObject = function (currentUserId = null) {
  const isHost = currentUserId && this.host && this.host.toString() === currentUserId.toString();
  const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${this.meetingId}`;

  return {
    id: this._id ? this._id.toString() : this.id,
    meetingId: this.meetingId,
    roomId: this.meetingId, // alias for backwards compatibility
    title: this.title,
    description: this.description || '',
    timezone: this.timezone || 'UTC',
    host: this.host,
    hostName: this.hostName,
    hostEmail: this.hostEmail,
    isHost: Boolean(isHost),
    isPasswordProtected: Boolean(this.isPasswordProtected),
    scheduledDate: this.scheduledDate,
    scheduledTime: this.scheduledTime,
    duration: this.duration,
    durationMinutes: this.duration,
    startTime: this.startTime,
    endTime: this.endTime,
    status: this.status,
    isScheduled: Boolean(this.isScheduled || this.scheduledDate || this.scheduledTime),
    meetingType: this.meetingType || (this.scheduledDate ? 'scheduled' : 'instant'),
    settings: this.settings || {
      waitingRoomEnabled: false,
      isLocked: false,
      muteOnEntry: false,
      videoOffOnEntry: false,
      allowScreenShare: true,
      allowChat: true
    },
    invitees: this.invitees || [],
    reminders: this.reminders || [],
    recurrence: this.recurrence || { type: 'none', interval: 1, endDate: null },
    isReported: Boolean(this.isReported),
    reportsCount: this.reports ? this.reports.length : 0,
    reports: this.reports || [],
    isTerminatedByAdmin: Boolean(this.isTerminatedByAdmin),
    adminTerminationReason: this.adminTerminationReason || '',
    inviteLink,
    participantCount: this.participants ? this.participants.filter((p) => !p.leftAt).length : 0,
    participants: this.participants || [],
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Compound indexes for scheduling, status queries, invitees, and reporting
meetingSchema.index({ host: 1, scheduledDate: -1 });
meetingSchema.index({ host: 1, status: 1 });
meetingSchema.index({ 'invitees.email': 1, status: 1 });
meetingSchema.index({ status: 1, scheduledDate: 1 });
meetingSchema.index({ createdAt: -1 });
meetingSchema.index({ isReported: 1, createdAt: -1 });

module.exports = mongoose.model('Meeting', meetingSchema);
