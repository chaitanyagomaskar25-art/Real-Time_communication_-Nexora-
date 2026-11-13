const adminService = require('../services/adminService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * 1. Overview Statistics
 */
const getOverview = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const stats = await adminService.getOverviewStats(io);
    return sendSuccess(res, 200, 'Admin overview statistics retrieved', stats);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. User Management
 */
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role, status } = req.query;
    const data = await adminService.getUsers({ page, limit, search, role, status });
    return sendSuccess(res, 200, 'User list retrieved', data);
  } catch (error) {
    next(error);
  }
};

const getUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await adminService.getUserDetails(userId);
    return sendSuccess(res, 200, 'User details retrieved', user);
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    if (!status) {
      return sendError(res, 400, 'Please provide status ("active" or "suspended")');
    }

    const updated = await adminService.updateUserStatus(userId, { status, reason }, req.user, req.ip);
    return sendSuccess(res, 200, `User account ${status === 'suspended' ? 'suspended' : 'reactivated'} successfully`, updated);
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role) {
      return sendError(res, 400, 'Please provide role ("user", "admin", or "moderator")');
    }

    const updated = await adminService.updateUserRole(userId, { role }, req.user, req.ip);
    return sendSuccess(res, 200, `User role updated to ${role} successfully`, updated);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Meeting Management
 */
const getMeetings = async (req, res, next) => {
  try {
    const { page, limit, search, status, reportedOnly } = req.query;
    const data = await adminService.getMeetings({ page, limit, search, status, reportedOnly });
    return sendSuccess(res, 200, 'Meetings list retrieved', data);
  } catch (error) {
    next(error);
  }
};

const getMeetingDetails = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await adminService.getMeetingDetails(meetingId);
    return sendSuccess(res, 200, 'Meeting metadata retrieved', meeting);
  } catch (error) {
    next(error);
  }
};

const reportMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.user ? (req.user.id || req.user._id) : null;
    const reporterName = req.user ? (req.user.fullName || req.user.username) : 'Anonymous';

    const report = await adminService.reportMeeting(meetingId, {
      reporterId,
      reporterName,
      reason,
      description
    });
    return sendSuccess(res, 201, 'Meeting reported for review', report);
  } catch (error) {
    next(error);
  }
};

const resolveMeetingReport = async (req, res, next) => {
  try {
    const { meetingId, reportId } = req.params;
    const { status, resolutionNotes } = req.body;
    if (!status) {
      return sendError(res, 400, 'Please provide report status ("investigating", "resolved", or "dismissed")');
    }

    const updated = await adminService.resolveReport(meetingId, reportId, { status, resolutionNotes }, req.user, req.ip);
    return sendSuccess(res, 200, 'Meeting report status updated', updated);
  } catch (error) {
    next(error);
  }
};

const terminateMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { reason } = req.body;
    const io = req.app.get('io');

    const meeting = await adminService.terminateMeeting(meetingId, { reason }, req.user, req.ip, io);
    return sendSuccess(res, 200, 'Meeting terminated by administrator', meeting);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Analytics
 */
const getAnalytics = async (req, res, next) => {
  try {
    const { days } = req.query;
    const analytics = await adminService.getPlatformAnalytics({ days });
    return sendSuccess(res, 200, 'Platform analytics retrieved', analytics);
  } catch (error) {
    next(error);
  }
};

/**
 * 5. System Management
 */
const getSystemMetrics = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const metrics = await adminService.getSystemMetrics(io);
    return sendSuccess(res, 200, 'System metrics retrieved', metrics);
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Audit Logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, action, targetType } = req.query;
    const data = await adminService.getAuditLogs({ page, limit, action, targetType });
    return sendSuccess(res, 200, 'Audit logs retrieved', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getUsers,
  getUserDetails,
  updateUserStatus,
  updateUserRole,
  getMeetings,
  getMeetingDetails,
  reportMeeting,
  resolveMeetingReport,
  terminateMeeting,
  getAnalytics,
  getSystemMetrics,
  getAuditLogs
};

