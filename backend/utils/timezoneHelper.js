/**
 * Timezone and Date-Time conversion helpers for ConnectSphere
 */

// Validate if a timezone string is supported by the Intl API
const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Parse time string (e.g. "14:30", "2:30 PM", "09:15 AM") into hour and minute
const parseTimeString = (timeStr = '10:00') => {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: 10, minute: 0 };
  }

  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');

  const numbersOnly = clean.replace(/[^\d:]/g, '');
  const parts = numbersOnly.split(':');
  let hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;

  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }

  return {
    hour: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute))
  };
};

/**
 * Converts local date, time, and timezone to exact UTC Date object.
 * Does not silently assume UTC when the user specifies a timezone.
 */
const parseDateTimeInTimezone = (dateInput, timeStr, timeZone = 'UTC', durationMinutes = 30) => {
  const safeTimezone = isValidTimezone(timeZone) ? timeZone : 'UTC';

  let year, month, day;

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
    day = dateInput.getDate();
  } else if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const dateParts = dateInput.split('T')[0].split('-');
    year = parseInt(dateParts[0], 10);
    month = parseInt(dateParts[1], 10);
    day = parseInt(dateParts[2], 10);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  const { hour, minute } = parseTimeString(timeStr);

  // Approximate UTC guess
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // Determine timezone offset using Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(utcGuess);
  const p = {};
  for (const part of parts) {
    if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10);
  }

  const tzHour = p.hour === 24 ? 0 : p.hour;
  const tzDate = new Date(Date.UTC(p.year, p.month - 1, p.day, tzHour, p.minute, p.second || 0));
  const offsetDiff = tzDate.getTime() - utcGuess.getTime();

  const startTime = new Date(utcGuess.getTime() - offsetDiff);
  const duration = parseInt(durationMinutes, 10) || 30;
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  return {
    startTime,
    endTime,
    timezone: safeTimezone,
    duration
  };
};

/**
 * Format a Date object in a human-friendly format in the target timezone
 */
const formatMeetingDateTime = (utcDate, timeZone = 'UTC') => {
  const safeTimezone = isValidTimezone(timeZone) ? timeZone : 'UTC';
  const dateObj = new Date(utcDate);

  if (isNaN(dateObj.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return formatter.format(dateObj);
};

/**
 * Generates virtual occurrences for recurring meetings within a window [rangeStart, rangeEnd]
 */
const expandRecurringInstances = (meeting, rangeStart, rangeEnd) => {
  if (!meeting.recurrence || meeting.recurrence.type === 'none') {
    return [meeting];
  }

  const instances = [];
  const type = meeting.recurrence.type;
  const interval = meeting.recurrence.interval || 1;
  const recurrenceEnd = meeting.recurrence.endDate ? new Date(meeting.recurrence.endDate) : null;
  const originalStart = new Date(meeting.startTime || meeting.scheduledDate);
  const durationMs = (meeting.duration || 30) * 60 * 1000;

  const windowStart = new Date(rangeStart);
  const windowEnd = new Date(rangeEnd);

  let currentStart = new Date(originalStart);
  let count = 0;
  const MAX_INSTANCES = 100;

  while (currentStart <= windowEnd && count < MAX_INSTANCES) {
    if (recurrenceEnd && currentStart > recurrenceEnd) {
      break;
    }

    if (currentStart >= windowStart) {
      const currentEnd = new Date(currentStart.getTime() + durationMs);
      instances.push({
        ...meeting,
        id: `${meeting.id || meeting._id}_occ_${currentStart.getTime()}`,
        startTime: new Date(currentStart),
        endTime: currentEnd,
        isRecurringOccurrence: true,
        parentMeetingId: meeting.meetingId
      });
    }

    // Step forward
    if (type === 'daily') {
      currentStart.setDate(currentStart.getDate() + interval);
    } else if (type === 'weekly') {
      currentStart.setDate(currentStart.getDate() + 7 * interval);
    } else if (type === 'monthly') {
      currentStart.setMonth(currentStart.getMonth() + interval);
    } else {
      break;
    }

    count += 1;
  }

  return instances;
};

module.exports = {
  isValidTimezone,
  parseTimeString,
  parseDateTimeInTimezone,
  formatMeetingDateTime,
  expandRecurringInstances
};

