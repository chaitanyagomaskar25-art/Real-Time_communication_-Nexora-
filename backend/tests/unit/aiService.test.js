const test = require('node:test');
const assert = require('node:assert');
const aiService = require('../../services/aiService');

test('AI Productivity Service - Unit Tests', async (t) => {
  const testMeetingId = `test_ai_${Date.now()}`;

  await t.test('appendTranscriptSegment appends live speaker transcript segments', async () => {
    const segment1 = await aiService.appendTranscriptSegment({
      meetingId: testMeetingId,
      speakerId: 'user-alice',
      speakerName: 'Alice Johnson',
      text: 'Let us discuss the quarterly deployment goals and assign CI/CD tasks to Bob.',
      startTime: 0,
      endTime: 5
    });

    assert.ok(segment1.segmentId);
    assert.strictEqual(segment1.speakerName, 'Alice Johnson');
    assert.ok(segment1.text.includes('quarterly deployment'));

    const segment2 = await aiService.appendTranscriptSegment({
      meetingId: testMeetingId,
      speakerId: 'user-bob',
      speakerName: 'Bob Smith',
      text: 'I agree. I will finalize the Docker compose configuration by Friday.',
      startTime: 6,
      endTime: 12
    });

    assert.ok(segment2.segmentId);
    assert.strictEqual(segment2.speakerName, 'Bob Smith');
  });

  await t.test('getTranscript retrieves all appended segments for a meeting', async () => {
    const transcript = await aiService.getTranscript(testMeetingId);
    assert.strictEqual(transcript.meetingId, testMeetingId);
    assert.ok(transcript.segments.length >= 2, 'Should contain at least 2 segments');
    assert.strictEqual(transcript.segments[0].speakerName, 'Alice Johnson');
    assert.strictEqual(transcript.segments[1].speakerName, 'Bob Smith');
  });

  await t.test('createActionItem adds new actionable tasks', async () => {
    const task = await aiService.createActionItem(testMeetingId, {
      title: 'Finalize Docker compose configuration',
      assigneeName: 'Bob Smith',
      dueDate: '2026-12-10'
    });

    assert.ok(task.taskId);
    assert.strictEqual(task.title, 'Finalize Docker compose configuration');
    assert.strictEqual(task.assigneeName, 'Bob Smith');
    assert.strictEqual(task.status, 'pending');
  });

  await t.test('updateActionItem marks task as completed', async () => {
    const actionItems = await aiService.getActionItems(testMeetingId);
    assert.ok(actionItems.length > 0);
    const targetTask = actionItems[0];

    const updated = await aiService.updateActionItem(testMeetingId, targetTask.taskId, {
      status: 'completed'
    });

    assert.strictEqual(updated.status, 'completed');
    assert.ok(updated.completedAt, 'Should have completedAt date');
  });

  await t.test('smartSearch finds occurrences in meeting transcripts', async () => {
    const searchRes = await aiService.smartSearch({
      query: 'Docker',
      meetingIdFilter: testMeetingId
    });

    assert.ok(searchRes.results.length >= 1, 'Should find at least 1 match for Docker');
    const match = searchRes.results[0];
    assert.ok(match.text.toLowerCase().includes('docker'));
  });

  await t.test('deleteActionItem removes task successfully', async () => {
    const actionItemsBefore = await aiService.getActionItems(testMeetingId);
    const idToDelete = actionItemsBefore[0].taskId;

    const res = await aiService.deleteActionItem(testMeetingId, idToDelete);
    assert.strictEqual(res, true);

    const actionItemsAfter = await aiService.getActionItems(testMeetingId);
    const exists = actionItemsAfter.some((t) => t.taskId === idToDelete);
    assert.strictEqual(exists, false, 'Deleted task should no longer exist');
  });
});

