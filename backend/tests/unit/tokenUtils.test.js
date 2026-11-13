const test = require('node:test');
const assert = require('node:assert');
const {
  generateToken,
  verifyToken,
  getCookieOptions,
  clearTokenCookie,
  sendTokenResponse
} = require('../../utils/tokenUtils');

test('Token Utilities - Unit Tests', async (t) => {
  await t.test('generateToken produces a valid 3-part JWT', () => {
    const payload = { id: 'user-123', email: 'test@connectsphere.com', role: 'user' };
    const token = generateToken(payload);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.split('.').length, 3, 'JWT should contain header, payload, and signature');
  });

  await t.test('verifyToken correctly decodes a valid token', () => {
    const payload = { id: 'user-abc', email: 'alice@connectsphere.com', role: 'admin' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 'user-abc');
    assert.strictEqual(decoded.email, 'alice@connectsphere.com');
    assert.strictEqual(decoded.role, 'admin');
    assert.ok(decoded.iat, 'Should have issued at timestamp');
    assert.ok(decoded.exp, 'Should have expiration timestamp');
  });

  await t.test('verifyToken throws on a tampered or invalid token', () => {
    assert.throws(() => {
      verifyToken('invalid.token.signature');
    }, /jwt malformed|invalid token|JsonWebTokenError/);
  });

  await t.test('getCookieOptions returns secure httpOnly parameters', () => {
    const opts = getCookieOptions();
    assert.strictEqual(opts.httpOnly, true, 'HttpOnly must be enabled to prevent XSS access');
    assert.strictEqual(opts.sameSite, 'lax', 'SameSite lax for CSRF mitigation');
    assert.strictEqual(opts.path, '/', 'Path should be root');
    assert.ok(opts.expires instanceof Date, 'Expires should be a valid Date object');
    assert.ok(opts.expires.getTime() > Date.now(), 'Expires should be in future');
  });

  await t.test('clearTokenCookie sets an expired cookie', () => {
    let capturedName = null;
    let capturedVal = null;
    let capturedOpts = null;
    const mockRes = {
      cookie: (name, val, opts) => {
        capturedName = name;
        capturedVal = val;
        capturedOpts = opts;
      }
    };

    clearTokenCookie(mockRes);
    assert.strictEqual(capturedName, 'token');
    assert.strictEqual(capturedVal, 'none');
    assert.strictEqual(capturedOpts.httpOnly, true);
    assert.ok(capturedOpts.expires.getTime() < Date.now(), 'Expires should be in the past');
  });

  await t.test('sendTokenResponse attaches cookie and sends clean JSON response', () => {
    let capturedCookie = null;
    let capturedStatus = null;
    let capturedJson = null;

    const mockRes = {
      cookie: (name, val, opts) => {
        capturedCookie = { name, val, opts };
      },
      status: (code) => {
        capturedStatus = code;
        return {
          json: (data) => {
            capturedJson = data;
            return data;
          }
        };
      }
    };

    const mockUser = {
      id: 'usr-999',
      username: 'tester',
      email: 'tester@connectsphere.com',
      fullName: 'Test User',
      toSafeObject: () => ({
        id: 'usr-999',
        username: 'tester',
        email: 'tester@connectsphere.com',
        fullName: 'Test User'
      })
    };

    sendTokenResponse(mockUser, 201, mockRes, 'User registered successfully');

    assert.strictEqual(capturedStatus, 201);
    assert.strictEqual(capturedCookie.name, 'token');
    assert.strictEqual(typeof capturedCookie.val, 'string');
    assert.strictEqual(capturedJson.success, true);
    assert.strictEqual(capturedJson.message, 'User registered successfully');
    assert.strictEqual(capturedJson.user.email, 'tester@connectsphere.com');
    assert.strictEqual(capturedJson.token, capturedCookie.val);
  });
});

