const meetingFileService = require('../services/meetingFileService');
const storageService = require('../services/storageService');
const chatService = require('../services/chatService');
const meetingService = require('../services/meetingService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * @desc    Upload multiple files to a meeting room
 * @route   POST /api/meetings/:meetingId/files
 * @access  Authorized / Meeting Participant
 */
const uploadFiles = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return sendError(res, 400, 'Please select at least one file to upload.');
    }

    // Determine uploader identity
    const uploader = req.user
      ? {
          id: req.user.id || req.user._id,
          name: req.user.fullName || req.user.username || 'User',
          avatar: req.user.profileImage || ''
        }
      : {
          id: req.body.uploaderId || 'guest_' + Date.now(),
          name: req.body.uploaderName || 'Participant',
          avatar: req.body.uploaderAvatar || ''
        };

    const savedFiles = await meetingFileService.saveFiles({
      meetingId,
      uploader,
      files
    });

    const cleanMeetingId = meetingId.toLowerCase().trim();

    // Broadcast real-time Socket.IO event to all meeting participants
    const io = req.app.get('io');
    if (io) {
      io.in(cleanMeetingId).emit('new-file-shared', {
        files: savedFiles,
        uploader: uploader.name
      });

      // Also publish a system notification in meeting chat
      try {
        const fileNames = savedFiles.map((f) => f.originalName).join(', ');
        const sysMsg = await chatService.createSystemMessage({
          roomId: cleanMeetingId,
          content: `📎 ${uploader.name} shared ${savedFiles.length > 1 ? `${savedFiles.length} files` : 'a file'}: ${fileNames}`
        });
        io.in(cleanMeetingId).emit('new-message', sysMsg);
      } catch (chatErr) {
        logger.warn(`Could not emit system chat for file share: ${chatErr.message}`);
      }
    }

    return sendSuccess(res, 201, 'Files shared successfully with meeting participants', {
      files: savedFiles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active shared files for a meeting
 * @route   GET /api/meetings/:meetingId/files
 * @access  Meeting Participant
 */
const getMeetingFiles = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const files = await meetingFileService.getMeetingFiles(meetingId);
    return sendSuccess(res, 200, 'Meeting files retrieved successfully', { files });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Securely download a meeting file
 * @route   GET /api/meetings/:meetingId/files/:fileId/download
 * @access  Meeting Participant
 */
const downloadFile = async (req, res, next) => {
  try {
    const { meetingId, fileId } = req.params;

    // Security Check: Verify meeting status and password requirements
    const meeting = await meetingService.getMeetingById(meetingId);
    if (meeting) {
      if (meeting.status === 'cancelled' || meeting.status === 'ended') {
        return sendError(res, 403, `Access denied: This meeting is ${meeting.status}.`);
      }
      if (meeting.isPasswordProtected) {
        const userId = req.user ? (req.user.id || req.user._id) : null;
        const isHost = userId && meeting.host && meeting.host.toString() === userId.toString();
        const isParticipant = userId && meeting.participants && meeting.participants.some((p) => p.user && p.user.toString() === userId.toString());
        const passwordHeader = req.headers['x-meeting-password'] || req.query.meetingPassword;

        if (!isHost && !isParticipant && !passwordHeader) {
          return sendError(res, 403, 'Unauthorized: Access to files in this password-protected meeting requires authorization.');
        }
      }
    }

    const file = await meetingFileService.getFileById(fileId, meetingId);

    if (!file) {
      return sendError(res, 404, 'The requested file was not found or has been removed.');
    }

    if (file.storageProvider === 'local') {
      const stream = await storageService.getFileStream(file.storagePath, 'local');

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      if (file.size) {
        res.setHeader('Content-Length', file.size);
      }

      stream.on('error', (err) => {
        logger.error(`Download stream error for [${fileId}]: ${err.message}`);
        if (!res.headersSent) {
          return sendError(res, 500, 'Error streaming file download');
        }
      });

      return stream.pipe(res);
    }

    // For remote cloud storage with direct URLs
    if (file.fileUrl) {
      return res.redirect(file.fileUrl);
    }

    return sendError(res, 404, 'File storage location not reachable.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Preview supported files (Images, PDFs) inline
 * @route   GET /api/meetings/:meetingId/files/:fileId/preview
 * @access  Meeting Participant
 */
const previewFile = async (req, res, next) => {
  try {
    const { meetingId, fileId } = req.params;

    // Security Check: Verify meeting status and password requirements
    const meeting = await meetingService.getMeetingById(meetingId);
    if (meeting) {
      if (meeting.status === 'cancelled' || meeting.status === 'ended') {
        return sendError(res, 403, `Access denied: This meeting is ${meeting.status}.`);
      }
      if (meeting.isPasswordProtected) {
        const userId = req.user ? (req.user.id || req.user._id) : null;
        const isHost = userId && meeting.host && meeting.host.toString() === userId.toString();
        const isParticipant = userId && meeting.participants && meeting.participants.some((p) => p.user && p.user.toString() === userId.toString());
        const passwordHeader = req.headers['x-meeting-password'] || req.query.meetingPassword;

        if (!isHost && !isParticipant && !passwordHeader) {
          return sendError(res, 403, 'Unauthorized: Access to files in this password-protected meeting requires authorization.');
        }
      }
    }

    const file = await meetingFileService.getFileById(fileId, meetingId);

    if (!file) {
      return sendError(res, 404, 'File not found or has been removed.');
    }

    if (file.storageProvider === 'local') {
      const stream = await storageService.getFileStream(file.storagePath, 'local');

      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');

      stream.on('error', (err) => {
        logger.error(`Preview stream error for [${fileId}]: ${err.message}`);
        if (!res.headersSent) {
          return sendError(res, 500, 'Error streaming file preview');
        }
      });

      return stream.pipe(res);
    }

    if (file.fileUrl) {
      return res.redirect(file.fileUrl);
    }

    return sendError(res, 404, 'File preview not accessible.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a shared file (Uploader or Host only)
 * @route   DELETE /api/meetings/:meetingId/files/:fileId
 * @access  Uploader or Host
 */
const deleteFile = async (req, res, next) => {
  try {
    const { meetingId, fileId } = req.params;
    const userId = req.user ? (req.user.id || req.user._id) : req.body.userId;
    let isHost = Boolean(req.user && req.user.role === 'host');

    if (!isHost && userId) {
      const meeting = await meetingService.getMeetingById(meetingId);
      if (meeting && meeting.host && meeting.host.toString() === userId.toString()) {
        isHost = true;
      }
    }

    await meetingFileService.deleteFile({
      fileId,
      meetingId,
      userId,
      isHost
    });

    const cleanMeetingId = meetingId.toLowerCase().trim();

    // Broadcast file deletion to room
    const io = req.app.get('io');
    if (io) {
      io.in(cleanMeetingId).emit('file-deleted', { fileId });
    }

    return sendSuccess(res, 200, 'File removed from meeting successfully', { fileId });
  } catch (error) {
    if (error.message.includes('permission')) {
      return sendError(res, 403, error.message);
    }
    if (error.message.includes('not found')) {
      return sendError(res, 404, error.message);
    }
    next(error);
  }
};

module.exports = {
  uploadFiles,
  getMeetingFiles,
  downloadFile,
  previewFile,
  deleteFile
};

