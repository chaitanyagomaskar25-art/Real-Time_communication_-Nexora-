const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    votes: {
      type: [String], // user IDs or socket IDs who voted for this option
      default: []
    }
  },
  { _id: false }
);

const meetingPollSchema = new mongoose.Schema(
  {
    pollId: {
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
    creatorId: {
      type: String,
      default: null
    },
    creatorName: {
      type: String,
      default: 'Host'
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    options: [pollOptionSchema],
    isAnonymous: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    endedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Format safe poll object for clients with calculated percentages and vote counts
meetingPollSchema.methods.toSafeObject = function (currentUserId = null) {
  let totalVotes = 0;
  const optionsWithStats = (this.options || []).map((opt) => {
    const count = opt.votes ? opt.votes.length : 0;
    totalVotes += count;
    const hasVotedThis = currentUserId && opt.votes && opt.votes.includes(currentUserId.toString());
    return {
      id: opt.id,
      text: opt.text,
      voteCount: count,
      hasVoted: Boolean(hasVotedThis)
    };
  });

  const optionsWithPercentages = optionsWithStats.map((opt) => ({
    ...opt,
    percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0
  }));

  const userHasVoted = Boolean(
    currentUserId &&
      this.options &&
      this.options.some((opt) => opt.votes && opt.votes.includes(currentUserId.toString()))
  );

  return {
    pollId: this.pollId,
    meetingId: this.meetingId,
    creatorId: this.creatorId,
    creatorName: this.creatorName,
    question: this.question,
    options: optionsWithPercentages,
    totalVotes,
    userHasVoted,
    isAnonymous: this.isAnonymous,
    isActive: this.isActive,
    createdAt: this.createdAt,
    endedAt: this.endedAt
  };
};

// Compound index for chronological poll retrieval in meetings
meetingPollSchema.index({ meetingId: 1, createdAt: -1 });

module.exports = mongoose.model('MeetingPoll', meetingPollSchema);

