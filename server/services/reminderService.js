const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const logger = require('../utils/logger');

class ReminderService {
  constructor() {
    this.intervalId = null;
    this.io = null;
    this.inMemoryReminders = new Map(); // meetingId -> Reminder metadata
  }

  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  start(io = null) {
    if (this.intervalId) return;
    this.io = io;
    logger.info('Meeting Reminder Service started (checking every 30s)');

    // Initial check on startup
    this.checkReminders().catch((err) => logger.warn(`Reminder check error: ${err.message}`));

    this.intervalId = setInterval(() => {
      this.checkReminders().catch((err) => logger.warn(`Reminder check error: ${err.message}`));
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Meeting Reminder Service stopped.');
    }
  }

  // Core reminder check
  async checkReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000); // 5 mins in past
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins in future

    if (this.isDbConnected()) {
      try {
        // Query scheduled meetings starting within next 15 mins that have unsent reminders
        // Excludes cancelled, ended, or active meetings!
        const upcomingMeetings = await Meeting.find({
          status: 'scheduled',
          startTime: { $gte: windowStart, $lte: windowEnd },
          'reminders.sent': false
        });

        for (const meeting of upcomingMeetings) {
          // Double check status is not cancelled
          if (meeting.status === 'cancelled') continue;

          let updated = false;
          if (meeting.reminders && meeting.reminders.length > 0) {
            for (const r of meeting.reminders) {
              if (!r.sent) {
                r.sent = true;
                r.sentAt = now;
                updated = true;
              }
            }
          } else {
            meeting.reminders = [{ minutesBefore: 15, sent: true, sentAt: now }];
            updated = true;
          }

          if (updated) {
            await meeting.save();
            logger.info(`Meeting reminder triggered for [${meeting.title}] (${meeting.meetingId})`);

            // Broadcast via Socket.IO if available
            if (this.io) {
              this.io.emit('upcoming-meeting-reminder', {
                meetingId: meeting.meetingId,
                title: meeting.title,
                startTime: meeting.startTime,
                duration: meeting.duration,
                startsInMinutes: Math.max(0, Math.round((new Date(meeting.startTime).getTime() - now.getTime()) / 60000))
              });
            }
          }
        }
      } catch (err) {
        logger.warn(`Reminder check query error: ${err.message}`);
      }
    }
  }

  // Retrieve upcoming active reminders for an authenticated user
  async getUserReminders(userId, userEmail) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // up to 10 mins ago
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // within next 60 minutes

    const reminders = [];

    if (this.isDbConnected() && (userId || userEmail)) {
      try {
        const query = {
          status: 'scheduled', // Excludes cancelled!
          startTime: { $gte: windowStart, $lte: windowEnd },
          $or: []
        };

        if (userId) query.$or.push({ host: userId });
        if (userEmail) query.$or.push({ 'invitees.email': userEmail.toLowerCase().trim() });

        if (query.$or.length > 0) {
          const meetings = await Meeting.find(query).sort({ startTime: 1 });
          for (const m of meetings) {
            const startsInMinutes = Math.round((new Date(m.startTime).getTime() - now.getTime()) / 60000);
            reminders.push({
              meetingId: m.meetingId,
              title: m.title,
              description: m.description,
              startTime: m.startTime,
              duration: m.duration,
              timezone: m.timezone,
              isHost: userId && m.host && m.host.toString() === userId.toString(),
              startsInMinutes
            });
          }
        }
      } catch (err) {
        logger.warn(`getUserReminders error: ${err.message}`);
      }
    }

    return reminders;
  }
}

module.exports = new ReminderService();

