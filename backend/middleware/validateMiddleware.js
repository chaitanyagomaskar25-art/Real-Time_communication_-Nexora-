const { sendError } = require('../utils/responseHandler');

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const USERNAME_REGEX = /^[a-z0-9_.-]{3,30}$/;

const validateRegister = (req, res, next) => {
  const { fullName, name, username, email, password } = req.body;
  const actualFullName = (fullName || name || '').trim();

  if (!actualFullName) {
    return sendError(res, 400, 'Full name is required');
  }

  if (actualFullName.length > 60) {
    return sendError(res, 400, 'Full name cannot exceed 60 characters');
  }

  if (!username || !USERNAME_REGEX.test(username.toLowerCase().trim())) {
    return sendError(
      res,
      400,
      'Username is required and must be 3-30 characters containing only letters, numbers, underscores, dots, or hyphens'
    );
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return sendError(res, 400, 'Please provide a valid email address');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendError(res, 400, 'Password must be at least 6 characters');
  }

  // Normalize fields
  req.body.fullName = actualFullName;
  req.body.username = username.toLowerCase().trim();
  req.body.email = email.toLowerCase().trim();

  next();
};

const validateLogin = (req, res, next) => {
  const { email, username, identifier, password } = req.body;
  const rawIdentifier = typeof identifier === 'string'
    ? identifier
    : typeof email === 'string'
    ? email
    : typeof username === 'string'
    ? username
    : '';
  const actualIdentifier = rawIdentifier.trim();

  if (!actualIdentifier) {
    return sendError(res, 400, 'Please provide your email address or username');
  }

  if (!password || typeof password !== 'string') {
    return sendError(res, 400, 'Please provide your password');
  }

  req.body.identifier = actualIdentifier;
  next();
};

const validateUpdateProfile = (req, res, next) => {
  const { fullName, username, bio, profileImage } = req.body;

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length === 0) {
      return sendError(res, 400, 'Full name cannot be empty');
    }
    if (fullName.length > 60) {
      return sendError(res, 400, 'Full name cannot exceed 60 characters');
    }
    req.body.fullName = fullName.trim();
  }

  if (username !== undefined) {
    const cleanUsername = username.toLowerCase().trim();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return sendError(
        res,
        400,
        'Username must be 3-30 characters containing only letters, numbers, underscores, dots, or hyphens'
      );
    }
    req.body.username = cleanUsername;
  }

  if (bio !== undefined && typeof bio === 'string' && bio.length > 300) {
    return sendError(res, 400, 'Bio cannot exceed 300 characters');
  }

  if (profileImage !== undefined && typeof profileImage === 'string' && profileImage.length > 500) {
    return sendError(res, 400, 'Profile image URL is too long');
  }

  next();
};

const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    return sendError(res, 400, 'Current password is required');
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return sendError(res, 400, 'New password must be at least 6 characters');
  }

  if (currentPassword === newPassword) {
    return sendError(res, 400, 'New password cannot be the same as current password');
  }

  next();
};

const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return sendError(res, 400, 'Please provide a valid registered email address');
  }

  req.body.email = email.toLowerCase().trim();
  next();
};

const validateResetPassword = (req, res, next) => {
  const { password, newPassword } = req.body;
  const actualPassword = password || newPassword;

  if (!actualPassword || typeof actualPassword !== 'string' || actualPassword.length < 6) {
    return sendError(res, 400, 'New password must be at least 6 characters');
  }

  req.body.password = actualPassword;
  next();
};

const validateRoomCreate = (req, res, next) => {
  const { title } = req.body;
  if (title && title.length > 100) {
    return sendError(res, 400, 'Room title cannot exceed 100 characters');
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateRoomCreate
};
