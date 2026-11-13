const contactService = require('../services/contactService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

const getContacts = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const list = await contactService.getContacts(userId);
    return sendSuccess(res, 200, 'Contacts retrieved', list);
  } catch (error) {
    next(error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const requests = await contactService.getRequests(userId);
    return sendSuccess(res, 200, 'Connection requests retrieved', requests);
  } catch (error) {
    next(error);
  }
};

const sendRequest = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return sendError(res, 400, 'Please provide a username, email, or user ID.');
    }
    const result = await contactService.sendRequest(req.user, identifier);
    return sendSuccess(res, 201, 'Connection request sent successfully', result);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('cannot send') || error.message.includes('Already') || error.message.includes('pending')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

const respondToRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' | 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      return sendError(res, 400, 'Status must be either accepted or rejected.');
    }
    const result = await contactService.respondToRequest(requestId, req.user, status);
    return sendSuccess(res, 200, `Connection request ${status}`, result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id || req.user._id;
    await contactService.deleteContact(contactId, userId);
    return sendSuccess(res, 200, 'Contact removed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContacts,
  getRequests,
  sendRequest,
  respondToRequest,
  deleteContact
};

