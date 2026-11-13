const authService = require('../services/authService');
const contactService = require('../services/contactService');
const presenceService = require('../services/presenceService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user._id || req.user.id);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    return sendSuccess(res, 200, 'User profile', user);
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const currId = req.user?.id || req.user?._id;
    const users = await contactService.searchUsers(query, currId);
    return sendSuccess(res, 200, 'Users found', users);
  } catch (error) {
    next(error);
  }
};

const updatePresence = async (req, res, next) => {
  try {
    const { status } = req.body;
    const currId = req.user?.id || req.user?._id;
    if (!status) {
      return sendError(res, 400, 'Presence status is required.');
    }
    const updatedStatus = await presenceService.setUserStatus(currId, status);
    return sendSuccess(res, 200, 'Presence status updated', { status: updatedStatus });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  searchUsers,
  updatePresence
};
