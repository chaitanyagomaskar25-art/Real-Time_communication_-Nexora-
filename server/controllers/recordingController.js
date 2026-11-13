const recordingService = require('../services/recordingService');
const meetingService = require('../services/meetingService');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * 1. Start meeting recording (Host only)
 */
const startRecording = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;
    const userName = req.user ? (req.user.fullName || req.user.username) : 'Host';

    // Verify host permission
    const meeting = await meetingService.getMeetingById(meetingId);
    if (meeting && meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
      return sendError(res, 403, 'Only the meeting host can start recording');
    }

    const meetingTitle = meeting?.title || `Meeting ${meetingId}`;
    const recording = await recordingService.startRecording({
      meetingId,
      hostId: userId,
      hostName: userName,
      meetingTitle
    });

    // Broadcast live event to all room participants
    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('recording-started', {
        recordingId: recording.recordingId,
        hostName: userName,
        startedAt: recording.startedAt,
        message: 'This meeting is being recorded by the host.'
      });
    }

    return sendSuccess(res, 201, 'Meeting recording started', recording);
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Stop meeting recording (Host only)
 */
const stopRecording = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { recordingId, duration } = req.body || {};
    const userId = req.user ? (req.user.id || req.user._id) : null;

    const meeting = await meetingService.getMeetingById(meetingId);
    if (meeting && meeting.host && (!userId || meeting.host.toString() !== userId.toString())) {
      return sendError(res, 403, 'Only the meeting host can stop recording');
    }

    const stoppedRec = await recordingService.stopRecording({
      meetingId,
      recordingId,
      duration
    });

    const recId = stoppedRec?.recordingId || recordingId;

    // Notify participants that recording stopped
    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('recording-stopped', {
        recordingId: recId,
        stoppedAt: new Date()
      });
    }

    return sendSuccess(res, 200, 'Recording stopped. Processing media file...', {
      recordingId: recId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Upload recorded audio/video media file
 */
const uploadRecording = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { recordingId, duration } = req.body;
    const userId = req.user ? (req.user.id || req.user._id) : null;

    if (!req.file || !req.file.buffer) {
      return sendError(res, 400, 'No recording media file uploaded');
    }

    const recording = await recordingService.saveRecordingUpload({
      meetingId,
      recordingId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype || 'video/webm',
      duration,
      hostId: userId
    });

    const io = req.app.get('io');
    if (io) {
      io.in(meetingId.toLowerCase().trim()).emit('recording-ready', {
        recordingId: recording.recordingId,
        duration: recording.duration
      });
    }

    return sendSuccess(res, 201, 'Recording file uploaded and processed successfully', recording);
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Submit participant consent
 */
const recordConsent = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const { meetingId, socketId } = req.body;
    const userId = req.user ? (req.user.id || req.user._id) : req.body.userId;
    const name = req.user ? (req.user.fullName || req.user.username) : req.body.name;

    const result = await recordingService.recordConsent({
      recordingId,
      meetingId,
      participant: { userId, socketId, name }
    });

    return sendSuccess(res, 200, 'Consent recorded', { consented: true, recordingId: result?.recordingId });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. List recordings in library
 */
const getRecordings = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user.id || req.user._id) : null;
    const { meetingId } = req.query;

    const recordings = await recordingService.getRecordingsForUser(userId, meetingId);
    return sendSuccess(res, 200, 'Recordings retrieved successfully', { recordings });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get single recording details
 */
const getRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;

    const recording = await recordingService.getRecordingById(recordingId, userId);
    return sendSuccess(res, 200, 'Recording details retrieved', recording);
  } catch (error) {
    if (error.message.includes('Unauthorized')) {
      return sendError(res, 403, error.message);
    }
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

/**
 * 7. Stream video with HTTP 206 Partial Content
 */
const streamRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;
    const range = req.headers.range;

    const streamData = await recordingService.getRecordingStreamData(recordingId, userId, range);

    res.writeHead(streamData.statusCode, streamData.headers);
    streamData.stream.pipe(res);
  } catch (error) {
    if (error.message.includes('Unauthorized')) {
      return sendError(res, 403, error.message);
    }
    if (error.message.includes('not found') || error.message.includes('missing')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

/**
 * 8. Secure download recording
 */
const downloadRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;

    const recording = await recordingService.getRecordingById(recordingId, userId);
    const streamData = await recordingService.getRecordingStreamData(recordingId, userId, null);

    const safeFilename = encodeURIComponent(recording.originalName || `${recording.recordingId}.webm`);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', recording.mimeType || 'video/webm');
    if (recording.fileSize) {
      res.setHeader('Content-Length', recording.fileSize);
    }

    streamData.stream.pipe(res);
  } catch (error) {
    if (error.message.includes('Unauthorized')) {
      return sendError(res, 403, error.message);
    }
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

/**
 * 9. Delete recording (Host only)
 */
const deleteRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;

    await recordingService.deleteRecording(recordingId, userId);
    return sendSuccess(res, 200, 'Recording deleted successfully', { recordingId });
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

/**
 * 10. Update recording permissions (Host only)
 */
const updatePermissions = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : null;
    const { isPublic, allowedRoles, allowedUsers } = req.body;

    const updated = await recordingService.updateAccessSettings(recordingId, userId, {
      isPublic,
      allowedRoles,
      allowedUsers
    });

    return sendSuccess(res, 200, 'Recording access settings updated', updated);
  } catch (error) {
    if (error.message.includes('Only the meeting host')) {
      return sendError(res, 403, error.message);
    }
    next(error);
  }
};

module.exports = {
  startRecording,
  stopRecording,
  uploadRecording,
  recordConsent,
  getRecordings,
  getRecording,
  streamRecording,
  downloadRecording,
  deleteRecording,
  updatePermissions
};
