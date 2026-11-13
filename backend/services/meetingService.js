const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Meeting = require('../models/Meeting');
const logger = require('../utils/logger');
const { parseDateTimeInTimezone, expandRecurringInstances, formatMeetingDateTime } = require('../utils/timezoneHelper');

// In-memory fallback map: meetingId -> Meeting object
const inMemoryMeetings = new Map();

class MeetingService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Generate unique readable meeting ID: xxx-yyyy-zzz
  generateMeetingId() {
    const p1 = crypto.randomBytes(2).toString('hex');
    const p2 = crypto.randomBytes(2).toString('hex');
    const p3 = crypto.randomBytes(2).toString('hex');
    return `${p1}-${p2}-${p3}`;
  }

  // Normalize invitee list
  normalizeInvitees(invitees = []) {
    if (!Array.isArray(invitees)) return [];
    return invitees
      .map((inv) => {
        if (typeof inv === 'string') {
          const email = inv.toLowerCase().trim();
          return email ? { email, name: '', status: 'pending', invitedAt: new Date(), respondedAt: null } : null;
        }
        if (inv && inv.email) {
          return {
            email: inv.email.toLowerCase().trim(),
            name: (inv.name || '').trim(),
            status: inv.status || 'pending',
            invitedAt: inv.invitedAt || new Date(),
            respondedAt: inv.respondedAt || null
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  // 1. Create Instant Meeting
  async createInstantMeeting({ meetingId: customMeetingId, hostId, hostName, hostEmail, title, description, password, settings, isChatCall = false, meetingType = null }) {
    const meetingId = (customMeetingId || this.generateMeetingId()).toLowerCase().trim();
    const cleanTitle = (title || 'ConnectSphere Instant Meeting').trim();
    const isPasswordProtected = Boolean(password && password.trim().length > 0);

    const isDetectedChatCall = Boolean(
      isChatCall ||
      meetingType === 'chat_call' ||
      meetingId.startsWith('dm-') ||
      meetingId.startsWith('voice-') ||
      meetingId.includes('-video-') ||
      meetingId.includes('-voice-') ||
      cleanTitle.toLowerCase().includes('voice call') ||
      cleanTitle.toLowerCase().includes('video call')
    );

    const resolvedMeetingType = isDetectedChatCall ? 'chat_call' : (meetingType || 'instant');

    const meetingSettings = {
      waitingRoomEnabled: Boolean(settings?.waitingRoomEnabled),
      isLocked: Boolean(settings?.isLocked),
      muteOnEntry: Boolean(settings?.muteOnEntry),
      videoOffOnEntry: Boolean(settings?.videoOffOnEntry),
      allowScreenShare: settings?.allowScreenShare !== false,
      allowChat: settings?.allowChat !== false
    };

    const startTime = new Date();
    const duration = 120;
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);
    const validHostId = isValidObjectId(hostId) ? hostId : null;

    if (this.isDbConnected()) {
      try {
        const meeting = await Meeting.create({
          meetingId,
          title: cleanTitle,
          description: (description || '').trim(),
          timezone: 'UTC',
          host: validHostId,
          hostName: hostName || 'Host',
          hostEmail: hostEmail || '',
          isPasswordProtected,
          password: isPasswordProtected ? password.trim() : null,
          startTime,
          endTime,
          duration,
          status: 'active',
          isScheduled: false,
          meetingType: resolvedMeetingType,
          settings: meetingSettings,
          participants: hostName
            ? [
                {
                  userId: validHostId,
                  name: hostName,
                  email: hostEmail || '',
                  role: 'host',
                  joinedAt: new Date()
                }
              ]
            : []
        });

        return meeting.toSafeObject(hostId);
      } catch (dbErr) {
        if (dbErr.code === 11000) {
          const existing = await Meeting.findOne({ meetingId }).select('+password');
          if (existing) {
            existing.status = 'active';
            await existing.save().catch(() => {});
            return typeof existing.toSafeObject === 'function' ? existing.toSafeObject(hostId) : existing;
          }
        }
        logger.warn(`MeetingService createInstantMeeting fallback: ${dbErr.message}`);
      }
    }

    // In-memory fallback
    const mockId = 'mem_mtg_' + meetingId;
    let hashedPassword = null;
    if (isPasswordProtected) {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    const memMeeting = {
      id: mockId,
      _id: mockId,
      meetingId,
      title: cleanTitle,
      description: (description || '').trim(),
      timezone: 'UTC',
      host: hostId || null,
      hostName: hostName || 'Host',
      hostEmail: hostEmail || '',
      isPasswordProtected,
      password: hashedPassword,
      startTime,
      endTime,
      duration,
      status: 'active',
      settings: meetingSettings,
      invitees: [],
      participants: hostName
        ? [
            {
              userId: hostId || null,
              name: hostName,
              email: hostEmail || '',
              role: 'host',
              joinedAt: new Date()
            }
          ]
        : [],
      createdAt: new Date(),
      toSafeObject(currUserId = null) {
        const isHost = currUserId && this.host && this.host.toString() === currUserId.toString();
        const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${this.meetingId}`;
        return {
          id: this.id,
          meetingId: this.meetingId,
          roomId: this.meetingId,
          title: this.title,
          description: this.description || '',
          timezone: this.timezone || 'UTC',
          host: this.host,
          hostName: this.hostName,
          hostEmail: this.hostEmail,
          isHost: Boolean(isHost),
          isPasswordProtected: this.isPasswordProtected,
          startTime: this.startTime,
          endTime: this.endTime,
          duration: this.duration,
          durationMinutes: this.duration,
          status: this.status,
          settings: this.settings,
          invitees: this.invitees || [],
          recurrence: { type: 'none', interval: 1, endDate: null },
          reminders: [],
          inviteLink,
          participants: this.participants || [],
          participantCount: this.participants ? this.participants.filter((p) => !p.leftAt).length : 0,
          isReported: Boolean(this.isReported),
          isTerminatedByAdmin: Boolean(this.isTerminatedByAdmin),
          adminTerminationReason: this.adminTerminationReason || '',
          createdAt: this.createdAt
        };
      }
    };

    inMemoryMeetings.set(meetingId.toLowerCase().trim(), memMeeting);
    inMemoryMeetings.set(meetingId.toLowerCase().trim().replace(/-/g, ''), memMeeting);
    return memMeeting.toSafeObject(hostId);
  }

  // 2. Schedule Future Meeting with Timezone Conversion & Invitee Management
  async scheduleMeeting({
    hostId,
    hostName,
    hostEmail,
    title,
    description,
    scheduledDate,
    scheduledTime,
    duration,
    timezone = 'UTC',
    invitees = [],
    recurrence,
    password,
    settings
  }) {
    const meetingId = this.generateMeetingId();
    const cleanTitle = (title || 'Scheduled Conference').trim();
    const cleanDescription = (description || '').trim();
    const isPasswordProtected = Boolean(password && password.trim().length > 0);
    const parsedDuration = parseInt(duration, 10) || 30;

    // Convert date + time + timezone into exact UTC startTime and endTime
    const { startTime, endTime, timezone: resolvedTimezone } = parseDateTimeInTimezone(
      scheduledDate,
      scheduledTime,
      timezone,
      parsedDuration
    );

    const meetingSettings = {
      waitingRoomEnabled: Boolean(settings?.waitingRoomEnabled),
      isLocked: Boolean(settings?.isLocked),
      muteOnEntry: Boolean(settings?.muteOnEntry),
      videoOffOnEntry: Boolean(settings?.videoOffOnEntry),
      allowScreenShare: settings?.allowScreenShare !== false,
      allowChat: settings?.allowChat !== false
    };

    const normalizedInvitees = this.normalizeInvitees(invitees);

    const recurrenceConfig = {
      type: recurrence?.type && ['daily', 'weekly', 'monthly'].includes(recurrence.type) ? recurrence.type : 'none',
      interval: parseInt(recurrence?.interval, 10) || 1,
      endDate: recurrence?.endDate ? new Date(recurrence.endDate) : null
    };

    const parsedDate = scheduledDate ? new Date(scheduledDate) : new Date(startTime);

    if (this.isDbConnected()) {
      try {
        const meeting = await Meeting.create({
          meetingId,
          title: cleanTitle,
          description: cleanDescription,
          timezone: resolvedTimezone,
          host: hostId || null,
          hostName: hostName || 'Host',
          hostEmail: hostEmail || '',
          isPasswordProtected,
          password: isPasswordProtected ? password.trim() : null,
          scheduledDate: parsedDate,
          scheduledTime: scheduledTime || '10:00 AM',
          duration: parsedDuration,
          startTime,
          endTime,
          invitees: normalizedInvitees,
          recurrence: recurrenceConfig,
          reminders: [{ minutesBefore: 15, sent: false, sentAt: null }],
          status: 'scheduled',
          isScheduled: true,
          meetingType: 'scheduled',
          settings: meetingSettings,
          participants: []
        });

        logger.info(`Scheduled meeting created: [${cleanTitle}] (${meetingId}) starting at [${startTime.toISOString()}] (${resolvedTimezone})`);

        // Send meeting invite notifications to any registered invitees
        try {
          const notificationService = require('./notificationService');
          const User = require('../models/User');
          for (const inv of normalizedInvitees) {
            if (!inv.email) continue;
            const targetUser = await User.findOne({ email: inv.email.toLowerCase() });
            if (targetUser && targetUser._id.toString() !== (hostId ? hostId.toString() : '')) {
              await notificationService.createNotification({
                recipient: targetUser._id.toString(),
                recipientId: targetUser._id.toString(),
                sender: hostId || null,
                senderId: hostId || null,
                senderName: hostName || 'ConnectSphere Host',
                type: 'meeting-invite',
                title: 'Meeting Invitation',
                message: `${hostName || 'A host'} invited you to "${cleanTitle}"`,
                data: {
                  meetingId,
                  roomId: meetingId,
                  title: cleanTitle,
                  scheduledDate: parsedDate,
                  scheduledTime: scheduledTime || '10:00 AM',
                  startTime,
                  status: 'pending',
                  inviteLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${meetingId}`
                }
              });
            }
          }
        } catch (inviteErr) {
          logger.warn(`Failed to dispatch schedule notifications: ${inviteErr.message}`);
        }

        return meeting.toSafeObject(hostId);
      } catch (dbErr) {
        logger.warn(`MeetingService scheduleMeeting fallback: ${dbErr.message}`);
      }
    }

    // In-memory fallback
    const mockId = 'mem_mtg_' + meetingId;
    let hashedPassword = null;
    if (isPasswordProtected) {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    const memMeeting = {
      id: mockId,
      _id: mockId,
      meetingId,
      title: cleanTitle,
      description: cleanDescription,
      timezone: resolvedTimezone,
      host: hostId || null,
      hostName: hostName || 'Host',
      hostEmail: hostEmail || '',
      isPasswordProtected,
      password: hashedPassword,
      scheduledDate: parsedDate,
      scheduledTime: scheduledTime || '10:00 AM',
      duration: parsedDuration,
      startTime,
      endTime,
      invitees: normalizedInvitees,
      recurrence: recurrenceConfig,
      reminders: [{ minutesBefore: 15, sent: false, sentAt: null }],
      status: 'scheduled',
      settings: meetingSettings,
      participants: [],
      createdAt: new Date(),
      toSafeObject(currUserId = null) {
        const isHost = currUserId && this.host && this.host.toString() === currUserId.toString();
        const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${this.meetingId}`;
        return {
          id: this.id,
          meetingId: this.meetingId,
          roomId: this.meetingId,
          title: this.title,
          description: this.description,
          timezone: this.timezone,
          host: this.host,
          hostName: this.hostName,
          hostEmail: this.hostEmail,
          isHost: Boolean(isHost),
          isPasswordProtected: this.isPasswordProtected,
          scheduledDate: this.scheduledDate,
          scheduledTime: this.scheduledTime,
          duration: this.duration,
          durationMinutes: this.duration,
          startTime: this.startTime,
          endTime: this.endTime,
          status: this.status,
          settings: this.settings,
          invitees: this.invitees,
          recurrence: this.recurrence,
          reminders: this.reminders,
          inviteLink,
          participants: this.participants || [],
          participantCount: 0,
          isReported: Boolean(this.isReported),
          isTerminatedByAdmin: Boolean(this.isTerminatedByAdmin),
          adminTerminationReason: this.adminTerminationReason || '',
          createdAt: this.createdAt
        };
      }
    };

    inMemoryMeetings.set(meetingId.toLowerCase().trim(), memMeeting);
    inMemoryMeetings.set(meetingId.toLowerCase().trim().replace(/-/g, ''), memMeeting);
    return memMeeting.toSafeObject(hostId);
  }

  // 3. Edit / Update Scheduled Meeting
  async updateScheduledMeeting(meetingId, updateData, userId) {
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
      } catch (err) {
        logger.warn(`updateScheduledMeeting find error: ${err.message}`);
      }
    }

    if (!meeting) {
      meeting = inMemoryMeetings.get(meetingId);
    }

    if (!meeting) {
      throw new Error('Meeting not found.');
    }

    // Permission check: Host only
    if (meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
      throw new Error('Only the meeting host can edit this meeting.');
    }

    if (meeting.status === 'cancelled') {
      throw new Error('Cannot edit a cancelled meeting.');
    }

    // Apply updates
    if (updateData.title !== undefined) meeting.title = updateData.title.trim() || meeting.title;
    if (updateData.description !== undefined) meeting.description = (updateData.description || '').trim();

    const newDuration = updateData.duration ? parseInt(updateData.duration, 10) : meeting.duration || 30;
    meeting.duration = newDuration;

    if (updateData.timezone !== undefined) {
      meeting.timezone = updateData.timezone;
    }

    // If date or time updated, recompute UTC startTime and endTime
    if (updateData.scheduledDate !== undefined || updateData.scheduledTime !== undefined || updateData.timezone !== undefined || updateData.duration !== undefined) {
      const targetDate = updateData.scheduledDate || meeting.scheduledDate;
      const targetTime = updateData.scheduledTime || meeting.scheduledTime;
      const targetTz = updateData.timezone || meeting.timezone || 'UTC';

      const { startTime, endTime } = parseDateTimeInTimezone(targetDate, targetTime, targetTz, newDuration);
      meeting.startTime = startTime;
      meeting.endTime = endTime;
      meeting.scheduledDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
      meeting.scheduledTime = targetTime;

      // Reset reminders if schedule changed
      meeting.reminders = [{ minutesBefore: 15, sent: false, sentAt: null }];
    }

    // Update invitees if provided
    if (updateData.invitees !== undefined) {
      meeting.invitees = this.normalizeInvitees(updateData.invitees);
    }

    // Update recurrence
    if (updateData.recurrence !== undefined) {
      meeting.recurrence = {
        type: updateData.recurrence.type || 'none',
        interval: parseInt(updateData.recurrence.interval, 10) || 1,
        endDate: updateData.recurrence.endDate ? new Date(updateData.recurrence.endDate) : null
      };
    }

    // Update settings
    if (updateData.settings) {
      meeting.settings = { ...meeting.settings, ...updateData.settings };
    }

    // Update password
    if (updateData.password !== undefined) {
      if (updateData.password && updateData.password.trim().length > 0) {
        if (this.isDbConnected() && typeof meeting.save === 'function') {
          meeting.password = updateData.password.trim();
          meeting.isPasswordProtected = true;
        } else {
          meeting.password = await bcrypt.hash(updateData.password.trim(), 10);
          meeting.isPasswordProtected = true;
        }
      } else {
        meeting.password = null;
        meeting.isPasswordProtected = false;
      }
    }

    if (this.isDbConnected() && typeof meeting.save === 'function') {
      await meeting.save();
    }

    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting;
  }

  // 4. Validate Meeting Access (joining credentials, passwords, waiting room, lock state)
  async validateMeetingAccess({ meetingId, userId, userName, userEmail, password }) {
    if (!meetingId) {
      throw new Error('Meeting ID is required.');
    }

    const cleanId = meetingId.toLowerCase().trim();
    const strippedId = cleanId.replace(/-/g, '');

    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({
          $or: [{ meetingId: cleanId }, { meetingId: strippedId }]
        }).select('+password');
      } catch (err) {
        logger.warn(`MeetingService validateMeetingAccess query error: ${err.message}`);
      }
    }

    if (!meeting) {
      meeting = inMemoryMeetings.get(cleanId);
      if (!meeting) {
        for (const [key, mem] of inMemoryMeetings.entries()) {
          if (key.toLowerCase().trim().replace(/-/g, '') === strippedId) {
            meeting = mem;
            break;
          }
        }
      }
    }

    // Auto-create instant meeting if not found so instant chat calls work immediately without scheduling
    if (!meeting) {
      try {
        let callTitle = 'Instant Call';
        if (cleanId.startsWith('voice-')) {
          callTitle = 'Voice Call';
        } else if (cleanId.startsWith('dm-')) {
          callTitle = 'Direct Call';
        } else if (cleanId.startsWith('group-')) {
          callTitle = 'Group Conference';
        } else {
          callTitle = `Conference ${cleanId}`;
        }

        const newMeeting = await this.createInstantMeeting({
          meetingId: cleanId,
          hostId: userId || null,
          hostName: userName || 'Host',
          hostEmail: userEmail || '',
          title: callTitle,
          settings: {
            waitingRoomEnabled: false,
            isLocked: false,
            muteOnEntry: false,
            videoOffOnEntry: false,
            allowScreenShare: true,
            allowChat: true
          }
        });

        return {
          allowed: true,
          isHost: true,
          requiresWaitingRoom: false,
          meeting: newMeeting
        };
      } catch (autoErr) {
        logger.warn(`Auto-creating instant meeting failed for ${cleanId}: ${autoErr.message}`);
        throw new Error('Meeting not found or has expired. Please verify your meeting code.');
      }
    }

    // Check if meeting was cancelled or ended
    if (meeting.status === 'cancelled') {
      throw new Error('This meeting has been cancelled by the host.');
    }
    if (meeting.status === 'ended') {
      throw new Error('This call has already ended.');
    }

    const isHost = Boolean(userId && meeting.host && meeting.host.toString() === userId.toString());

    // Host always has instant access
    if (isHost) {
      return {
        allowed: true,
        isHost: true,
        requiresWaitingRoom: false,
        meeting: typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting
      };
    }

    // Check if meeting is locked
    if (meeting.settings?.isLocked) {
      throw new Error('This meeting is currently locked by the host.');
    }

    // Check password protection
    if (meeting.isPasswordProtected) {
      if (!password || password.trim().length === 0) {
        return {
          allowed: false,
          requiresPassword: true,
          message: 'Password required to join this meeting.'
        };
      }

      let isMatch = false;
      if (typeof meeting.matchPassword === 'function') {
        isMatch = await meeting.matchPassword(password.trim());
      } else if (meeting.password) {
        isMatch = await bcrypt.compare(password.trim(), meeting.password);
      }

      if (!isMatch) {
        throw new Error('Incorrect meeting password. Please try again.');
      }
    }

    // Check Waiting Room
    const requiresWaitingRoom = Boolean(meeting.settings?.waitingRoomEnabled);

    return {
      allowed: true,
      isHost: false,
      requiresWaitingRoom,
      meeting: typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting
    };
  }

  // 5. Get Meeting by ID
  async getMeetingById(meetingId, currentUserId = null) {
    if (!meetingId) return null;
    const cleanId = meetingId.toLowerCase().trim();
    const strippedId = cleanId.replace(/-/g, '');

    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({
          $or: [{ meetingId: cleanId }, { meetingId: strippedId }]
        });
      } catch (e) {
        // Fallback
      }
    }

    if (!meeting) {
      meeting = inMemoryMeetings.get(cleanId);
      if (!meeting) {
        for (const [key, mem] of inMemoryMeetings.entries()) {
          if (key.toLowerCase().trim().replace(/-/g, '') === strippedId) {
            meeting = mem;
            break;
          }
        }
      }
    }

    if (!meeting) {
      return null;
    }

    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(currentUserId) : meeting;
  }

  // 6. Get User's Upcoming Scheduled Meetings
  async getUserUpcomingMeetings(userId, userEmail = null) {
    const now = new Date(Date.now() - 2 * 60 * 60 * 1000); // include meetings starting in last 2 hours
    const results = [];

    if (this.isDbConnected() && (userId || userEmail)) {
      try {
        const query = {
          status: { $in: ['scheduled', 'active'] }, // Excludes cancelled!
          $and: [{ $or: [{ endTime: { $gte: now } }, { startTime: { $gte: now } }, { scheduledDate: { $gte: now } }] }],
          $or: []
        };

        if (userId) query.$or.push({ host: userId });
        if (userEmail) query.$or.push({ 'invitees.email': userEmail.toLowerCase().trim() });

        if (query.$or.length > 0) {
          const meetings = await Meeting.find(query).sort({ startTime: 1, scheduledDate: 1 });
          return meetings.map((m) => m.toSafeObject(userId));
        }
      } catch (e) {
        // Fallback
      }
    }

    for (const m of inMemoryMeetings.values()) {
      const isHost = userId && m.host && m.host.toString() === userId.toString();
      const isInvitee = userEmail && m.invitees?.some((inv) => inv.email === userEmail.toLowerCase().trim());
      if ((isHost || isInvitee) && (m.status === 'scheduled' || m.status === 'active')) {
        results.push(typeof m.toSafeObject === 'function' ? m.toSafeObject(userId) : m);
      }
    }
    return results;
  }

  // 7. Get Calendar Meetings with recurrence expansion
  async getUserCalendarMeetings(userId, userEmail, { start, end, timezone = 'UTC' } = {}) {
    const rangeStart = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rangeEnd = end ? new Date(end) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    let baseMeetings = [];

    if (this.isDbConnected() && (userId || userEmail)) {
      try {
        const query = {
          status: { $ne: 'cancelled' }, // Do not include cancelled meetings in active calendar
          $or: []
        };

        if (userId) query.$or.push({ host: userId });
        if (userEmail) query.$or.push({ 'invitees.email': userEmail.toLowerCase().trim() });

        if (query.$or.length > 0) {
          const meetings = await Meeting.find(query).sort({ startTime: 1 });
          baseMeetings = meetings.map((m) => m.toSafeObject(userId));
        }
      } catch (e) {
        logger.warn(`getUserCalendarMeetings db error: ${e.message}`);
      }
    }

    if (baseMeetings.length === 0) {
      for (const m of inMemoryMeetings.values()) {
        const isHost = userId && m.host && m.host.toString() === userId.toString();
        const isInvitee = userEmail && m.invitees?.some((inv) => inv.email === userEmail.toLowerCase().trim());
        if ((isHost || isInvitee) && m.status !== 'cancelled') {
          baseMeetings.push(typeof m.toSafeObject === 'function' ? m.toSafeObject(userId) : m);
        }
      }
    }

    // Expand recurrence and attach formatted timestamps in target timezone
    const expanded = [];
    for (const m of baseMeetings) {
      const occurrences = expandRecurringInstances(m, rangeStart, rangeEnd);
      for (const occ of occurrences) {
        const startTimestamp = occ.startTime || occ.scheduledDate;
        expanded.push({
          ...occ,
          formattedStartTime: formatMeetingDateTime(startTimestamp, timezone || occ.timezone),
          formattedEndTime: formatMeetingDateTime(occ.endTime, timezone || occ.timezone)
        });
      }
    }

    return expanded.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  // 8. Get User's Meeting History (scheduled meetings only, excluding ad-hoc calls from chat)
  async getUserMeetingHistory(userId) {
    if (this.isDbConnected() && userId) {
      try {
        const meetings = await Meeting.find({
          $and: [
            { $or: [{ host: userId }, { 'participants.userId': userId }] },
            {
              $or: [
                { isScheduled: true },
                { meetingType: 'scheduled' },
                { scheduledDate: { $ne: null } },
                { scheduledTime: { $exists: true, $ne: '' } }
              ]
            },
            {
              meetingType: { $ne: 'chat_call' },
              meetingId: { $not: /^(dm-|voice-|.*-video-.*|.*-voice-.*)/i },
              title: { $not: /(Voice Call|Video Call)/i }
            }
          ]
        })
          .sort({ createdAt: -1 })
          .limit(50);

        return meetings.map((m) => m.toSafeObject(userId));
      } catch (e) {
        // Fallback
      }
    }

    const results = [];
    for (const m of inMemoryMeetings.values()) {
      const isUser = m.host === userId || m.participants?.some((p) => p.userId === userId);
      const isScheduled = Boolean(
        m.isScheduled ||
        m.meetingType === 'scheduled' ||
        m.scheduledDate ||
        (m.scheduledTime && m.scheduledTime !== '')
      );
      const mId = (m.meetingId || '').toLowerCase();
      const mTitle = (m.title || '').toLowerCase();
      const isChat =
        mId.startsWith('dm-') ||
        mId.startsWith('voice-') ||
        mId.includes('-video-') ||
        mId.includes('-voice-') ||
        mTitle.includes('voice call') ||
        mTitle.includes('video call') ||
        m.meetingType === 'chat_call';

      if (isUser && isScheduled && !isChat) {
        results.push(typeof m.toSafeObject === 'function' ? m.toSafeObject(userId) : m);
      }
    }
    return results;
  }

  // 9. Get User Invitations (meetings invited to with pending/accepted/declined status)
  async getUserInvitations(userEmail) {
    if (!userEmail) return [];
    const normalized = userEmail.toLowerCase().trim();
    const invitations = [];

    if (this.isDbConnected()) {
      try {
        const meetings = await Meeting.find({
          'invitees.email': normalized,
          status: { $ne: 'cancelled' }
        }).sort({ startTime: -1 });

        for (const m of meetings) {
          const myInvite = m.invitees.find((inv) => inv.email === normalized);
          const safe = m.toSafeObject();
          const rsvpStatus = myInvite ? myInvite.status : 'pending';
          invitations.push({
            ...safe,
            myInviteStatus: rsvpStatus,
            myRsvpStatus: rsvpStatus,
            invitedAt: myInvite ? myInvite.invitedAt : m.createdAt
          });
        }
        return invitations;
      } catch (e) {
        logger.warn(`getUserInvitations error: ${e.message}`);
      }
    }

    for (const m of inMemoryMeetings.values()) {
      const myInvite = m.invitees?.find((inv) => inv.email === normalized);
      if (myInvite && m.status !== 'cancelled') {
        const safe = typeof m.toSafeObject === 'function' ? m.toSafeObject() : m;
        const rsvpStatus = myInvite.status || 'pending';
        invitations.push({
          ...safe,
          myInviteStatus: rsvpStatus,
          myRsvpStatus: rsvpStatus,
          invitedAt: myInvite.invitedAt
        });
      }
    }

    return invitations;
  }

  // 10. Respond to an invitation (accept / decline)
  async respondToInvitation(meetingId, userEmail, status) {
    if (!userEmail) throw new Error('User email required');
    const normalized = userEmail.toLowerCase().trim();
    const cleanStatus = ['accepted', 'declined'].includes(status) ? status : 'accepted';

    let meeting = null;
    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          const inv = meeting.invitees.find((i) => i.email === normalized);
          if (inv) {
            inv.status = cleanStatus;
            inv.respondedAt = new Date();
          } else {
            meeting.invitees.push({
              email: normalized,
              name: '',
              status: cleanStatus,
              invitedAt: new Date(),
              respondedAt: new Date()
            });
          }
          await meeting.save();

          // Sync matching notification status
          try {
            const Notification = require('../models/Notification');
            const User = require('../models/User');
            const targetUser = await User.findOne({ email: normalized });
            if (targetUser) {
              await Notification.updateMany(
                { recipient: targetUser._id.toString(), type: 'meeting-invite', 'data.meetingId': meetingId },
                { $set: { 'data.status': cleanStatus, isRead: true } }
              );
            }
          } catch {
            // Non-blocking
          }

          return meeting.toSafeObject();
        }
      } catch (e) {
        logger.warn(`respondToInvitation error: ${e.message}`);
      }
    }

    meeting = inMemoryMeetings.get(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!meeting.invitees) meeting.invitees = [];
    const inv = meeting.invitees.find((i) => i.email === normalized);
    if (inv) {
      inv.status = cleanStatus;
      inv.respondedAt = new Date();
    } else {
      meeting.invitees.push({
        email: normalized,
        name: '',
        status: cleanStatus,
        invitedAt: new Date(),
        respondedAt: new Date()
      });
    }

    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject() : meeting;
  }

  // 10b. Add Invitee to an active or scheduled meeting
  async addInvitee(meetingId, { email, name = '' }, hostUser = null) {
    if (!email) throw new Error('Invitee email is required');
    const normalized = email.toLowerCase().trim();
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          const exists = meeting.invitees.some((i) => i.email === normalized);
          if (!exists) {
            meeting.invitees.push({
              email: normalized,
              name: name || '',
              status: 'pending',
              invitedAt: new Date(),
              respondedAt: null
            });
            await meeting.save();
          }
        }
      } catch (e) {
        logger.warn(`addInvitee error: ${e.message}`);
      }
    }

    if (!meeting) {
      meeting = inMemoryMeetings.get(meetingId);
      if (!meeting) throw new Error('Meeting not found');
      if (!meeting.invitees) meeting.invitees = [];
      const exists = meeting.invitees.some((i) => i.email === normalized);
      if (!exists) {
        meeting.invitees.push({
          email: normalized,
          name: name || '',
          status: 'pending',
          invitedAt: new Date(),
          respondedAt: null
        });
      }
    }

    // Try to notify the user if registered
    if (this.isDbConnected()) {
      try {
        const User = require('../models/User');
        const targetUser = await User.findOne({ email: normalized });
        if (targetUser) {
          const notificationService = require('./notificationService');
          await notificationService.createNotification({
            recipient: targetUser._id.toString(),
            recipientId: targetUser._id.toString(),
            sender: hostUser ? (hostUser.id || hostUser._id) : null,
            senderId: hostUser ? (hostUser.id || hostUser._id) : null,
            senderName: hostUser ? (hostUser.fullName || hostUser.username) : 'ConnectSphere Host',
            type: 'meeting-invite',
            title: 'Meeting Invitation',
            message: `${hostUser ? (hostUser.fullName || hostUser.username) : 'A host'} invited you to join "${meeting.title || 'a meeting'}"`,
            data: {
              meetingId,
              roomId: meetingId,
              title: meeting.title,
              status: 'pending',
              inviteLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${meetingId}`
            }
          });
        }
      } catch {
        // Notification is non-blocking
      }
    }

    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject() : meeting;
  }

  // 11. Cancel Scheduled Meeting (reminders cancelled, status set to 'cancelled')
  async cancelMeeting(meetingId, userId) {
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          if (meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
            throw new Error('Only the meeting host can cancel this meeting.');
          }

          meeting.status = 'cancelled';
          // Cancel pending reminders
          if (meeting.reminders) {
            meeting.reminders.forEach((r) => {
              r.sent = true; // Mark as sent/suppressed so no future reminder fires
            });
          }
          await meeting.save();
          logger.info(`Meeting [${meeting.title}] (${meetingId}) was CANCELLED by host [${userId}]. Reminders suppressed.`);
          return meeting.toSafeObject(userId);
        }
      } catch (e) {
        if (e.message.includes('Only the meeting host')) throw e;
      }
    }

    meeting = inMemoryMeetings.get(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found.');
    }

    if (meeting.host && (!userId || meeting.host !== userId)) {
      throw new Error('Only the meeting host can cancel this meeting.');
    }

    meeting.status = 'cancelled';
    if (meeting.reminders) {
      meeting.reminders.forEach((r) => {
        r.sent = true;
      });
    }
    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting;
  }

  // 12. Update Meeting Status (active, ended)
  async updateMeetingStatus(meetingId, status, userId) {
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          if (meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
            throw new Error('Only the meeting host can perform this action.');
          }

          meeting.status = status;
          if (status === 'ended') {
            meeting.endTime = new Date();
          } else if (status === 'active' && !meeting.startTime) {
            meeting.startTime = new Date();
          }
          await meeting.save();
          return meeting.toSafeObject(userId);
        }
      } catch (e) {
        if (e.message.includes('Only the meeting host')) throw e;
      }
    }

    meeting = inMemoryMeetings.get(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found.');
    }

    if (meeting.host && (!userId || meeting.host !== userId)) {
      throw new Error('Only the meeting host can perform this action.');
    }

    meeting.status = status;
    if (status === 'ended') {
      meeting.endTime = new Date();
    }
    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting;
  }

  // 13. Update Meeting Settings (locked, waiting room)
  async updateMeetingSettings(meetingId, newSettings, userId) {
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          if (meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
            throw new Error('Only the meeting host can update settings.');
          }

          meeting.settings = { ...meeting.settings, ...newSettings };
          await meeting.save();
          return meeting.toSafeObject(userId);
        }
      } catch (e) {
        if (e.message.includes('Only the meeting host')) throw e;
      }
    }

    meeting = inMemoryMeetings.get(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found.');
    }

    if (meeting.host && (!userId || meeting.host !== userId)) {
      throw new Error('Only the meeting host can update settings.');
    }

    meeting.settings = { ...meeting.settings, ...newSettings };
    return typeof meeting.toSafeObject === 'function' ? meeting.toSafeObject(userId) : meeting;
  }

  // 14. Record Participant Join
  async recordParticipantJoin(meetingId, { userId, name, email, role }) {
    if (this.isDbConnected()) {
      try {
        await Meeting.findOneAndUpdate(
          { meetingId },
          {
            $push: {
              participants: {
                userId: userId || null,
                name: name || 'Participant',
                email: email || '',
                role: role || 'participant',
                joinedAt: new Date()
              }
            },
            $set: { status: 'active' }
          }
        );
      } catch (e) {
        // Fallback
      }
    }

    const mem = inMemoryMeetings.get(meetingId);
    if (mem) {
      if (!mem.participants) mem.participants = [];
      mem.participants.push({
        userId: userId || null,
        name: name || 'Participant',
        email: email || '',
        role: role || 'participant',
        joinedAt: new Date()
      });
      mem.status = 'active';
    }
  }

  // 15. Record Participant Leave
  async recordParticipantLeave(meetingId, userIdOrName) {
    if (this.isDbConnected()) {
      try {
        await Meeting.findOneAndUpdate(
          {
            meetingId,
            $or: [{ 'participants.userId': userIdOrName }, { 'participants.name': userIdOrName }]
          },
          {
            $set: { 'participants.$.leftAt': new Date() }
          }
        );
      } catch (e) {
        // Fallback
      }
    }

    const mem = inMemoryMeetings.get(meetingId);
    if (mem && mem.participants) {
      const p = mem.participants.find((x) => x.userId === userIdOrName || x.name === userIdOrName);
      if (p) p.leftAt = new Date();
    }
  }
}

const meetingServiceInstance = new MeetingService();
meetingServiceInstance.inMemoryMeetings = inMemoryMeetings;
module.exports = meetingServiceInstance;
module.exports.inMemoryMeetings = inMemoryMeetings;
