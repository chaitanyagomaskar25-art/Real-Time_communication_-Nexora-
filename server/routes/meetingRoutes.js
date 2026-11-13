const express = require('express');
const router = express.Router();

const {
  createInstantMeeting,
  scheduleMeeting,
  updateScheduledMeeting,
  validateAccess,
  getMeeting,
  getUpcomingMeetings,
  getCalendarMeetings,
  getUserInvitations,
  rsvpInvitation,
  getUpcomingReminders,
  getMeetingHistory,
  inviteParticipant,
  updateMeetingSettings,
  endMeeting,
  cancelMeeting,
  getMeetingMessages,
  getMeetingNotes,
  saveMeetingNotes,
  getMeetingPolls,
  createMeetingPoll,
  voteMeetingPoll,
  endMeetingPoll,
  getBreakoutRooms,
  createBreakoutRooms,
  closeBreakoutRooms
} = require('../controllers/meetingController');

const {
  uploadFiles,
  getMeetingFiles,
  downloadFile,
  previewFile,
  deleteFile
} = require('../controllers/fileController');

const {
  getWhiteboard,
  saveSnapshot
} = require('../controllers/whiteboardController');

const { handleFileUpload } = require('../middleware/fileUploadMiddleware');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

// Meeting creation & access validation
router.post('/instant', optionalAuth, createInstantMeeting);
router.post('/schedule', protect, scheduleMeeting);
router.post('/validate-access', authLimiter, optionalAuth, validateAccess);

// User lists & calendar views (defined BEFORE :meetingId to avoid route capture)
router.get('/upcoming', protect, getUpcomingMeetings);
router.get('/history', protect, getMeetingHistory);
router.get('/calendar', protect, getCalendarMeetings);
router.get('/invitations', protect, getUserInvitations);
router.get('/reminders', protect, getUpcomingReminders);

// Single meeting management, RSVP, invitations & messages
router.get('/:meetingId', optionalAuth, getMeeting);
router.post('/:meetingId/invite', optionalAuth, inviteParticipant);
router.put('/:meetingId', protect, updateScheduledMeeting);
router.put('/:meetingId/invitations/rsvp', protect, rsvpInvitation);
router.get('/:meetingId/messages', optionalAuth, getMeetingMessages);
router.put('/:meetingId/settings', protect, updateMeetingSettings);
router.put('/:meetingId/end', protect, endMeeting);
router.delete('/:meetingId', protect, cancelMeeting);

// Secure Real-Time In-Meeting File Sharing
router.post('/:meetingId/files', optionalAuth, handleFileUpload, uploadFiles);
router.get('/:meetingId/files', optionalAuth, getMeetingFiles);
router.get('/:meetingId/files/:fileId/download', optionalAuth, downloadFile);
router.get('/:meetingId/files/:fileId/preview', optionalAuth, previewFile);
router.delete('/:meetingId/files/:fileId', optionalAuth, deleteFile);

// Real-Time Collaborative Whiteboard
router.get('/:meetingId/whiteboard', optionalAuth, getWhiteboard);
router.put('/:meetingId/whiteboard/snapshot', optionalAuth, saveSnapshot);

// Shared Meeting Notes
router.get('/:meetingId/notes', optionalAuth, getMeetingNotes);
router.put('/:meetingId/notes', optionalAuth, saveMeetingNotes);

// Meeting Polls
router.get('/:meetingId/polls', optionalAuth, getMeetingPolls);
router.post('/:meetingId/polls', optionalAuth, createMeetingPoll);
router.post('/:meetingId/polls/:pollId/vote', optionalAuth, voteMeetingPoll);
router.put('/:meetingId/polls/:pollId/end', protect, endMeetingPoll);

// Breakout Rooms
router.get('/:meetingId/breakout', optionalAuth, getBreakoutRooms);
router.post('/:meetingId/breakout', protect, createBreakoutRooms);
router.post('/:meetingId/breakout/close', protect, closeBreakoutRooms);

module.exports = router;
