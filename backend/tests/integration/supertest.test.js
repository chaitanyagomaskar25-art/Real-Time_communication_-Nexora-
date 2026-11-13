const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../../server');

test('ConnectSphere Supertest Integration Tests', async (suite) => {
  let authToken = null;
  let authCookie = null;
  let createdMeetingId = null;
  const uniqueTimestamp = Date.now();
  const testUser = {
    fullName: 'Integration Tester',
    username: `itest_${uniqueTimestamp}`,
    email: `itest_${uniqueTimestamp}@example.com`,
    password: 'Password123!'
  };

  await suite.test('Health check endpoint returns status OK and uptime', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'OK');
    assert.ok(res.body.uptime, 'Uptime should be reported');
    assert.ok(res.body.service.includes('ConnectSphere'));
  });

  await suite.test('Auth: Register new user returns token and sets HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Response should contain token');
    assert.strictEqual(res.body.user.email, testUser.email);

    // Save token and cookie for subsequent calls
    authToken = res.body.token;
    const cookieHeader = res.headers['set-cookie'];
    assert.ok(cookieHeader, 'Set-Cookie header should be present');
    authCookie = cookieHeader[0].split(';')[0];
    assert.ok(authCookie.startsWith('token='), 'Cookie name must be token');
  });

  await suite.test('Auth: Register with duplicate email is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  await suite.test('Auth: Login with invalid credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999!'
      });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  await suite.test('Auth: Protected route /api/auth/me rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  await suite.test('Auth: Protected route /api/auth/me succeeds with Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.email, testUser.email);
  });

  await suite.test('Auth: Protected route /api/auth/me succeeds with HttpOnly cookie session', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.email, testUser.email);
  });

  await suite.test('Meeting: Create instant meeting returns meetingId and host details', async () => {
    const res = await request(app)
      .post('/api/meetings/instant')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Supertest Architecture Review',
        description: 'End-to-end integration verification',
        settings: {
          waitingRoomEnabled: true
        }
      });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.meetingId);
    createdMeetingId = res.body.data.meetingId;
    assert.strictEqual(res.body.data.title, 'Supertest Architecture Review');
    assert.strictEqual(res.body.data.settings?.waitingRoomEnabled, true);
  });

  await suite.test('Meeting: Retrieve meeting details by meetingId', async () => {
    const res = await request(app)
      .get(`/api/meetings/${createdMeetingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.meetingId, createdMeetingId);
  });

  await suite.test('Meeting: Password protected meeting enforces verification for participants', async () => {
    // 1. Create a password protected meeting
    const createRes = await request(app)
      .post('/api/meetings/instant')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Confidential Security Meeting',
        password: 'SecretPassword123!'
      });

    assert.strictEqual(createRes.statusCode, 201);
    const lockedMeetingId = createRes.body.data.meetingId;

    // 2. Participant access validation with incorrect password returns 403 Forbidden
    const failRes = await request(app)
      .post('/api/meetings/validate-access')
      .send({
        meetingId: lockedMeetingId,
        password: 'WrongPassword'
      });

    assert.strictEqual(failRes.statusCode, 403);
    assert.strictEqual(failRes.body.success, false);
    assert.ok(failRes.body.message.includes('Incorrect meeting password'));

    // 3. Participant access validation with correct password succeeds
    const okRes = await request(app)
      .post('/api/meetings/validate-access')
      .send({
        meetingId: lockedMeetingId,
        password: 'SecretPassword123!'
      });

    assert.strictEqual(okRes.statusCode, 200);
    assert.strictEqual(okRes.body.data.allowed, true);
  });

  await suite.test('Meeting: In-meeting invite adds invitee and triggers notification', async () => {
    const res = await request(app)
      .post(`/api/meetings/${createdMeetingId}/invite`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'new_colleague@connectsphere.com', name: 'New Colleague' });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.invitees.some((i) => i.email === 'new_colleague@connectsphere.com'));
  });

  await suite.test('Scheduling: Schedule future recurring meeting with timezone', async () => {
    const res = await request(app)
      .post('/api/meetings/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Weekly Tech Lead Sync',
        description: 'Scheduled integration sync',
        scheduledDate: '2026-12-05',
        startTime: '15:30',
        duration: 45,
        timezone: 'Asia/Kolkata',
        recurrence: {
          type: 'weekly',
          interval: 1
        }
      });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.title, 'Weekly Tech Lead Sync');
    assert.strictEqual(res.body.data.timezone, 'Asia/Kolkata');
  });

  await suite.test('Scheduling: Calendar events endpoint retrieves scheduled meetings', async () => {
    const res = await request(app)
      .get('/api/meetings/calendar')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        start: '2026-12-01T00:00:00.000Z',
        end: '2026-12-31T23:59:59.000Z',
        timezone: 'Asia/Kolkata'
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  await suite.test('File Sharing: Upload allowed file type attaches to meeting', async () => {
    const testContent = Buffer.from('Integration test file content for ConnectSphere');
    const res = await request(app)
      .post(`/api/meetings/${createdMeetingId}/files`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('files', testContent, 'integration_test_doc.txt');

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.files));
    assert.strictEqual(res.body.data.files[0].originalName, 'integration_test_doc.txt');
  });

  await suite.test('File Sharing: Reject dangerous executable file uploads with 400', async () => {
    const maliciousContent = Buffer.from('MZ9000...executable content');
    const res = await request(app)
      .post(`/api/meetings/${createdMeetingId}/files`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('files', maliciousContent, 'exploit.exe');

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(
      res.body.message.includes('prohibited') ||
      res.body.message.includes('File type') ||
      res.body.message.includes('not allowed')
    );
  });

  await suite.test('Meeting Notes: Save and synchronize real-time collaborative notes', async () => {
    const res = await request(app)
      .put(`/api/meetings/${createdMeetingId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: '# Sprint 42 Decisions\n- Feature X approved.\n- Architecture tests passing.'
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.content.includes('Sprint 42 Decisions'));
  });

  await suite.test('Meeting Polls: Create poll and cast vote', async () => {
    // 1. Create poll
    const pollRes = await request(app)
      .post(`/api/meetings/${createdMeetingId}/polls`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        question: 'Should we release v1.0.0 today?',
        options: ['Yes, fully ready', 'Needs further testing']
      });

    assert.strictEqual(pollRes.statusCode, 201);
    const poll = pollRes.body.data;
    const pollId = poll.id || poll.pollId || poll._id;
    const optionId = poll.options[0].id || poll.options[0]._id;

    // 2. Cast vote
    const voteRes = await request(app)
      .post(`/api/meetings/${createdMeetingId}/polls/${pollId}/vote`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ optionId });

    assert.strictEqual(voteRes.statusCode, 200);
    assert.strictEqual(voteRes.body.success, true);
  });

  await suite.test('AI Features: Append transcript and perform smart search', async () => {
    // 1. Append transcript
    const transRes = await request(app)
      .post(`/api/ai/${createdMeetingId}/transcript/segment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        speakerName: 'Lead Architect',
        text: 'Antigravity end-to-end verification confirms production readiness with WebRTC mesh.',
        startTime: 0,
        endTime: 4
      });

    assert.strictEqual(transRes.statusCode, 201);

    // 2. Smart Search
    const searchRes = await request(app)
      .get('/api/ai/search')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ q: 'readiness', meetingId: createdMeetingId });

    assert.strictEqual(searchRes.statusCode, 200);
    assert.strictEqual(searchRes.body.success, true);
    assert.ok(searchRes.body.data.results.length >= 1);
  });

  await suite.test('Admin: Regular user is blocked from admin dashboard endpoints with 403', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
  });

  await suite.test('Auth: Logout clears the HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Should set cookie to clear token');
    assert.ok(setCookie[0].includes('token=none') || setCookie[0].includes('Expires='));
  });
});
