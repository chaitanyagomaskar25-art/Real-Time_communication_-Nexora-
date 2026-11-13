const express = require('express');
const router = express.Router();

const {
  getTranscript,
  appendTranscriptSegment,
  generateSummary,
  getInsights,
  getActionItems,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  smartSearch
} = require('../controllers/aiController');

const { optionalAuth } = require('../middleware/authMiddleware');

// Smart search across meeting transcripts and shared notes
router.get('/search', optionalAuth, smartSearch);

// Live and stored meeting transcripts
router.get('/:meetingId/transcript', optionalAuth, getTranscript);
router.post('/:meetingId/transcript/segment', optionalAuth, appendTranscriptSegment);

// AI meeting summary & insights
router.post('/:meetingId/summary', optionalAuth, generateSummary);
router.get('/:meetingId/insights', optionalAuth, getInsights);

// Action items extraction & tracking
router.get('/:meetingId/action-items', optionalAuth, getActionItems);
router.post('/:meetingId/action-items', optionalAuth, createActionItem);
router.put('/:meetingId/action-items/:taskId', optionalAuth, updateActionItem);
router.delete('/:meetingId/action-items/:taskId', optionalAuth, deleteActionItem);

module.exports = router;

