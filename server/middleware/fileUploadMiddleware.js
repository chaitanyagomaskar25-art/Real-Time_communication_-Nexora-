const multer = require('multer');
const path = require('path');
const config = require('../config/config');

// Dangerous extensions strictly prohibited
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.php3', '.php4',
  '.pl', '.py', '.cgi', '.js', '.vbs', '.wsf', '.msi', '.dll', '.scr',
  '.com', '.jar', '.html', '.htm', '.xhtml', '.jsp', '.asp', '.aspx', '.apk'
]);

// Allowed extension mapping with corresponding MIME type regex/whitelist
const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp',
  // Code & Data
  '.csv', '.json', '.xml', '.yaml', '.yml', '.md', '.sql', '.log',
  // Archives
  '.zip', '.tar', '.gz', '.7z', '.rar',
  // Audio & Video
  '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.mov', '.m4a'
]);

// Memory storage to inspect and securely transfer to StorageService
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  // 1. Check for blocked dangerous executable files
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(
      new Error(`Executable and script files (${ext}) are prohibited for security reasons.`),
      false
    );
  }

  // 2. Validate allowed extensions
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new Error(`File extension ${ext || 'none'} is not supported. Please upload documents, images, code, or archives.`),
      false
    );
  }

  // 3. Prevent null byte injection or path traversal attempts
  if (originalName.indexOf('\0') !== -1 || originalName.includes('..')) {
    return cb(new Error('Invalid filename path characters detected.'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize, // 25 MB default
    files: 10 // Max 10 files per upload batch
  },
  fileFilter
});

// Middleware wrapper to catch Multer errors and return clean JSON responses
const handleFileUpload = (req, res, next) => {
  const uploadHandler = upload.array('files', 10);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(config.maxFileSize / (1024 * 1024));
          return res.status(400).json({
            success: false,
            message: `File size exceeds the allowed limit of ${maxMb}MB.`
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'You can upload a maximum of 10 files at a time.'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload validation failed.'
      });
    }

    next();
  });
};

// Single file upload middleware wrapper
const handleSingleFileUpload = (fieldName = 'file') => (req, res, next) => {
  const uploadSingle = upload.single(fieldName);

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = Math.round(config.maxFileSize / (1024 * 1024));
          return res.status(400).json({
            success: false,
            message: `File size exceeds the allowed limit of ${maxMb}MB.`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || 'File upload validation failed.'
      });
    }

    next();
  });
};

module.exports = {
  handleFileUpload,
  handleSingleFileUpload
};

