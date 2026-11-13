const test = require('node:test');
const assert = require('node:assert');
const {
  isValidTimezone,
  parseTimeString,
  parseDateTimeInTimezone,
  formatMeetingDateTime,
  expandRecurringInstances
} = require('../../utils/timezoneHelper');

test('Timezone and Scheduling Utilities - Unit Tests', async (t) => {
  await t.test('isValidTimezone correctly verifies valid IANA timezone identifiers', () => {
    assert.strictEqual(isValidTimezone('UTC'), true);
    assert.strictEqual(isValidTimezone('Asia/Kolkata'), true);
    assert.strictEqual(isValidTimezone('America/New_York'), true);
    assert.strictEqual(isValidTimezone('Europe/London'), true);
    assert.strictEqual(isValidTimezone('Invalid/Timezone'), false);
    assert.strictEqual(isValidTimezone(''), false);
    assert.strictEqual(isValidTimezone(null), false);
    assert.strictEqual(isValidTimezone(123), false);
  });

  await t.test('parseTimeString parses 24h and 12h AM/PM strings accurately', () => {
    assert.deepStrictEqual(parseTimeString('14:30'), { hour: 14, minute: 30 });
    assert.deepStrictEqual(parseTimeString('09:15'), { hour: 9, minute: 15 });
    assert.deepStrictEqual(parseTimeString('2:30 PM'), { hour: 14, minute: 30 });
    assert.deepStrictEqual(parseTimeString('11:45 AM'), { hour: 11, minute: 45 });
    assert.deepStrictEqual(parseTimeString('12:00 PM'), { hour: 12, minute: 0 }); // Noon
    assert.deepStrictEqual(parseTimeString('12:00 AM'), { hour: 0, minute: 0 });  // Midnight
    assert.deepStrictEqual(parseTimeString(''), { hour: 10, minute: 0 }); // Default fallback
  });

  await t.test('parseDateTimeInTimezone respects timezone offsets without assuming UTC', () => {
    // 10:00 AM in Asia/Kolkata (UTC+5:30) is 04:30 UTC
    const kolkataParsed = parseDateTimeInTimezone('2026-12-01', '10:00', 'Asia/Kolkata', 45);
    assert.strictEqual(kolkataParsed.timezone, 'Asia/Kolkata');
    assert.strictEqual(kolkataParsed.duration, 45);
    const kolkataUtc = kolkataParsed.startTime.toISOString();
    assert.strictEqual(kolkataUtc, '2026-12-01T04:30:00.000Z');

    // End time must be 45 minutes after start time
    const expectedEnd = new Date(kolkataParsed.startTime.getTime() + 45 * 60 * 1000).toISOString();
    assert.strictEqual(kolkataParsed.endTime.toISOString(), expectedEnd);

    // 10:00 AM in UTC is 10:00 UTC
    const utcParsed = parseDateTimeInTimezone('2026-12-01', '10:00', 'UTC', 60);
    assert.strictEqual(utcParsed.startTime.toISOString(), '2026-12-01T10:00:00.000Z');
  });

  await t.test('formatMeetingDateTime formats in specified timezones', () => {
    const utcDate = new Date('2026-12-01T04:30:00.000Z');
    const formattedKolkata = formatMeetingDateTime(utcDate, 'Asia/Kolkata');
    assert.ok(formattedKolkata.includes('10:00'), `Expected 10:00 in Asia/Kolkata, got: ${formattedKolkata}`);
    assert.ok(formattedKolkata.includes('Dec') || formattedKolkata.includes('12'));

    const formattedUtc = formatMeetingDateTime(utcDate, 'UTC');
    assert.ok(formattedUtc.includes('4:30'), `Expected 4:30 in UTC, got: ${formattedUtc}`);
  });

  await t.test('expandRecurringInstances creates recurring instances for daily meetings', () => {
    const baseMeeting = {
      meetingId: 'rec-101',
      title: 'Daily Standup',
      duration: 30,
      startTime: new Date('2026-12-01T10:00:00.000Z'),
      recurrence: {
        type: 'daily',
        interval: 1,
        endDate: new Date('2026-12-05T10:00:00.000Z')
      }
    };

    const instances = expandRecurringInstances(
      baseMeeting,
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-12-05T23:59:59.000Z')
    );

    assert.strictEqual(instances.length, 5, 'Should generate 5 daily occurrences');
    assert.strictEqual(instances[0].parentMeetingId, 'rec-101');
    assert.strictEqual(instances[0].isRecurringOccurrence, true);
  });

  await t.test('expandRecurringInstances creates instances for weekly meetings', () => {
    const baseMeeting = {
      meetingId: 'rec-202',
      title: 'Weekly Sync',
      duration: 60,
      startTime: new Date('2026-12-01T14:00:00.000Z'),
      recurrence: {
        type: 'weekly',
        interval: 1,
        endDate: new Date('2026-12-22T14:00:00.000Z')
      }
    };

    const instances = expandRecurringInstances(
      baseMeeting,
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-12-31T23:59:59.000Z')
    );

    assert.strictEqual(instances.length, 4, 'Should generate 4 weekly occurrences in December');
  });

  await t.test('expandRecurringInstances returns original meeting if non-recurring', () => {
    const singleMeeting = {
      meetingId: 'single-001',
      title: 'One-off Sync',
      recurrence: { type: 'none' }
    };
    const instances = expandRecurringInstances(singleMeeting, new Date(), new Date());
    assert.strictEqual(instances.length, 1);
    assert.strictEqual(instances[0].meetingId, 'single-001');
  });
});

