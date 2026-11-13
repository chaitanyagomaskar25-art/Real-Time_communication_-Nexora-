const express = require('express');
const router = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimitMiddleware');
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validateMiddleware');

// Public Auth Routes (Rate Limited)
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', optionalAuth, logout);

// Password Reset Routes (Rate Limited)
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, forgotPassword);
router.put('/reset-password/:resetToken', passwordResetLimiter, validateResetPassword, resetPassword);

// Protected User Management Routes
router.get('/me', protect, getMe);
router.put('/profile', protect, validateUpdateProfile, updateProfile);
router.put('/change-password', protect, validateChangePassword, changePassword);

module.exports = router;
