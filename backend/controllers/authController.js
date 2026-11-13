const authService = require('../services/authService');
const { sendTokenResponse, clearTokenCookie } = require('../utils/tokenUtils');
const { sendSuccess, sendError } = require('../utils/responseHandler');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { fullName, username, email, password } = req.body;
    const user = await authService.register({ fullName, username, email, password });
    return sendTokenResponse(user, 201, res, 'Registration successful. Welcome to ConnectSphere!');
  } catch (error) {
    if (
      error.message.includes('already exists') ||
      error.message.includes('already taken')
    ) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

// @desc    Login user with email/username & password
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const user = await authService.login({ identifier, password });
    return sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (error) {
    if (error.message.includes('Invalid credentials')) {
      return sendError(res, 401, error.message);
    }
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Public (Optionally authenticated)
const logout = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : null;
    if (userId) {
      await authService.logout(userId);
    }
    clearTokenCookie(res);
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await authService.getCurrentUser(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }
    const safeUser = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;
    return sendSuccess(res, 200, 'User profile retrieved', safeUser);
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { fullName, username, bio, profileImage } = req.body;

    const updatedUser = await authService.updateProfile(userId, {
      fullName,
      username,
      bio,
      profileImage
    });

    const safeUser = typeof updatedUser.toSafeObject === 'function' ? updatedUser.toSafeObject() : updatedUser;
    return sendSuccess(res, 200, 'Profile updated successfully', safeUser);
  } catch (error) {
    if (error.message.includes('already taken')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

// @desc    Change current user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { currentPassword, newPassword } = req.body;

    const user = await authService.changePassword(userId, { currentPassword, newPassword });
    return sendTokenResponse(user, 200, res, 'Password changed successfully');
  } catch (error) {
    if (error.message.includes('does not match')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

// @desc    Forgot password (Generate reset token)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { resetToken } = await authService.forgotPassword(email);

    return sendSuccess(res, 200, 'Password reset token generated successfully', {
      resetToken,
      resetUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${resetToken}`
    });
  } catch (error) {
    if (error.message.includes('No account found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

// @desc    Reset password using reset token
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    const user = await authService.resetPassword(resetToken, password);
    return sendTokenResponse(user, 200, res, 'Password reset successfully. You are now logged in.');
  } catch (error) {
    if (error.message.includes('invalid or has expired')) {
      return sendError(res, 400, error.message);
    }
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
