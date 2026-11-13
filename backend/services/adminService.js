const os = require('os');
const mongoose = require('mongoose');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const MeetingFile = require('../models/MeetingFile');
const Recording = require('../models/Recording');
const AdminAuditLog = require('../models/AdminAuditLog');
const authService = require('./authService');
const meetingService = require('./meetingService');
const meetingFileService = require('./meetingFileService');
const recordingService = require('./recordingService');
const logger = require('../utils/logger');

// In-memory audit log store fallback
const inMemoryAuditLogs = [];

class AdminService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // --- Audit Logging Helper ---
  async logAdminAction({ adminId, adminEmail, adminName, action, targetType, targetId, details = {}, ipAddress = '', userAgent = '' }) {
    const logData = {
      logId: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      adminId: String(adminId),
      adminEmail: String(adminEmail),
      adminName: String(adminName || 'Admin'),
      action,
      targetType,
      targetId: String(targetId),
      details,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'Antigravity/Agent',
      createdAt: new Date()
    };

    if (this.isDbConnected()) {
      try {
        const doc = await AdminAuditLog.create(logData);
        inMemoryAuditLogs.unshift(doc.toSafeObject());
        return doc.toSafeObject();
      } catch (err) {
        logger.warn(`Failed to persist audit log in DB: ${err.message}`);
      }
    }

    inMemoryAuditLogs.unshift(logData);
    return logData;
  }

  // =========================================================================
  // 1. Overview Dashboard Stats
  // =========================================================================
  async getOverviewStats(io = null) {
    let totalUsers = 0;
    let activeUsers = 0;
    let totalMeetings = 0;
    let ongoingMeetings = 0;
    let completedMeetings = 0;
    let totalFiles = 0;
    let totalStorageBytes = 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (this.isDbConnected()) {
      try {
        totalUsers = await User.countDocuments();
        activeUsers = await User.countDocuments({
          $or: [{ isOnline: true }, { lastSeen: { $gte: oneDayAgo } }]
        });
        totalMeetings = await Meeting.countDocuments();
        ongoingMeetings = await Meeting.countDocuments({ status: 'active' });
        completedMeetings = await Meeting.countDocuments({ status: 'ended' });

        totalFiles = await MeetingFile.countDocuments({ isDeleted: false });

        const fileAgg = await MeetingFile.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]);
        const recAgg = await Recording.aggregate([
          { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
        ]);

        const fileBytes = fileAgg[0]?.totalSize || 0;
        const recBytes = recAgg[0]?.totalSize || 0;
        totalStorageBytes = fileBytes + recBytes;
      } catch (err) {
        logger.warn(`Admin overview DB query failed: ${err.message}`);
      }
    }

    // In-memory additions or fallback
    if (authService.inMemoryUsers && authService.inMemoryUsers.size > 0) {
      const memUsers = Array.from(authService.inMemoryUsers.values());
      if (totalUsers === 0) totalUsers = memUsers.length;
      const memActive = memUsers.filter((u) => u.isOnline || (u.lastSeen && new Date(u.lastSeen) >= oneDayAgo)).length;
      if (activeUsers === 0) activeUsers = memActive;
    }

    if (meetingService.inMemoryMeetings && meetingService.inMemoryMeetings.size > 0) {
      const memMeetings = Array.from(meetingService.inMemoryMeetings.values());
      if (totalMeetings === 0) totalMeetings = memMeetings.length;
      const memOngoing = memMeetings.filter((m) => m.status === 'active').length;
      const memCompleted = memMeetings.filter((m) => m.status === 'ended').length;
      if (ongoingMeetings === 0) ongoingMeetings = memOngoing;
      if (completedMeetings === 0) completedMeetings = memCompleted;
    }

    if (meetingFileService.inMemoryFiles && meetingFileService.inMemoryFiles.size > 0) {
      let memFileCount = 0;
      let memSizeBytes = 0;
      meetingFileService.inMemoryFiles.forEach((fileList) => {
        fileList.forEach((f) => {
          if (!f.isDeleted) {
            memFileCount++;
            memSizeBytes += f.size || 0;
          }
        });
      });
      if (totalFiles === 0) totalFiles = memFileCount;
      if (totalStorageBytes === 0) totalStorageBytes = memSizeBytes;
    }

    if (recordingService.inMemoryRecordings && recordingService.inMemoryRecordings.size > 0) {
      recordingService.inMemoryRecordings.forEach((r) => {
        totalStorageBytes += r.fileSize || 0;
      });
    }

    // Recent activity (latest audits + registrations)
    const recentActivity = await this.getRecentPlatformActivity();

    return {
      totalUsers,
      activeUsers,
      totalMeetings,
      ongoingMeetings,
      completedMeetings,
      totalFiles,
      totalStorageBytes,
      activeSockets: io?.engine?.clientsCount || 0,
      recentActivity
    };
  }

  async getRecentPlatformActivity() {
    const logs = inMemoryAuditLogs.slice(0, 8);
    if (this.isDbConnected()) {
      try {
        const dbLogs = await AdminAuditLog.find().sort({ createdAt: -1 }).limit(10);
        if (dbLogs.length > 0) {
          return dbLogs.map((d) => d.toSafeObject());
        }
      } catch {
        // Fallback
      }
    }
    return logs;
  }

  // =========================================================================
  // 2. User Management
  // =========================================================================
  async getUsers({ page = 1, limit = 10, search = '', role = 'all', status = 'all' }) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (p - 1) * l;

    if (this.isDbConnected()) {
      try {
        const query = {};

        if (search && search.trim().length > 0) {
          const s = search.trim();
          query.$or = [
            { fullName: { $regex: s, $options: 'i' } },
            { username: { $regex: s, $options: 'i' } },
            { email: { $regex: s, $options: 'i' } }
          ];
        }

        if (role && role !== 'all') {
          query.role = role;
        }

        if (status && status !== 'all') {
          query.status = status;
        }

        const total = await User.countDocuments(query);
        const docs = await User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l);

        return {
          users: docs.map((u) => u.toSafeObject()),
          pagination: {
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l) || 1
          }
        };
      } catch (err) {
        logger.warn(`Admin getUsers DB query failed: ${err.message}`);
      }
    }

    // In-memory fallback
    let allUsers = Array.from(authService.inMemoryUsers ? authService.inMemoryUsers.values() : []);
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      allUsers = allUsers.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    if (role && role !== 'all') {
      allUsers = allUsers.filter((u) => (u.role || 'user') === role);
    }
    if (status && status !== 'all') {
      allUsers = allUsers.filter((u) => (u.status || 'active') === status);
    }

    const total = allUsers.length;
    const paginated = allUsers.slice(skip, skip + l).map((u) => (typeof u.toSafeObject === 'function' ? u.toSafeObject() : u));

    return {
      users: paginated,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1
      }
    };
  }

  async getUserDetails(userId) {
    let userObj = null;

    if (this.isDbConnected()) {
      try {
        const u = await User.findById(userId);
        if (u) {
          userObj = u.toSafeObject();
        }
      } catch {
        // Fallback
      }
    }

    if (!userObj && authService.inMemoryUsers?.has(userId)) {
      const u = authService.inMemoryUsers.get(userId);
      userObj = typeof u.toSafeObject === 'function' ? u.toSafeObject() : u;
    }

    if (!userObj) {
      throw new Error('User not found');
    }

    // Calculate user platform usage
    let createdMeetingsCount = 0;
    let filesUploadedCount = 0;

    if (this.isDbConnected()) {
      try {
        createdMeetingsCount = await Meeting.countDocuments({ host: userId });
        filesUploadedCount = await MeetingFile.countDocuments({ uploaderId: userId, isDeleted: false });
      } catch {
        // Ignore
      }
    }

    return {
      ...userObj,
      stats: {
        createdMeetingsCount,
        filesUploadedCount
      }
    };
  }

  async updateUserStatus(userId, { status, reason = '' }, adminUser, ipAddress = '') {
    if (!['active', 'suspended'].includes(status)) {
      throw new Error('Invalid status. Must be either "active" or "suspended".');
    }

    let updated = null;

    if (this.isDbConnected()) {
      try {
        const user = await User.findById(userId);
        if (user) {
          user.status = status;
          user.suspendedReason = status === 'suspended' ? reason || 'Suspended by admin' : '';
          user.suspendedAt = status === 'suspended' ? new Date() : null;
          await user.save();
          updated = user.toSafeObject();
        }
      } catch (err) {
        logger.warn(`Failed to update user status in DB: ${err.message}`);
      }
    }

    if (!updated && authService.inMemoryUsers?.has(userId)) {
      const user = authService.inMemoryUsers.get(userId);
      user.status = status;
      user.suspendedReason = status === 'suspended' ? reason || 'Suspended by admin' : '';
      user.suspendedAt = status === 'suspended' ? new Date() : null;
      updated = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;
    }

    if (!updated) {
      throw new Error('User not found');
    }

    await this.logAdminAction({
      adminId: adminUser.id || adminUser._id,
      adminEmail: adminUser.email,
      adminName: adminUser.fullName || adminUser.name || 'Admin',
      action: status === 'suspended' ? 'user_suspended' : 'user_reactivated',
      targetType: 'user',
      targetId: userId,
      details: { status, reason: reason || 'N/A' },
      ipAddress
    });

    return updated;
  }

  async updateUserRole(userId, { role }, adminUser, ipAddress = '') {
    if (!['user', 'admin', 'moderator'].includes(role)) {
      throw new Error('Invalid role. Must be "user", "admin", or "moderator".');
    }

    let updated = null;

    if (this.isDbConnected()) {
      try {
        const user = await User.findById(userId);
        if (user) {
          user.role = role;
          await user.save();
          updated = user.toSafeObject();
        }
      } catch (err) {
        logger.warn(`Failed to update user role in DB: ${err.message}`);
      }
    }

    if (!updated && authService.inMemoryUsers?.has(userId)) {
      const user = authService.inMemoryUsers.get(userId);
      user.role = role;
      updated = typeof user.toSafeObject === 'function' ? user.toSafeObject() : user;
    }

    if (!updated) {
      throw new Error('User not found');
    }

    await this.logAdminAction({
      adminId: adminUser.id || adminUser._id,
      adminEmail: adminUser.email,
      adminName: adminUser.fullName || adminUser.name || 'Admin',
      action: 'user_role_changed',
      targetType: 'user',
      targetId: userId,
      details: { newRole: role },
      ipAddress
    });

    return updated;
  }

  // =========================================================================
  // 3. Meeting Management
  // =========================================================================
  async getMeetings({ page = 1, limit = 10, search = '', status = 'all', reportedOnly = false }) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (p - 1) * l;

    if (this.isDbConnected()) {
      try {
        const query = {};

        if (search && search.trim().length > 0) {
          const s = search.trim();
          query.$or = [
            { meetingId: { $regex: s, $options: 'i' } },
            { title: { $regex: s, $options: 'i' } },
            { hostName: { $regex: s, $options: 'i' } },
            { hostEmail: { $regex: s, $options: 'i' } }
          ];
        }

        if (status && status !== 'all') {
          query.status = status;
        }

        if (reportedOnly === true || reportedOnly === 'true') {
          query.isReported = true;
        }

        const total = await Meeting.countDocuments(query);
        const docs = await Meeting.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l);

        return {
          meetings: docs.map((m) => m.toSafeObject()),
          pagination: {
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l) || 1
          }
        };
      } catch (err) {
        logger.warn(`Admin getMeetings DB query failed: ${err.message}`);
      }
    }

    // In-memory fallback
    let allMeetings = Array.from(meetingService.inMemoryMeetings ? meetingService.inMemoryMeetings.values() : []);
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase().trim();
      allMeetings = allMeetings.filter(
        (m) =>
          m.meetingId?.toLowerCase().includes(q) ||
          m.title?.toLowerCase().includes(q) ||
          m.hostName?.toLowerCase().includes(q)
      );
    }
    if (status && status !== 'all') {
      allMeetings = allMeetings.filter((m) => m.status === status);
    }
    if (reportedOnly === true || reportedOnly === 'true') {
      allMeetings = allMeetings.filter((m) => m.isReported === true);
    }

    const total = allMeetings.length;
    const paginated = allMeetings.slice(skip, skip + l).map((m) => (typeof m.toSafeObject === 'function' ? m.toSafeObject() : m));

    return {
      meetings: paginated,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1
      }
    };
  }

  async getMeetingDetails(meetingId) {
    const cleanId = meetingId.toLowerCase().trim();
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        const doc = await Meeting.findOne({ meetingId: cleanId });
        if (doc) meeting = doc.toSafeObject();
      } catch {
        // Fallback
      }
    }

    if (!meeting && meetingService.inMemoryMeetings?.has(cleanId)) {
      const m = meetingService.inMemoryMeetings.get(cleanId);
      meeting = typeof m.toSafeObject === 'function' ? m.toSafeObject() : m;
    }

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Retrieve associated file metadata
    let files = [];
    if (this.isDbConnected()) {
      try {
        const fileDocs = await MeetingFile.find({ meetingId: cleanId, isDeleted: false });
        files = fileDocs.map((f) => ({
          fileId: f.fileId,
          originalName: f.originalName,
          size: f.size,
          mimeType: f.mimeType,
          uploaderName: f.uploaderName,
          createdAt: f.createdAt
        }));
      } catch {
        // Safe ignore
      }
    }

    return {
      ...meeting,
      files
    };
  }

  async reportMeeting(meetingId, { reporterId, reporterName, reason, description }) {
    const cleanId = meetingId.toLowerCase().trim();
    const reportPayload = {
      reportId: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      reporterId: reporterId || null,
      reporterName: reporterName || 'Anonymous',
      reason: reason || 'other',
      description: description || '',
      status: 'pending',
      reportedAt: new Date()
    };

    if (this.isDbConnected()) {
      try {
        const meeting = await Meeting.findOne({ meetingId: cleanId });
        if (meeting) {
          meeting.isReported = true;
          meeting.reports.push(reportPayload);
          await meeting.save();
          return reportPayload;
        }
      } catch (err) {
        logger.warn(`Failed to save meeting report to DB: ${err.message}`);
      }
    }

    const mem = meetingService.inMemoryMeetings?.get(cleanId);
    if (mem) {
      mem.isReported = true;
      if (!mem.reports) mem.reports = [];
      mem.reports.push(reportPayload);
      return reportPayload;
    }

    throw new Error('Meeting not found');
  }

  async resolveReport(meetingId, reportId, { status, resolutionNotes = '' }, adminUser, ipAddress = '') {
    const cleanId = meetingId.toLowerCase().trim();
    let updatedReport = null;

    if (this.isDbConnected()) {
      try {
        const meeting = await Meeting.findOne({ meetingId: cleanId });
        if (meeting && meeting.reports) {
          const report = meeting.reports.find((r) => r.reportId === reportId || r._id?.toString() === reportId);
          if (report) {
            report.status = status;
            report.resolutionNotes = resolutionNotes;
            report.resolvedBy = adminUser.fullName || adminUser.username || 'Admin';
            report.resolvedAt = new Date();

            const hasPending = meeting.reports.some((r) => r.status === 'pending' || r.status === 'investigating');
            meeting.isReported = hasPending;

            await meeting.save();
            updatedReport = report;
          }
        }
      } catch (err) {
        logger.warn(`Failed to resolve report in DB: ${err.message}`);
      }
    }

    const mem = meetingService.inMemoryMeetings?.get(cleanId);
    if (!updatedReport && mem && mem.reports) {
      const report = mem.reports.find((r) => r.reportId === reportId || r._id?.toString() === reportId);
      if (report) {
        report.status = status;
        report.resolutionNotes = resolutionNotes;
        report.resolvedBy = adminUser.fullName || adminUser.username || 'Admin';
        report.resolvedAt = new Date();
        const hasPending = mem.reports.some((r) => r.status === 'pending' || r.status === 'investigating');
        mem.isReported = hasPending;
        updatedReport = report;
      }
    }

    if (!updatedReport) {
      throw new Error('Meeting report not found');
    }

    await this.logAdminAction({
      adminId: adminUser.id || adminUser._id,
      adminEmail: adminUser.email,
      adminName: adminUser.fullName || adminUser.name || 'Admin',
      action: status === 'resolved' ? 'meeting_report_resolved' : status === 'dismissed' ? 'meeting_report_dismissed' : 'meeting_report_investigated',
      targetType: 'meeting',
      targetId: cleanId,
      details: { reportId, status, resolutionNotes },
      ipAddress
    });

    return updatedReport;
  }

  async terminateMeeting(meetingId, { reason = 'Terminated by platform administrator for policy violations' }, adminUser, ipAddress = '', io = null) {
    const cleanId = meetingId.toLowerCase().trim();
    let meeting = null;

    if (this.isDbConnected()) {
      try {
        const doc = await Meeting.findOne({ meetingId: cleanId });
        if (doc) {
          doc.status = 'ended';
          doc.endTime = new Date();
          doc.isTerminatedByAdmin = true;
          doc.adminTerminationReason = reason;
          doc.terminatedByAdminAt = new Date();
          await doc.save();
          meeting = doc.toSafeObject();
        }
      } catch (err) {
        logger.warn(`Failed to terminate meeting in DB: ${err.message}`);
      }
    }

    const mem = meetingService.inMemoryMeetings?.get(cleanId);
    if (mem) {
      mem.status = 'ended';
      mem.endTime = new Date();
      mem.isTerminatedByAdmin = true;
      mem.adminTerminationReason = reason;
      mem.terminatedByAdminAt = new Date();
      if (!meeting) {
        const base = typeof mem.toSafeObject === 'function' ? mem.toSafeObject() : mem;
        meeting = {
          ...base,
          status: 'ended',
          isTerminatedByAdmin: true,
          adminTerminationReason: reason
        };
      }
    }

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    // Terminate live room over Socket.IO
    if (io) {
      io.in(cleanId).emit('meeting-ended-by-host', {
        reason: `This meeting has been closed by an administrator: ${reason}`,
        isTerminatedByAdmin: true
      });
    }

    await this.logAdminAction({
      adminId: adminUser.id || adminUser._id,
      adminEmail: adminUser.email,
      adminName: adminUser.fullName || adminUser.name || 'Admin',
      action: 'meeting_terminated',
      targetType: 'meeting',
      targetId: cleanId,
      details: { reason },
      ipAddress
    });

    return meeting;
  }

  // =========================================================================
  // 4. Analytics (Real Platform Growth, Registrations, Meetings)
  // =========================================================================
  async getPlatformAnalytics({ days = 7 }) {
    const numDays = Math.min(60, Math.max(3, parseInt(days, 10) || 7));
    const dates = [];
    const now = new Date();

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const registrationTrend = dates.map((date) => ({ date, count: 0 }));
    const meetingTrend = dates.map((date) => ({ date, created: 0, completed: 0 }));
    const filesTrend = dates.map((date) => ({ date, count: 0, sizeBytes: 0 }));

    if (this.isDbConnected()) {
      try {
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - numDays);

        // User registrations
        const userAgg = await User.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          }
        ]);
        userAgg.forEach((item) => {
          const match = registrationTrend.find((r) => r.date === item._id);
          if (match) match.count = item.count;
        });

        // Meeting activity
        const meetAgg = await Meeting.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              created: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
              }
            }
          }
        ]);
        meetAgg.forEach((item) => {
          const match = meetingTrend.find((m) => m.date === item._id);
          if (match) {
            match.created = item.created;
            match.completed = item.completed;
          }
        });

        // File activity
        const fileAgg = await MeetingFile.aggregate([
          { $match: { createdAt: { $gte: startDate }, isDeleted: false } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              sizeBytes: { $sum: '$size' }
            }
          }
        ]);
        fileAgg.forEach((item) => {
          const match = filesTrend.find((f) => f.date === item._id);
          if (match) {
            match.count = item.count;
            match.sizeBytes = item.sizeBytes;
          }
        });
      } catch (err) {
        logger.warn(`Analytics aggregation query failed: ${err.message}`);
      }
    }

    // Account for in-memory items
    const todayStr = dates[dates.length - 1];
    if (authService.inMemoryUsers && authService.inMemoryUsers.size > 0) {
      const match = registrationTrend.find((r) => r.date === todayStr);
      if (match && match.count === 0) match.count = authService.inMemoryUsers.size;
    }
    if (meetingService.inMemoryMeetings && meetingService.inMemoryMeetings.size > 0) {
      const match = meetingTrend.find((m) => m.date === todayStr);
      if (match && match.created === 0) {
        match.created = meetingService.inMemoryMeetings.size;
        match.completed = Array.from(meetingService.inMemoryMeetings.values()).filter((m) => m.status === 'ended').length;
      }
    }

    const totalReg = registrationTrend.reduce((acc, r) => acc + r.count, 0);
    const totalMeet = meetingTrend.reduce((acc, m) => acc + m.created, 0);

    return {
      periodDays: numDays,
      registrationTrend,
      meetingTrend,
      filesTrend,
      growthStats: {
        totalNewUsersPeriod: totalReg,
        totalMeetingsPeriod: totalMeet,
        avgMeetingsPerDay: Number((totalMeet / numDays).toFixed(1)),
        avgRegistrationsPerDay: Number((totalReg / numDays).toFixed(1))
      }
    };
  }

  // =========================================================================
  // 5. System Management & Health Metrics
  // =========================================================================
  async getSystemMetrics(io = null) {
    const memUsage = process.memoryUsage();
    const uptimeSec = process.uptime();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // Socket.IO metrics
    const activeSockets = io?.engine?.clientsCount || 0;
    const activeRooms = io?.sockets?.adapter?.rooms ? io.sockets.adapter.rooms.size : 0;

    // Storage calculations
    let totalFilesCount = 0;
    let filesSizeBytes = 0;
    let recordingsCount = 0;
    let recordingsSizeBytes = 0;

    if (this.isDbConnected()) {
      try {
        totalFilesCount = await MeetingFile.countDocuments({ isDeleted: false });
        recordingsCount = await Recording.countDocuments();

        const fileAgg = await MeetingFile.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]);
        const recAgg = await Recording.aggregate([
          { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
        ]);

        filesSizeBytes = fileAgg[0]?.totalSize || 0;
        recordingsSizeBytes = recAgg[0]?.totalSize || 0;
      } catch {
        // Fallback
      }
    }

    if (meetingFileService.inMemoryFiles && meetingFileService.inMemoryFiles.size > 0) {
      meetingFileService.inMemoryFiles.forEach((list) => {
        list.forEach((f) => {
          if (!f.isDeleted) {
            totalFilesCount++;
            filesSizeBytes += f.size || 0;
          }
        });
      });
    }

    if (recordingService.inMemoryRecordings && recordingService.inMemoryRecordings.size > 0) {
      recordingsCount += recordingService.inMemoryRecordings.size;
      recordingService.inMemoryRecordings.forEach((r) => {
        recordingsSizeBytes += r.fileSize || 0;
      });
    }

    return {
      serverHealth: {
        status: 'healthy',
        uptimeSeconds: Math.floor(uptimeSec),
        uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${Math.floor(uptimeSec % 60)}s`,
        nodeVersion: process.version,
        platform: `${os.platform()} (${os.arch()})`,
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        loadAverage: loadAvg,
        memory: {
          rssMb: Math.round(memUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
          freeSystemMemMb: Math.round(os.freemem() / (1024 * 1024)),
          totalSystemMemMb: Math.round(os.totalmem() / (1024 * 1024))
        },
        databaseState: this.isDbConnected() ? 'connected' : 'in-memory-fallback'
      },
      socketMetrics: {
        activeSockets,
        activeRooms,
        status: activeSockets > 0 ? 'active' : 'idle'
      },
      storageMetrics: {
        totalFilesCount,
        filesSizeBytes,
        filesSizeFormatted: (filesSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
        recordingsCount,
        recordingsSizeBytes,
        recordingsSizeFormatted: (recordingsSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
        totalStorageBytes: filesSizeBytes + recordingsSizeBytes,
        totalStorageFormatted: ((filesSizeBytes + recordingsSizeBytes) / (1024 * 1024)).toFixed(2) + ' MB'
      }
    };
  }

  // =========================================================================
  // 6. Audit Logs Listing
  // =========================================================================
  async getAuditLogs({ page = 1, limit = 20, action = 'all', targetType = 'all' }) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (p - 1) * l;

    if (this.isDbConnected()) {
      try {
        const query = {};
        if (action && action !== 'all') query.action = action;
        if (targetType && targetType !== 'all') query.targetType = targetType;

        const total = await AdminAuditLog.countDocuments(query);
        const docs = await AdminAuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l);

        return {
          logs: docs.map((d) => d.toSafeObject()),
          pagination: {
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l) || 1
          }
        };
      } catch (err) {
        logger.warn(`Admin getAuditLogs DB query failed: ${err.message}`);
      }
    }

    let allLogs = [...inMemoryAuditLogs];
    if (action && action !== 'all') allLogs = allLogs.filter((log) => log.action === action);
    if (targetType && targetType !== 'all') allLogs = allLogs.filter((log) => log.targetType === targetType);

    const total = allLogs.length;
    const paginated = allLogs.slice(skip, skip + l);

    return {
      logs: paginated,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l) || 1
      }
    };
  }
}

module.exports = new AdminService();
