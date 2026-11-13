const mongoose = require('mongoose');
const MeetingFile = require('../models/MeetingFile');
const storageService = require('./storageService');
const logger = require('../utils/logger');

// In-memory fallback map: meetingId -> Array<FileObject>
const inMemoryFiles = new Map();

class MeetingFileService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Save uploaded files to storage and persist metadata
   */
  async saveFiles({ meetingId, uploader, files }) {
    const cleanMeetingId = meetingId.toLowerCase().trim();
    const savedRecords = [];

    for (const file of files) {
      try {
        // 1. Upload to active storage provider (local / cloudinary / s3)
        const storageResult = await storageService.saveFile({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          meetingId: cleanMeetingId,
          size: file.size
        });

        const fileRecord = {
          fileId: storageResult.fileId,
          meetingId: cleanMeetingId,
          uploaderId: uploader.id || uploader.userId || 'guest',
          uploaderName: uploader.name || uploader.fullName || 'Participant',
          uploaderAvatar: uploader.avatar || uploader.profileImage || '',
          originalName: storageResult.originalName,
          fileName: storageResult.fileName,
          storageProvider: storageResult.storageProvider,
          storagePath: storageResult.storagePath,
          fileUrl: storageResult.fileUrl,
          mimeType: storageResult.mimeType,
          extension: storageResult.extension,
          size: storageResult.size,
          isDeleted: false,
          createdAt: new Date()
        };

        // 2. Persist in MongoDB
        if (this.isDbConnected()) {
          try {
            const savedDoc = await MeetingFile.create(fileRecord);
            savedRecords.push(savedDoc.toJSON());
            continue;
          } catch (dbErr) {
            logger.warn(`MeetingFile MongoDB save error, falling back to cache: ${dbErr.message}`);
          }
        }

        // 3. In-memory fallback
        if (!inMemoryFiles.has(cleanMeetingId)) {
          inMemoryFiles.set(cleanMeetingId, []);
        }
        inMemoryFiles.get(cleanMeetingId).push(fileRecord);
        savedRecords.push({ ...fileRecord, id: fileRecord.fileId });
      } catch (err) {
        logger.error(`Error saving file [${file.originalname}] for meeting [${cleanMeetingId}]: ${err.message}`);
        throw err;
      }
    }

    return savedRecords;
  }

  /**
   * Get all active shared files for a meeting
   */
  async getMeetingFiles(meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const files = await MeetingFile.find({
          meetingId: cleanMeetingId,
          isDeleted: false
        }).sort({ createdAt: -1 });

        return files.map((f) => f.toJSON());
      } catch (err) {
        logger.warn(`MeetingFile MongoDB fetch error, falling back: ${err.message}`);
      }
    }

    const all = inMemoryFiles.get(cleanMeetingId) || [];
    return all.filter((f) => !f.isDeleted).map((f) => ({ ...f, id: f.fileId }));
  }

  /**
   * Find a single file by fileId and meetingId
   */
  async getFileById(fileId, meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const doc = await MeetingFile.findOne({
          fileId,
          meetingId: cleanMeetingId,
          isDeleted: false
        });
        if (doc) return doc.toJSON();
      } catch (err) {
        logger.warn(`MeetingFile getFileById MongoDB error: ${err.message}`);
      }
    }

    const all = inMemoryFiles.get(cleanMeetingId) || [];
    const found = all.find((f) => f.fileId === fileId && !f.isDeleted);
    return found ? { ...found, id: found.fileId } : null;
  }

  /**
   * Delete shared file (Uploader or Host only)
   */
  async deleteFile({ fileId, meetingId, userId, isHost }) {
    const file = await this.getFileById(fileId, meetingId);
    if (!file) {
      throw new Error('File not found or already deleted');
    }

    // Permission check: only original uploader or meeting host can delete
    const isUploader = file.uploaderId === userId;
    if (!isUploader && !isHost) {
      throw new Error('You do not have permission to delete this file');
    }

    // Mark as deleted in MongoDB
    if (this.isDbConnected()) {
      try {
        await MeetingFile.findOneAndUpdate(
          { fileId, meetingId: meetingId.toLowerCase().trim() },
          { isDeleted: true }
        );
      } catch (err) {
        logger.warn(`MeetingFile soft delete MongoDB error: ${err.message}`);
      }
    }

    // Mark deleted in memory
    const cleanMeetingId = meetingId.toLowerCase().trim();
    if (inMemoryFiles.has(cleanMeetingId)) {
      const all = inMemoryFiles.get(cleanMeetingId);
      const target = all.find((f) => f.fileId === fileId);
      if (target) {
        target.isDeleted = true;
      }
    }

    // Delete physical file from storage
    await storageService.deleteFile(file.storagePath, file.storageProvider);

    return file;
  }
}

const meetingFileServiceInstance = new MeetingFileService();
meetingFileServiceInstance.inMemoryFiles = inMemoryFiles;
module.exports = meetingFileServiceInstance;
module.exports.inMemoryFiles = inMemoryFiles;

