const { verifyToken } = require('../utils/tokenUtils');
const { sendError } = require('../utils/responseHandler');
const authService = require('../services/authService');

const protect = async (req, res, next) => {
  let token;

  // 1. Check explicit Authorization: Bearer <token> header first
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fallback to HttpOnly cookie
  else if (req.cookies && req.cookies.token && req.cookies.token !== 'none') {
    token = req.cookies.token;
  }
  // 3. Fallback to query parameter (required for HTML5 <video>, <audio>, and direct download links)
  else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return sendError(res, 401, 'Not authorized. Please log in to access this resource.');
  }

  try {
    const decoded = verifyToken(token);

    // Fetch user from service (handles both MongoDB and fallback seamlessly)
    const user = await authService.getCurrentUser(decoded.id);

    if (!user) {
      return sendError(res, 401, 'Not authorized. User session has expired or no longer exists.');
    }

    if (user.status === 'suspended') {
      return sendError(res, 403, 'Your account has been suspended by an administrator. Please contact support.');
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 401, 'Not authorized. Authentication token is invalid or has expired.', error);
  }
};

// Optional auth: populate req.user if token provided, but proceed regardless
const optionalAuth = async (req, res, next) => {
  let token;

  // 1. Check explicit Authorization: Bearer <token> header first
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fallback to HttpOnly cookie
  else if (req.cookies && req.cookies.token && req.cookies.token !== 'none') {
    token = req.cookies.token;
  }
  // 3. Fallback to query parameter (required for HTML5 <video>, <audio>, and direct download links)
  else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      const user = await authService.getCurrentUser(decoded.id);
      if (user) {
        req.user = user;
      }
    } catch {
      // Ignore token decode failure for optional routes
    }
  }

  next();
};

// Require Administrator Role
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Not authorized. Please log in first.');
  }

  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden. Administrator privileges are required to access this resource.');
  }

  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireAdmin
};
