const meetingService = require('../services/meetingService');
const chatService = require('../services/chatService');
const reminderService = require('../services/reminderService');
const notesService = require('../services/notesService');
const pollService = require('../services/pollService');
const breakoutService = require('../services/breakoutService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Create an instant meeting
// @route   POST /api/meetings/instant
// @access  Public / Optional Auth
const createInstantMeeting = async (req, res, next) => {
  try {
    const { meetingId, title, description, password, settings, isChatCall, meetingType } = req.body;
    const hostId = req.user ? req.user.id || req.user._id : null;
    const hostName = req.user ? req.user.fullName || req.user.name : req.body.hostName || 'Host';
    const hostEmail = req.user ? req.user.email : req.body.hostEmail || '';

    const meeting = await meetingService.createInstantMeeting({
      meetingId,
      hostId,
      hostName,
      hostEmail,
      title,
      description,
      password,
      settings,
      isChatCall,
      meetingType
    });

    return sendSuccess(res, 201, 'Instant meeting created successfully', meeting);
  } catch (error) {
    next(error);
  }
};

// @desc    Schedule a future meeting with timezone, invitees & recurrence
// @route   POST /api/meetings/schedule
// @access  Private
const scheduleMeeting = async (req, res, next) => {
  try {
    const {
      title,
      description,
      scheduledDate,
      scheduledTime,
      duration,
      timezone,
      invitees,
      recurrence,
      password,
      settings
    } = req.body;

    const hostId = req.user ? req.user.id || req.user._id : null;
    const hostName = req.user ? req.user.fullName || req.user.name : 'Host';
    const hostEmail = req.user ? req.user.email : '';

    const meeting = await meetingService.scheduleMeeting({
      hostId,
      hostName,
      hostEmail,
      title,
      description,
      scheduledDate,
      scheduledTime,
      duration,
      timezone,
      invitees,
      recurrence,
      password,
      settings
    });

    return sendSuccess(res, 201, 'Meeting scheduled successfully', meeting);
  } catch (error) {
    next(error);
  }
};

// @desc    Edit / Update an existing scheduled meeting
// @route   PUT /api/meetings/:meetingId
// @access  Private (Host only)
const updateScheduledMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? req.user.id || req.user._id : null;

    const updated = await meetingService.updateScheduledMeeting(
      meetingId.toLowerCase().trim(),
      req.body,
      userId
    );

    return sendSuccess(res, 200, 'Scheduled meeting updated successfully', updated);
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

// @desc    Validate access to a meeting (passwords, waiting room, lock state)
// @route   POST /api/meetings/validate-access
// @access  Public / Optional Auth
const validateAccess = async (req, res, next) => {
  try {
    const { meetingId, password } = req.body;
    if (!meetingId) {
      return sendError(res, 400, 'Meeting ID is required');
    }

    const userId = req.user ? req.user.id || req.user._id : null;
    const userName = req.user ? req.user.fullName || req.user.name : 'Host';
    const userEmail = req.user ? req.user.email : '';
    const result = await meetingService.validateMeetingAccess({
      meetingId: meetingId.toLowerCase().trim(),
      userId,
      userName,
      userEmail,
      password
    });

    return sendSuccess(res, 200, 'Access validated', result);
  } catch (error) {
    if (
      error.message.includes('not found') ||
      error.message.includes('expired')
    ) {
      return sendError(res, 404, error.message);
    }
    if (
      error.message.includes('password') ||
      error.message.includes('locked') ||
      error.message.includes('ended') ||
      error.message.includes('cancelled')
    ) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

// @desc    Get meeting details by ID
// @route   GET /api/meetings/:meetingId
// @access  Public / Optional Auth
const getMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? req.user.id || req.user._id : null;

    const meeting = await meetingService.getMeetingById(meetingId.toLowerCase().trim(), userId);
    if (!meeting) {
      return sendError(res, 404, 'Meeting not found');
    }

    return sendSuccess(res, 200, 'Meeting details retrieved', meeting);
  } catch (error) {
    next(error);
  }
};

// @desc    Get authenticated user's upcoming meetings
// @route   GET /api/meetings/upcoming
// @access  Private
const getUpcomingMeetings = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const userEmail = req.user.email;
    const upcoming = await meetingService.getUserUpcomingMeetings(userId, userEmail);
    return sendSuccess(res, 200, 'Upcoming meetings retrieved', upcoming);
  } catch (error) {
    next(error);
  }
};

// @desc    Get meetings in calendar format with date window & recurrence
// @route   GET /api/meetings/calendar
// @access  Private
const getCalendarMeetings = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id || req.user._id : null;
    const userEmail = req.user ? req.user.email : null;
    const { start, end, timezone } = req.query;

    const meetings = await meetingService.getUserCalendarMeetings(userId, userEmail, {
      start,
      end,
      timezone
    });
    return sendSuccess(res, 200, 'Calendar meetings retrieved', meetings);
  } catch (error) {
    next(error);
  }
};

// @desc    Get meetings user is invited to
// @route   GET /api/meetings/invitations
// @access  Private
const getUserInvitations = async (req, res, next) => {
  try {
    const userEmail = req.user ? req.user.email : null;
    const invitations = await meetingService.getUserInvitations(userEmail);
    return sendSuccess(res, 200, 'User invitations retrieved', invitations);
  } catch (error) {
    next(error);
  }
};

// @desc    RSVP to an invitation (accept / decline)
// @route   PUT /api/meetings/:meetingId/invitations/rsvp
// @access  Private
const rsvpInvitation = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { status } = req.body;
    const userEmail = req.user ? req.user.email : null;

    if (!['accepted', 'declined'].includes(status)) {
      return sendError(res, 400, 'Status must be accepted or declined');
    }

    const updated = await meetingService.respondToInvitation(
      meetingId.toLowerCase().trim(),
      userEmail,
      status
    );
    return sendSuccess(res, 200, `Invitation ${status} successfully`, updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming meeting reminders
// @route   GET /api/meetings/reminders
// @access  Private
const getUpcomingReminders = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id || req.user._id : null;
    const userEmail = req.user ? req.user.email : null;

    const reminders = await reminderService.getUserReminders(userId, userEmail);
    return sendSuccess(res, 200, 'Upcoming meeting reminders retrieved', reminders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get authenticated user's meeting history
// @route   GET /api/meetings/history
// @access  Private
const getMeetingHistory = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const history = await meetingService.getUserMeetingHistory(userId);
    return sendSuccess(res, 200, 'Meeting history retrieved', history);
  } catch (error) {
    next(error);
  }
};

// @desc    Invite a participant to an existing meeting by email
// @route   POST /api/meetings/:meetingId/invite
// @access  Private / Optional
const inviteParticipant = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required to send an invitation' });
    }
    const updated = await meetingService.addInvitee(
      meetingId.toLowerCase().trim(),
      { email, name },
      req.user
    );
    return sendSuccess(res, 200, 'Invitation sent successfully', updated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update meeting settings (Host only)
// @route   PUT /api/meetings/:meetingId/settings
// @access  Private
const updateMeetingSettings = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { settings } = req.body;
    const userId = req.user ? req.user.id || req.user._id : null;

    const updated = await meetingService.updateMeetingSettings(
      meetingId.toLowerCase().trim(),
      settings,
      userId
    );
    return sendSuccess(res, 200, 'Meeting settings updated', updated);
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

// @desc    End meeting for all participants (Host only)
// @route   PUT /api/meetings/:meetingId/end
// @access  Private
const endMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? req.user.id || req.user._id : null;

    const ended = await meetingService.updateMeetingStatus(
      meetingId.toLowerCase().trim(),
      'ended',
      userId
    );
    return sendSuccess(res, 200, 'Meeting ended for all participants', ended);
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

// @desc    Cancel a scheduled meeting (Host only)
// @route   DELETE /api/meetings/:meetingId
// @access  Private
const cancelMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? req.user.id || req.user._id : null;

    const cancelled = await meetingService.cancelMeeting(
      meetingId.toLowerCase().trim(),
      userId
    );
    return sendSuccess(res, 200, 'Meeting cancelled successfully', cancelled);
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

// @desc    Get paginated chat messages for a meeting
// @route   GET /api/meetings/:meetingId/messages
// @access  Optional Auth / Private (filters private messages by user)
const getMeetingMessages = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { page, limit, before } = req.query;
    const userId = req.user ? req.user.id || req.user._id : null;

    const result = await chatService.getMeetingMessages(meetingId.toLowerCase().trim(), {
      page,
      limit,
      before,
      userId
    });

    return sendSuccess(res, 200, 'Meeting messages retrieved', result);
  } catch (error) {
    next(error);
  }
};

// --- Meeting Notes ---
const getMeetingNotes = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const notes = await notesService.getNotes(meetingId.toLowerCase().trim());
    return sendSuccess(res, 200, 'Meeting notes retrieved', notes);
  } catch (error) {
    next(error);
  }
};

const saveMeetingNotes = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { content } = req.body;
    const saved = await notesService.saveNotes(meetingId.toLowerCase().trim(), content, req.user);
    return sendSuccess(res, 200, 'Meeting notes saved', saved);
  } catch (error) {
    next(error);
  }
};

// --- Meeting Polls ---
const getMeetingPolls = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? req.user.id || req.user._id : null;
    const polls = await pollService.getMeetingPolls(meetingId.toLowerCase().trim(), userId);
    return sendSuccess(res, 200, 'Meeting polls retrieved', polls);
  } catch (error) {
    next(error);
  }
};

const createMeetingPoll = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { question, options, isAnonymous } = req.body;
    const poll = await pollService.createPoll(
      meetingId.toLowerCase().trim(),
      { question, options, isAnonymous },
      req.user
    );
    return sendSuccess(res, 201, 'Poll created successfully', poll);
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('at least 2 options')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

const voteMeetingPoll = async (req, res, next) => {
  try {
    const { meetingId, pollId } = req.params;
    const { optionId } = req.body;
    const voterId = req.user ? req.user.id || req.user._id : req.body.voterId;
    if (!voterId) {
      return sendError(res, 400, 'Voter identifier required.');
    }
    const updatedPoll = await pollService.votePoll(
      meetingId.toLowerCase().trim(),
      pollId,
      optionId,
      voterId
    );
    return sendSuccess(res, 200, 'Vote recorded successfully', updatedPoll);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('closed') || error.message.includes('Selected option')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

const endMeetingPoll = async (req, res, next) => {
  try {
    const { meetingId, pollId } = req.params;
    const ended = await pollService.endPoll(meetingId.toLowerCase().trim(), pollId);
    return sendSuccess(res, 200, 'Poll ended', ended);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

// --- Breakout Rooms ---
const getBreakoutRooms = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const data = breakoutService.getBreakouts(meetingId.toLowerCase().trim());
    return sendSuccess(res, 200, 'Breakout rooms retrieved', data);
  } catch (error) {
    next(error);
  }
};

const createBreakoutRooms = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { roomNames, allowSwitching, assignments } = req.body;
    const data = breakoutService.createBreakouts(meetingId.toLowerCase().trim(), {
      roomNames,
      allowSwitching,
      assignments
    });
    return sendSuccess(res, 201, 'Breakout rooms created', data);
  } catch (error) {
    next(error);
  }
};

const closeBreakoutRooms = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const data = breakoutService.closeBreakouts(meetingId.toLowerCase().trim());
    return sendSuccess(res, 200, 'Breakout rooms closed', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
