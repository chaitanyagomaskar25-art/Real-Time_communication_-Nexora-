const notificationService = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const notifications = await notificationService.getUserNotifications(userId);
    return sendSuccess(res, 200, 'Notifications retrieved', notifications);
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;
    await notificationService.markAsRead(id, userId);
    return sendSuccess(res, 200, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    await notificationService.markAllAsRead(userId);
    return sendSuccess(res, 200, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;
    await notificationService.deleteNotification(id, userId);
    return sendSuccess(res, 200, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

const callUser = async (req, res, next) => {
  try {
    const { recipientId, meetingId } = req.body;
    if (!recipientId || !meetingId) {
      return sendError(res, 400, 'recipientId and meetingId are required.');
    }
    const result = await notificationService.callContact(req.user, recipientId, meetingId);
    return sendSuccess(res, 200, 'Call notification initiated', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  callUser
};

