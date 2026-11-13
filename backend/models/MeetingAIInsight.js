const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    assigneeId: {
      type: String,
      default: ''
    },
    assigneeName: {
      type: String,
      default: 'Unassigned'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    dueDate: {
      type: Date
    },
    completedAt: {
      type: Date
    }
  },
  { _id: false }
);

const meetingAIInsightSchema = new mongoose.Schema(
  {
    insightId: {
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
    summary: {
      type: String,
      default: ''
    },
    keyPoints: {
      type: [String],
      default: []
    },
    decisions: {
      type: [String],
      default: []
    },
    topics: {
      type: [String],
      default: []
    },
    actionItems: [actionItemSchema],
    duration: {
      type: Number, // in seconds
      default: 0
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

meetingAIInsightSchema.methods.toSafeObject = function () {
  const completedCount = this.actionItems?.filter((t) => t.status === 'completed').length || 0;
  const totalCount = this.actionItems?.length || 0;

  return {
    insightId: this.insightId,
    meetingId: this.meetingId,
    summary: this.summary,
    keyPoints: this.keyPoints || [],
    decisions: this.decisions || [],
    topics: this.topics || [],
    actionItems: this.actionItems || [],
    duration: this.duration,
    stats: {
      totalActionItems: totalCount,
      completedActionItems: completedCount,
      pendingActionItems: totalCount - completedCount,
      completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    },
    generatedAt: this.generatedAt,
    updatedAt: this.updatedAt
  };
};

// Index for quick insight retrieval by meetingId
meetingAIInsightSchema.index({ meetingId: 1, createdAt: -1 });

module.exports = mongoose.model('MeetingAIInsight', meetingAIInsightSchema);

