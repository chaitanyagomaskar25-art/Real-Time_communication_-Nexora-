const SENSITIVE_KEY_REGEX = /^(password|token|secret|authorization|cookie|credential|refreshtoken|accesstoken)$/i;

const redactValue = (val, depth = 0) => {
  if (depth > 6 || val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
      .replace(/(password["':\s=]+)([^"'\s&,]+)/gi, '$1[REDACTED]');
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const cleanObj = {};
    for (const [key, value] of Object.entries(val)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        cleanObj[key] = '[REDACTED]';
      } else {
        cleanObj[key] = redactValue(value, depth + 1);
      }
    }
    return cleanObj;
  }
  return val;
};

const sanitizeArgs = (args) => {
  return args.map((arg) => redactValue(arg));
};

const logger = {
  info: (msg, ...args) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${redactValue(msg)}`, ...sanitizeArgs(args));
  },
  warn: (msg, ...args) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${redactValue(msg)}`, ...sanitizeArgs(args));
  },
  error: (msg, ...args) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${redactValue(msg)}`, ...sanitizeArgs(args));
  },
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] [${new Date().toISOString()}] ${redactValue(msg)}`, ...sanitizeArgs(args));
    }
  }
};

module.exports = logger;
