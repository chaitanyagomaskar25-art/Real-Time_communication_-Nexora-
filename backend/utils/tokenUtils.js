const jwt = require('jsonwebtoken');
const config = require('../config/config');

const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

// Cookie options for secure HttpOnly session
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  };
};

// Send response with HttpOnly cookie and standardized JSON
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken({
    id: user.id || user._id.toString(),
    username: user.username,
    email: user.email,
    fullName: user.fullName || user.name
  });

  const cookieOptions = getCookieOptions();

  // Set secure HttpOnly cookie
  res.cookie('token', token, cookieOptions);

  const safeUser = typeof user.toSafeObject === 'function' ? user.toSafeObject() : {
    id: user.id || user._id.toString(),
    fullName: user.fullName || user.name,
    name: user.fullName || user.name,
    username: user.username,
    email: user.email,
    profileImage: user.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName || user.name || 'User')}`,
    bio: user.bio || '',
    isOnline: Boolean(user.isOnline),
    lastSeen: user.lastSeen || new Date(),
    createdAt: user.createdAt || new Date()
  };

  return res.status(statusCode).json({
    success: true,
    message,
    token, // Dual support: cookie for browser, token for Bearer headers
    user: safeUser,
    data: {
      user: safeUser,
      token
    }
  });
};

// Clear authentication cookie
const clearTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', 'none', {
    expires: new Date(Date.now() - 10 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });
};

module.exports = {
  generateToken,
  verifyToken,
  sendTokenResponse,
  clearTokenCookie,
  getCookieOptions
};
