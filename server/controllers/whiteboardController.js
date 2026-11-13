const whiteboardService = require('../services/whiteboardService');
const { sendSuccess } = require('../utils/responseHandler');

/**
 * @desc    Get current whiteboard state for a meeting
 * @route   GET /api/meetings/:meetingId/whiteboard
 * @access  Meeting Participant
 */
const getWhiteboard = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const whiteboard = await whiteboardService.getWhiteboard(meetingId);
    return sendSuccess(res, 200, 'Whiteboard state retrieved', whiteboard);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save snapshot of the whiteboard
 * @route   PUT /api/meetings/:meetingId/whiteboard/snapshot
 * @access  Meeting Participant
 */
const saveSnapshot = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { snapshot } = req.body;
    await whiteboardService.saveSnapshot(meetingId, snapshot || '');
    return sendSuccess(res, 200, 'Whiteboard snapshot saved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWhiteboard,
  saveSnapshot
};

