const mongoose = require('mongoose');
const MeetingPoll = require('../models/MeetingPoll');
const logger = require('../utils/logger');

// In-memory fallback: pollId -> poll object
const inMemoryPolls = new Map();

class PollService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Create a new poll
  async createPoll(meetingId, { question, options, isAnonymous = false }, creator) {
    if (!meetingId) throw new Error('Meeting ID is required.');
    if (!question || !question.trim()) throw new Error('Poll question is required.');

    const cleanOptions = Array.isArray(options)
      ? options
          .map((opt, idx) => ({
            id: 'opt_' + (idx + 1),
            text: typeof opt === 'string' ? opt.trim() : opt.text?.trim() || '',
            votes: []
          }))
          .filter((opt) => opt.text.length > 0)
      : [];

    if (cleanOptions.length < 2) {
      throw new Error('A poll must have at least 2 options.');
    }

    const pollId = 'poll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const creatorName = creator?.fullName || creator?.name || 'Host';
    const creatorId = creator?.id || creator?._id || null;

    if (this.isDbConnected()) {
      try {
        const poll = await MeetingPoll.create({
          pollId,
          meetingId,
          creatorId: creatorId ? creatorId.toString() : null,
          creatorName,
          question: question.trim(),
          options: cleanOptions,
          isAnonymous: Boolean(isAnonymous),
          isActive: true
        });

        return poll.toSafeObject(creatorId);
      } catch (err) {
        logger.warn(`createPoll DB error: ${err.message}`);
      }
    }

    const memPoll = {
      pollId,
      meetingId,
      creatorId: creatorId ? creatorId.toString() : null,
      creatorName,
      question: question.trim(),
      options: cleanOptions,
      isAnonymous: Boolean(isAnonymous),
      isActive: true,
      createdAt: new Date(),
      endedAt: null,
      toSafeObject(currentUserId = null) {
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
      }
    };

    inMemoryPolls.set(pollId, memPoll);
    return memPoll.toSafeObject(creatorId);
  }

  // Vote on a poll (prevents duplicate voting)
  async votePoll(meetingId, pollId, optionId, voterId) {
    if (!pollId || !optionId || !voterId) {
      throw new Error('Poll ID, Option ID, and Voter ID are required.');
    }
    const voterStr = voterId.toString();

    if (this.isDbConnected()) {
      try {
        const poll = await MeetingPoll.findOne({ pollId, meetingId });
        if (!poll) throw new Error('Poll not found.');
        if (!poll.isActive) throw new Error('This poll is closed.');

        // Remove any prior votes by this voter across all options
        poll.options.forEach((opt) => {
          opt.votes = opt.votes.filter((id) => id !== voterStr);
        });

        const targetOpt = poll.options.find((opt) => opt.id === optionId);
        if (!targetOpt) throw new Error('Selected option does not exist.');

        targetOpt.votes.push(voterStr);
        await poll.save();

        return poll.toSafeObject(voterId);
      } catch (err) {
        if (err.message.includes('Poll not found') || err.message.includes('closed') || err.message.includes('Selected option')) {
          throw err;
        }
      }
    }

    const memPoll = inMemoryPolls.get(pollId);
    if (!memPoll || memPoll.meetingId !== meetingId) throw new Error('Poll not found.');
    if (!memPoll.isActive) throw new Error('This poll is closed.');

    memPoll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((id) => id !== voterStr);
    });

    const targetOpt = memPoll.options.find((opt) => opt.id === optionId);
    if (!targetOpt) throw new Error('Selected option does not exist.');

    targetOpt.votes.push(voterStr);
    return memPoll.toSafeObject(voterId);
  }

  // Get all polls for a meeting
  async getMeetingPolls(meetingId, voterId = null) {
    if (!meetingId) return [];

    if (this.isDbConnected()) {
      try {
        const polls = await MeetingPoll.find({ meetingId }).sort({ createdAt: -1 });
        return polls.map((p) => p.toSafeObject(voterId));
      } catch (err) {
        logger.warn(`getMeetingPolls DB error: ${err.message}`);
      }
    }

    const results = [];
    for (const p of inMemoryPolls.values()) {
      if (p.meetingId === meetingId) {
        results.push(p.toSafeObject(voterId));
      }
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // End / Close a poll (Host action)
  async endPoll(meetingId, pollId) {
    if (this.isDbConnected()) {
      try {
        const poll = await MeetingPoll.findOne({ pollId, meetingId });
        if (poll) {
          poll.isActive = false;
          poll.endedAt = new Date();
          await poll.save();
          return poll.toSafeObject();
        }
      } catch (err) {
        // Fallback
      }
    }

    const memPoll = inMemoryPolls.get(pollId);
    if (memPoll && memPoll.meetingId === meetingId) {
      memPoll.isActive = false;
      memPoll.endedAt = new Date();
      return memPoll.toSafeObject();
    }

    throw new Error('Poll not found.');
  }
}

const pollService = new PollService();
module.exports = pollService;

