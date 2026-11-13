const config = require('../config/config');

/**
 * Strips NoSQL injection operators (keys starting with '$' or containing '.')
 * from request objects (req.body, req.query, req.params).
 */
const sanitizeNoSqlObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 10) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeNoSqlObject(item, depth + 1));
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeNoSqlObject(value, depth + 1);
  }
  return clean;
};

const sanitizeNoSql = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeNoSqlObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeNoSqlObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeNoSqlObject(req.params);
  }
  next();
};

/**
 * Cleans string inputs of malicious HTML tags, scripts, and event handlers
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '');
};

const sanitizeXssObject = (obj, depth = 0) => {
  if (!obj || depth > 10) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeXssObject(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      clean[key] = sanitizeXssObject(value, depth + 1);
    }
    return clean;
  }
  return obj;
};

const sanitizeXss = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeXssObject(req.body);
  }
  next();
};

/**
 * Validates Origin/Referer against allowed origins on state-modifying requests
 */
const csrfProtection = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Token in Authorization header is immune to browser cookie CSRF
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return next();
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  let origin = originHeader;

  if (!origin && refererHeader) {
    try {
      origin = new URL(refererHeader).origin;
    } catch {
      origin = null;
    }
  }

  // If no origin or referer (e.g. non-browser automated test or curl), proceed
  if (!origin) {
    return next();
  }

  const trustedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`
  ];

  const isTrusted = trustedOrigins.some((trusted) => origin === trusted);

  if (process.env.NODE_ENV === 'production' && !isTrusted) {
    return res.status(403).json({
      success: false,
      message: 'CSRF security violation: Untrusted origin blocked.'
    });
  }

  next();
};

module.exports = {
  sanitizeNoSql,
  sanitizeXss,
  csrfProtection
};

