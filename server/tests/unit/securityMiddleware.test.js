const test = require('node:test');
const assert = require('node:assert');
const { sanitizeNoSql, sanitizeXss, csrfProtection } = require('../../middleware/securityMiddleware');
const { requireAdmin } = require('../../middleware/authMiddleware');

test('Security Middleware - Unit Tests', async (t) => {
  await t.test('sanitizeNoSql strips NoSQL injection keys like $gt and dot notation', () => {
    const req = {
      body: {
        username: 'admin',
        password: { $gt: '' },
        nested: {
          'config.setting': 'malicious',
          safeKey: 'cleanValue'
        }
      },
      query: {
        '$where': 'sleep(5000)',
        page: '1'
      },
      params: {
        id: '123'
      }
    };
    let nextCalled = false;
    sanitizeNoSql(req, {}, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.body.username, 'admin');
    assert.strictEqual(req.body.password.$gt, undefined);
    assert.strictEqual(req.body.nested['config.setting'], undefined);
    assert.strictEqual(req.body.nested.safeKey, 'cleanValue');
    assert.strictEqual(req.query.$where, undefined);
    assert.strictEqual(req.query.page, '1');
  });

  await t.test('sanitizeXss strips script tags and dangerous HTML attributes', () => {
    const req = {
      body: {
        title: '<script>alert("XSS")</script>Team Sync',
        description: 'Hello <img src="x" onerror="stealCookies()"> world',
        message: 'javascript:void(0)'
      }
    };
    let nextCalled = false;
    sanitizeXss(req, {}, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.body.title, 'Team Sync');
    assert.ok(!req.body.description.includes('onerror'));
    assert.strictEqual(req.body.message, '');
  });

  await t.test('csrfProtection allows safe GET and HEAD requests', () => {
    let nextGet = false;
    csrfProtection({ method: 'GET' }, {}, () => { nextGet = true; });
    assert.strictEqual(nextGet, true);

    let nextHead = false;
    csrfProtection({ method: 'HEAD' }, {}, () => { nextHead = true; });
    assert.strictEqual(nextHead, true);
  });

  await t.test('csrfProtection allows Bearer token authorization requests', () => {
    let nextPost = false;
    const req = {
      method: 'POST',
      headers: {
        authorization: 'Bearer sample-jwt-token'
      }
    };
    csrfProtection(req, {}, () => { nextPost = true; });
    assert.strictEqual(nextPost, true);
  });

  await t.test('requireAdmin blocks non-admin users with 403 Forbidden', () => {
    const req = {
      user: { id: 'usr-1', role: 'user', email: 'user@connectsphere.com' }
    };
    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
            return data;
          }
        };
      }
    };
    let nextCalled = false;

    requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusCode, 403);
    assert.ok(jsonResponse.message.includes('Administrator privileges are required'));
  });

  await t.test('requireAdmin allows users with admin role', () => {
    const req = {
      user: { id: 'admin-1', role: 'admin', email: 'admin@connectsphere.com' }
    };
    let nextCalled = false;
    requireAdmin(req, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });
});

