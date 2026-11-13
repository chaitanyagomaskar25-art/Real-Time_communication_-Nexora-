const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
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
} = require('../controllers/recordingController');

const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Configure multer for recording video uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024 // 150 MB max recording size
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/webm', 'video/mp4', 'video/x-matroska', 'video/quicktime', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.webm') || file.originalname.endsWith('.mp4')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats: WebM, MP4.'));
    }
  }
});

// Meeting recording lifecycle
router.post('/:meetingId/start', protect, startRecording);
router.post('/:meetingId/stop', protect, stopRecording);
router.post('/:meetingId/upload', protect, upload.single('recording'), uploadRecording);
router.post('/:recordingId/consent', optionalAuth, recordConsent);

// Library, streaming & download
router.get('/', protect, getRecordings);
router.get('/:recordingId', optionalAuth, getRecording);
router.get('/:recordingId/stream', optionalAuth, streamRecording);
router.get('/:recordingId/download', optionalAuth, downloadRecording);

// Host management
router.delete('/:recordingId', protect, deleteRecording);
router.put('/:recordingId/permissions', protect, updatePermissions);

module.exports = router;

