const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const Recording = require('../models/Recording');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const storageService = require('./storageService');
const logger = require('../utils/logger');

// In-Memory fallback store for environments without MongoDB
const inMemoryRecordings = new Map();

class RecordingService {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  /**
   * 1. Initialize a recording session (Host / Co-host)
   */
  async startRecording({ meetingId, hostId, hostName, meetingTitle }) {
    const cleanMeetingId = meetingId.toLowerCase().trim();
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const recordingData = {
      recordingId,
      meetingId: cleanMeetingId,
      meetingTitle: meetingTitle || 'Live Meeting Recording',
      host: hostId || null,
      hostName: hostName || 'Host',
      storageProvider: storageService.getActiveProvider(),
      storagePath: 'pending',
      fileName: `${recordingId}.webm`,
      originalName: `${cleanMeetingId}_${new Date().toISOString().slice(0, 10)}.webm`,
      mimeType: 'video/webm',
      fileSize: 0,
      duration: 0,
      startedAt: new Date(),
      status: 'recording',
      participantsConsent: [],
      accessSettings: {
        isPublic: false,
        allowedRoles: ['host', 'participant'],
        allowedUsers: hostId ? [hostId.toString()] : []
      }
    };

    if (this.isDbConnected()) {
      try {
        const recording = await Recording.create(recordingData);
        inMemoryRecordings.set(recordingId, recordingData);
        logger.info(`Recording session started: [${recordingId}] for meeting [${cleanMeetingId}]`);
        return typeof recording.toSafeObject === 'function' ? recording.toSafeObject(hostId) : recording;
      } catch (err) {
        logger.warn(`Failed to create Recording in MongoDB, falling back to memory: ${err.message}`);
      }
    }

    inMemoryRecordings.set(recordingId, recordingData);
    logger.info(`Recording session started in memory: [${recordingId}] for meeting [${cleanMeetingId}]`);
    return {
      ...recordingData,
      id: recordingId,
      toSafeObject: () => recordingData
    };
  }

  /**
   * Stop an active recording session and mark as ready/completed
   */
  async stopRecording({ meetingId, recordingId, duration } = {}) {
    const cleanMeetingId = meetingId ? meetingId.toLowerCase().trim() : null;
    const now = new Date();

    if (this.isDbConnected()) {
      try {
        let recording = null;
        if (recordingId) {
          recording = await Recording.findOne({ recordingId });
        }
        if (!recording && cleanMeetingId) {
          recording = await Recording.findOne({ meetingId: cleanMeetingId, status: 'recording' }).sort({ createdAt: -1 });
        }

        if (recording) {
          recording.endedAt = now;
          if (duration) {
            recording.duration = Math.round(Number(duration));
          } else if (recording.startedAt) {
            recording.duration = Math.max(1, Math.round((now.getTime() - recording.startedAt.getTime()) / 1000));
          }
          recording.status = 'ready';
          await recording.save();
          inMemoryRecordings.set(recording.recordingId, recording.toObject ? recording.toObject() : recording);
          logger.info(`Recording session stopped: [${recording.recordingId}] for meeting [${cleanMeetingId}]`);
          return recording;
        }
      } catch (err) {
        logger.warn(`Failed to stop Recording in MongoDB: ${err.message}`);
      }
    }

    // In-memory fallback
    let target = recordingId ? inMemoryRecordings.get(recordingId) : null;
    if (!target && cleanMeetingId) {
      for (const rec of inMemoryRecordings.values()) {
        if (rec.meetingId === cleanMeetingId && rec.status === 'recording') {
          target = rec;
          break;
        }
      }
    }

    if (target) {
      target.endedAt = now;
      if (duration) {
        target.duration = Math.round(Number(duration));
      } else if (target.startedAt) {
        target.duration = Math.max(1, Math.round((now.getTime() - new Date(target.startedAt).getTime()) / 1000));
      }
      target.status = 'ready';
      logger.info(`Recording session stopped in memory: [${target.recordingId}]`);
      return target;
    }

    return null;
  }

  /**
   * 2. Record participant consent
   */
  async recordConsent({ recordingId, meetingId, participant }) {
    if (!participant) return null;

    if (this.isDbConnected()) {
      try {
        const recording = await Recording.findOne({
          $or: [{ recordingId }, { meetingId: meetingId?.toLowerCase().trim(), status: 'recording' }]
        });

        if (recording) {
          const alreadyConsented = recording.participantsConsent?.some(
            (c) => c.userId === participant.userId || (participant.socketId && c.socketId === participant.socketId)
          );

          if (!alreadyConsented) {
            recording.participantsConsent.push({
              userId: participant.userId || '',
              socketId: participant.socketId || '',
              name: participant.name || 'Participant',
              consentedAt: new Date()
            });
            await recording.save();
          }
          return recording;
        }
      } catch (err) {
        logger.warn(`Failed to save consent to MongoDB: ${err.message}`);
      }
    }

    // In-memory fallback
    for (const rec of inMemoryRecordings.values()) {
      if (rec.recordingId === recordingId || (rec.meetingId === meetingId && rec.status === 'recording')) {
        const exists = rec.participantsConsent.some(
          (c) => c.userId === participant.userId || (participant.socketId && c.socketId === participant.socketId)
        );
        if (!exists) {
          rec.participantsConsent.push({
            userId: participant.userId || '',
            socketId: participant.socketId || '',
            name: participant.name || 'Participant',
            consentedAt: new Date()
          });
        }
        return rec;
      }
    }

    return null;
  }

  /**
   * 3. Stop recording session and save uploaded media stream
   */
  async saveRecordingUpload({ meetingId, recordingId, buffer, mimeType, duration, hostId }) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    // Save physical file via StorageService
    const originalName = `meeting_${cleanMeetingId}_${new Date().toISOString().slice(0, 10)}.webm`;
    const savedFile = await storageService.saveFile({
      buffer,
      originalName,
      mimeType: mimeType || 'video/webm',
      meetingId: cleanMeetingId,
      size: buffer.length
    });

    const parsedDuration = Math.round(Number(duration) || 0);

    if (this.isDbConnected()) {
      try {
        let recording = null;
        if (recordingId) {
          recording = await Recording.findOne({ recordingId });
        }
        if (!recording) {
          recording = await Recording.findOne({ meetingId: cleanMeetingId, status: 'recording' }).sort({ createdAt: -1 });
        }

        if (recording) {
          recording.storagePath = savedFile.storagePath;
          recording.storageProvider = savedFile.storageProvider;
          recording.fileName = savedFile.fileName;
          recording.originalName = savedFile.originalName;
          recording.fileSize = savedFile.size;
          recording.mimeType = savedFile.mimeType;
          recording.duration = parsedDuration;
          recording.endedAt = new Date();
          recording.status = 'ready';
          await recording.save();

          logger.info(`Recording [${recording.recordingId}] saved successfully (${savedFile.size} bytes, ${parsedDuration}s)`);
          return typeof recording.toSafeObject === 'function' ? recording.toSafeObject(hostId) : recording;
        }
      } catch (err) {
        logger.warn(`Failed to update Recording in MongoDB: ${err.message}`);
      }
    }

    // In-memory fallback
    let targetRec = recordingId ? inMemoryRecordings.get(recordingId) : null;
    if (!targetRec) {
      for (const rec of inMemoryRecordings.values()) {
        if (rec.meetingId === cleanMeetingId && rec.status === 'recording') {
          targetRec = rec;
          break;
        }
      }
    }

    if (!targetRec) {
      // Ad-hoc creation if recording was uploaded directly
      const newRecId = recordingId || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      targetRec = {
        recordingId: newRecId,
        meetingId: cleanMeetingId,
        meetingTitle: `Meeting ${cleanMeetingId}`,
        host: hostId || null,
        hostName: 'Host',
        storageProvider: savedFile.storageProvider,
        storagePath: savedFile.storagePath,
        fileName: savedFile.fileName,
        originalName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        fileSize: savedFile.size,
        duration: parsedDuration,
        startedAt: new Date(Date.now() - parsedDuration * 1000),
        endedAt: new Date(),
        status: 'ready',
        participantsConsent: [],
        accessSettings: { isPublic: false, allowedRoles: ['host', 'participant'] },
        createdAt: new Date()
      };
      inMemoryRecordings.set(newRecId, targetRec);
      return targetRec;
    }

    targetRec.storagePath = savedFile.storagePath;
    targetRec.storageProvider = savedFile.storageProvider;
    targetRec.fileName = savedFile.fileName;
    targetRec.originalName = savedFile.originalName;
    targetRec.fileSize = savedFile.size;
    targetRec.mimeType = savedFile.mimeType;
    targetRec.duration = parsedDuration;
    targetRec.endedAt = new Date();
    targetRec.status = 'ready';

    logger.info(`In-memory recording [${targetRec.recordingId}] updated to ready.`);
    return targetRec;
  }

  /**
   * 4. Get active recording status for a meeting
   */
  async getActiveRecording(meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const recording = await Recording.findOne({ meetingId: cleanMeetingId, status: 'recording' });
        if (recording) return recording;
      } catch (err) {
        logger.warn(`getActiveRecording error: ${err.message}`);
      }
    }

    for (const rec of inMemoryRecordings.values()) {
      if (rec.meetingId === cleanMeetingId && rec.status === 'recording') {
        return rec;
      }
    }

    return null;
  }

  isChatCall(rec) {
    if (!rec) return false;
    const mid = (rec.meetingId || '').toLowerCase();
    const title = (rec.meetingTitle || '').toLowerCase();
    return (
      mid.startsWith('dm-') ||
      mid.startsWith('voice-') ||
      mid.includes('-video-') ||
      mid.includes('-voice-') ||
      title.includes('voice call') ||
      title.includes('video call') ||
      rec.meetingType === 'chat_call'
    );
  }

  hasValidMediaFile(recording) {
    if (!recording) return false;

    // Must not be pending or failed
    if (['recording', 'failed'].includes(recording.status)) {
      return false;
    }

    // Cloud storage providers (Cloudinary, S3)
    if (recording.storageProvider === 'cloudinary' || recording.storageProvider === 's3') {
      if (recording.fileUrl || (recording.storagePath && recording.storagePath !== 'pending')) {
        return true;
      }
    }

    // Local file storage check
    let filePath = recording.storagePath;
    if (!filePath || filePath === 'pending') return false;

    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        return stat.size > 0;
      } catch {
        return false;
      }
    }

    // Check candidate paths in case project was moved or path was relative
    const basename = path.basename(filePath);
    const cleanMeetingId = (recording.meetingId || '').replace(/[^a-zA-Z0-9_-]/g, '');

    const candidates = [
      basename ? path.join(config.uploadDir, cleanMeetingId, basename) : null,
      basename ? path.join(config.uploadDir, basename) : null,
      filePath ? path.resolve(process.cwd(), filePath) : null,
      filePath ? path.resolve(process.cwd(), 'backend', filePath) : null,
      basename ? path.resolve(process.cwd(), 'uploads', cleanMeetingId, basename) : null,
      basename ? path.resolve(process.cwd(), 'backend', 'uploads', cleanMeetingId, basename) : null
    ].filter(Boolean);

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          const stat = fs.statSync(cand);
          if (stat.size > 0) return true;
        } catch {}
      }
    }

    // Check if the meeting directory has its own valid webm/mp4
    if (cleanMeetingId) {
      const meetingDir = path.join(config.uploadDir, cleanMeetingId);
      if (fs.existsSync(meetingDir)) {
        try {
          const files = fs.readdirSync(meetingDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
          for (const f of files) {
            const stat = fs.statSync(path.join(meetingDir, f));
            if (stat.size > 0) return true;
          }
        } catch {}
      }
    }

    return false;
  }

  /**
   * 5. List all recordings accessible to a user (only where user participated)
   */
  async getRecordingsForUser(userId, meetingIdFilter = null) {
    if (!userId) return [];

    let userEmail = null;
    let userFullName = null;
    let userName = null;

    if (this.isDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const u = await User.findById(userId).select('email fullName username').lean();
          if (u) {
            userEmail = u.email ? u.email.toLowerCase().trim() : null;
            userFullName = u.fullName ? u.fullName.trim() : null;
            userName = u.username ? u.username.trim() : null;
          }
        }
      } catch (err) {
        logger.warn(`Failed to query user for recording library: ${err.message}`);
      }
    }

    // Find all meeting IDs where this user participated (as host, participant, or invitee)
    let participatedMeetingIds = [];
    if (this.isDbConnected()) {
      try {
        const meetingOr = [];
        if (mongoose.Types.ObjectId.isValid(userId)) {
          meetingOr.push({ host: userId });
          meetingOr.push({ 'participants.userId': userId });
        }
        meetingOr.push({ 'participants.userId': userId.toString() });
        if (userEmail) {
          meetingOr.push({ hostEmail: userEmail });
          meetingOr.push({ 'participants.email': userEmail });
          meetingOr.push({ 'invitees.email': userEmail });
        }
        if (userFullName) {
          meetingOr.push({
            'participants.name': new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          });
        }
        if (userName) {
          meetingOr.push({
            'participants.name': new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          });
        }

        if (meetingOr.length > 0) {
          const userMeetings = await Meeting.find({ $or: meetingOr }).select('meetingId').lean();
          participatedMeetingIds = userMeetings
            .map((m) => (m.meetingId || '').toLowerCase().trim())
            .filter(Boolean);
        }
      } catch (err) {
        logger.warn(`Failed to fetch user meetings for recordings: ${err.message}`);
      }
    }

    if (this.isDbConnected()) {
      try {
        const userConditions = [];
        if (mongoose.Types.ObjectId.isValid(userId)) {
          userConditions.push({ host: userId });
        }
        userConditions.push({ 'participantsConsent.userId': userId.toString() });
        userConditions.push({ 'accessSettings.allowedUsers': userId.toString() });
        if (userEmail) {
          userConditions.push({ 'participantsConsent.email': userEmail });
        }
        if (userFullName) {
          userConditions.push({
            'participantsConsent.name': new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
          });
        }
        if (participatedMeetingIds.length > 0) {
          userConditions.push({ meetingId: { $in: participatedMeetingIds } });
        }

        const query = {
          status: { $in: ['ready', 'processing', 'completed'] },
          $or: userConditions
        };
        if (meetingIdFilter) {
          query.meetingId = meetingIdFilter.toLowerCase().trim();
        }

        const docs = await Recording.find(query).sort({ createdAt: -1 });
        // Exclude chat calls and recordings without physical media files
        const validDocs = docs.filter(
          (doc) => !this.isChatCall(doc) && this.hasValidMediaFile(doc)
        );
        return validDocs.map((doc) => (typeof doc.toSafeObject === 'function' ? doc.toSafeObject(userId) : doc));
      } catch (err) {
        logger.warn(`Failed to fetch recordings from DB: ${err.message}`);
      }
    }

    // In-memory fallback
    const all = Array.from(inMemoryRecordings.values()).filter((r) =>
      ['ready', 'processing', 'completed'].includes(r.status)
    );

    const userRecs = all.filter((r) => {
      if (r.host && r.host.toString() === userId.toString()) return true;
      if (
        r.participantsConsent?.some(
          (c) =>
            (c.userId && c.userId.toString() === userId.toString()) ||
            (userEmail && c.email && c.email.toLowerCase() === userEmail) ||
            (userFullName && c.name && c.name.toLowerCase() === userFullName.toLowerCase())
        )
      ) {
        return true;
      }
      if (r.accessSettings?.allowedUsers?.includes(userId.toString())) return true;
      if (r.meetingId && participatedMeetingIds.includes(r.meetingId.toLowerCase().trim())) return true;
      return false;
    });

    const filtered = meetingIdFilter
      ? userRecs.filter((r) => r.meetingId === meetingIdFilter.toLowerCase().trim())
      : userRecs;

    // Exclude chat calls and recordings without physical media files
    const validUserRecs = filtered.filter(
      (r) => !this.isChatCall(r) && this.hasValidMediaFile(r)
    );

    return validUserRecs.map((r) => ({
      ...r,
      id: r.recordingId,
      isHost: Boolean(userId && r.host && r.host.toString() === userId.toString()),
      streamUrl: `/api/recordings/${r.recordingId}/stream`,
      downloadUrl: `/api/recordings/${r.recordingId}/download`
    }));
  }

  /**
   * 6. Retrieve a single recording with authorization check
   */
  async getRecordingById(recordingId, userId) {
    let recording = null;

    if (this.isDbConnected()) {
      try {
        recording = await Recording.findOne({ recordingId });
      } catch (err) {
        logger.warn(`getRecordingById DB query error: ${err.message}`);
      }
    }

    if (!recording) {
      recording = inMemoryRecordings.get(recordingId);
    }

    if (!recording) {
      throw new Error('Recording not found');
    }

    // Authorization check
    await this.assertAccessPermission(recording, userId);

    return typeof recording.toSafeObject === 'function' ? recording.toSafeObject(userId) : recording;
  }

  /**
   * 7. Stream video recording with HTTP Range support (206 Partial Content)
   */
  async getRecordingStreamData(recordingId, userId, rangeHeader) {
    let recording = null;

    if (this.isDbConnected()) {
      try {
        recording = await Recording.findOne({ recordingId });
      } catch (err) {
        logger.warn(`getRecordingStreamData DB query error: ${err.message}`);
      }
    }

    if (!recording) {
      recording = inMemoryRecordings.get(recordingId);
    }

    if (!recording) {
      throw new Error('Recording not found');
    }

    await this.assertAccessPermission(recording, userId);

    let filePath = recording.storagePath;
    if (!filePath || !fs.existsSync(filePath)) {
      const basename = filePath ? path.basename(filePath) : '';
      const cleanMeetingId = (recording.meetingId || '').replace(/[^a-zA-Z0-9_-]/g, '');

      const candidates = [
        basename ? path.join(config.uploadDir, cleanMeetingId, basename) : null,
        basename ? path.join(config.uploadDir, basename) : null,
        filePath ? path.resolve(process.cwd(), filePath) : null,
        filePath ? path.resolve(process.cwd(), 'backend', filePath) : null,
        basename ? path.resolve(process.cwd(), 'uploads', cleanMeetingId, basename) : null,
        basename ? path.resolve(process.cwd(), 'backend', 'uploads', cleanMeetingId, basename) : null
      ].filter(Boolean);

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          filePath = cand;
          break;
        }
      }

      // Check uploadDir/cleanMeetingId for any webm/mp4
      if (!filePath || !fs.existsSync(filePath)) {
        const meetingDir = path.join(config.uploadDir, cleanMeetingId);
        if (fs.existsSync(meetingDir)) {
          const files = fs.readdirSync(meetingDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
          if (files.length > 0) {
            filePath = path.join(meetingDir, files[0]);
          }
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Recording physical file missing from storage');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // HTTP 206 Partial Content range handling
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      return {
        isPartial: true,
        statusCode: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': recording.mimeType || 'video/webm'
        },
        stream: fileStream
      };
    }

    // Full file stream
    return {
      isPartial: false,
      statusCode: 200,
      headers: {
        'Content-Length': fileSize,
        'Content-Type': recording.mimeType || 'video/webm',
        'Accept-Ranges': 'bytes'
      },
      stream: fs.createReadStream(filePath)
    };
  }

  /**
   * 8. Delete recording (Host only)
   */
  async deleteRecording(recordingId, userId) {
    let recording = null;

    if (this.isDbConnected()) {
      try {
        recording = await Recording.findOne({ recordingId });
        if (recording) {
          // Verify host authorization
          if (recording.host && (!userId || recording.host.toString() !== userId.toString())) {
            throw new Error('Only the meeting host can delete this recording');
          }

          // Delete physical file
          await storageService.deleteFile(recording.storagePath, recording.storageProvider);
          await Recording.deleteOne({ recordingId });
          inMemoryRecordings.delete(recordingId);
          logger.info(`Recording [${recordingId}] deleted by host [${userId}]`);
          return true;
        }
      } catch (err) {
        if (err.message.includes('Only the meeting host')) throw err;
      }
    }

    recording = inMemoryRecordings.get(recordingId);
    if (!recording) {
      throw new Error('Recording not found');
    }

    if (recording.host && (!userId || recording.host.toString() !== userId.toString())) {
      throw new Error('Only the meeting host can delete this recording');
    }

    await storageService.deleteFile(recording.storagePath, recording.storageProvider);
    inMemoryRecordings.delete(recordingId);
    return true;
  }

  /**
   * 9. Update Recording Access Settings (Public / Allowed Roles)
   */
  async updateAccessSettings(recordingId, userId, { isPublic, allowedRoles, allowedUsers }) {
    let recording = null;

    if (this.isDbConnected()) {
      try {
        recording = await Recording.findOne({ recordingId });
        if (recording) {
          if (recording.host && (!userId || recording.host.toString() !== userId.toString())) {
            throw new Error('Only the meeting host can change recording permissions');
          }

          recording.accessSettings = {
            isPublic: isPublic !== undefined ? Boolean(isPublic) : recording.accessSettings.isPublic,
            allowedRoles: allowedRoles || recording.accessSettings.allowedRoles,
            allowedUsers: allowedUsers || recording.accessSettings.allowedUsers
          };
          await recording.save();
          return typeof recording.toSafeObject === 'function' ? recording.toSafeObject(userId) : recording;
        }
      } catch (err) {
        if (err.message.includes('Only the meeting host')) throw err;
      }
    }

    recording = inMemoryRecordings.get(recordingId);
    if (!recording) throw new Error('Recording not found');

    if (recording.host && (!userId || recording.host.toString() !== userId.toString())) {
      throw new Error('Only the meeting host can change recording permissions');
    }

    recording.accessSettings = {
      isPublic: isPublic !== undefined ? Boolean(isPublic) : recording.accessSettings.isPublic,
      allowedRoles: allowedRoles || recording.accessSettings.allowedRoles,
      allowedUsers: allowedUsers || recording.accessSettings.allowedUsers
    };

    return recording;
  }

  /**
   * Helper: Check permission to view/download (ensures user was host or participant)
   */
  async assertAccessPermission(recording, userId) {
    if (recording.accessSettings?.isPublic) {
      return true;
    }

    if (!userId) {
      throw new Error('Unauthorized: Authentication required to access this recording');
    }

    // 1. Host has access
    const isHost = recording.host && recording.host.toString() === userId.toString();
    if (isHost) {
      return true;
    }

    // 2. User in allowedUsers list
    if (recording.accessSettings?.allowedUsers?.includes(userId.toString())) {
      return true;
    }

    // 3. User consented in the recording
    if (recording.participantsConsent?.some((c) => c.userId && c.userId.toString() === userId.toString())) {
      return true;
    }

    // 4. User was a participant in the meeting
    if (recording.meetingId) {
      try {
        const meeting = await Meeting.findOne({
          meetingId: recording.meetingId.toLowerCase().trim(),
          $or: [
            { host: userId },
            { 'participants.userId': userId },
            { 'participants.userId': userId.toString() }
          ]
        }).select('_id').lean();

        if (meeting) return true;
      } catch {
        // Fallback
      }
    }

    throw new Error('Unauthorized: You did not participate in this recorded meeting');
  }
}

const recordingServiceInstance = new RecordingService();
recordingServiceInstance.inMemoryRecordings = inMemoryRecordings;
module.exports = recordingServiceInstance;
module.exports.inMemoryRecordings = inMemoryRecordings;
