const aiService = require('../services/aiService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * 1. Get Live or Stored Transcript for a meeting
 */
const getTranscript = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const transcript = await aiService.getTranscript(meetingId);
    return sendSuccess(res, 200, 'Meeting transcript retrieved', transcript);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Append a speech transcript segment
 */
const appendTranscriptSegment = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { text, startTime, endTime } = req.body;

    const speakerId = req.user ? (req.user.id || req.user._id) : req.body.speakerId;
    const speakerName = req.user ? (req.user.fullName || req.user.username) : (req.body.speakerName || 'Speaker');
    const speakerAvatar = req.user ? req.user.profileImage : '';

    const segment = await aiService.appendTranscriptSegment({
      meetingId,
      speakerId,
      speakerName,
      speakerAvatar,
      text,
      startTime,
      endTime
    });

    // Broadcast live transcript segment to all room participants
    const io = req.app.get('io');
    if (io && segment) {
      io.in(meetingId.toLowerCase().trim()).emit('transcript-segment-received', {
        meetingId,
        segment
      });
    }

    return sendSuccess(res, 201, 'Transcript segment appended', segment);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Generate or re-generate AI meeting summary & insights
 */
const generateSummary = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const insights = await aiService.generateMeetingSummary(meetingId);

    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('ai-insights-updated', insights);
    }

    return sendSuccess(res, 200, 'AI meeting summary & insights generated', insights);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get meeting insights (Summary, decisions, topics, duration)
 */
const getInsights = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const insights = await aiService.getMeetingInsights(meetingId);
    return sendSuccess(res, 200, 'Meeting insights retrieved', insights);
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Get action items for a meeting
 */
const getActionItems = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const items = await aiService.getActionItems(meetingId);
    return sendSuccess(res, 200, 'Action items retrieved', { actionItems: items });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Create a manual action item
 */
const createActionItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { title, assigneeName, dueDate } = req.body;

    const item = await aiService.createActionItem(meetingId, { title, assigneeName, dueDate });

    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('action-item-created', item);
    }

    return sendSuccess(res, 201, 'Action item created', item);
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Edit / Update action item (e.g. mark completed)
 */
const updateActionItem = async (req, res, next) => {
  try {
    const { meetingId, taskId } = req.params;
    const updated = await aiService.updateActionItem(meetingId, taskId, req.body);

    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('action-item-updated', updated);
    }

    return sendSuccess(res, 200, 'Action item updated', updated);
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Delete action item
 */
const deleteActionItem = async (req, res, next) => {
  try {
    const { meetingId, taskId } = req.params;
    await aiService.deleteActionItem(meetingId, taskId);

    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('action-item-deleted', { taskId });
    }

    return sendSuccess(res, 200, 'Action item deleted', { taskId });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Smart Search across transcripts and meeting notes
 */
const smartSearch = async (req, res, next) => {
  try {
    const { q, meetingId } = req.query;
    if (!q || q.trim().length === 0) {
      return sendError(res, 400, 'Please provide a search keyword');
    }

    const data = await aiService.smartSearch({ query: q, meetingIdFilter: meetingId });
    return sendSuccess(res, 200, 'Smart search results retrieved', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTranscript,
  appendTranscriptSegment,
  generateSummary,
  getInsights,
  getActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  smartSearch
};

