const zlib = require('zlib');

/**
 * High-performance, zero-dependency response compression middleware.
 * Uses Node.js native zlib to compress JSON and text responses with gzip/deflate.
 */
const compressionMiddleware = (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Only compress if client accepts gzip or deflate
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
    return next();
  }

  const originalSend = res.send;

  res.send = function (body) {
    // If response was already sent or headers sent, fallback
    if (res.headersSent) {
      return originalSend.call(this, body);
    }

    // Don't compress if no-transform header is present or status code is 204/304
    const cacheControl = res.getHeader('Cache-Control') || '';
    if (cacheControl.includes('no-transform') || res.statusCode === 204 || res.statusCode === 304) {
      return originalSend.call(this, body);
    }

    // Convert objects/numbers to JSON strings if needed
    let content = body;
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
      content = JSON.stringify(body);
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
    }

    // Only compress payloads larger than 1024 bytes (1 KB)
    const bodyBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content || '', 'utf8');
    if (bodyBuffer.length < 1024) {
      return originalSend.call(this, body);
    }

    res.setHeader('Vary', 'Accept-Encoding');

    try {
      if (acceptEncoding.includes('gzip')) {
        const compressed = zlib.gzipSync(bodyBuffer, { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        res.removeHeader('Content-Length');
        return originalSend.call(this, compressed);
      } else if (acceptEncoding.includes('deflate')) {
        const compressed = zlib.deflateSync(bodyBuffer, { level: 6 });
        res.setHeader('Content-Encoding', 'deflate');
        res.removeHeader('Content-Length');
        return originalSend.call(this, compressed);
      }
    } catch {
      // In case of any compression issue, fallback to uncompressed
      return originalSend.call(this, body);
    }

    return originalSend.call(this, body);
  };

  next();
};

module.exports = compressionMiddleware;

