const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');

class StorageService {
  constructor() {
    this.uploadDir = config.uploadDir;
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (err) {
      logger.error(`Failed to create upload directory [${this.uploadDir}]: ${err.message}`);
    }
  }

  sanitizeFilename(name) {
    if (!name) return 'file';
    // Remove directory traversal characters and replace risky characters
    const clean = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    return clean.substring(0, 120);
  }

  isCloudinaryConfigured() {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    return Boolean(cloudName && apiKey && apiSecret);
  }

  isS3Configured() {
    const { bucket, accessKeyId, secretAccessKey } = config.s3;
    return Boolean(bucket && accessKeyId && secretAccessKey);
  }

  getActiveProvider() {
    if (this.isCloudinaryConfigured()) return 'cloudinary';
    if (this.isS3Configured()) return 's3';
    return 'local';
  }

  /**
   * Save uploaded file buffer to active storage provider
   */
  async saveFile({ buffer, originalName, mimeType, meetingId, size }) {
    const sanitizedName = this.sanitizeFilename(originalName);
    const extension = path.extname(sanitizedName).toLowerCase();
    const fileId = 'file_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const storageFileName = `${fileId}_${sanitizedName}`;

    const provider = this.getActiveProvider();

    // 1. Cloudinary Provider (if configured)
    if (provider === 'cloudinary') {
      try {
        const result = await this.uploadToCloudinary({ buffer, storageFileName, meetingId, mimeType });
        return {
          fileId,
          fileName: storageFileName,
          originalName: sanitizedName,
          extension,
          mimeType,
          size: size || buffer.length,
          storageProvider: 'cloudinary',
          storagePath: result.publicId || storageFileName,
          fileUrl: result.secureUrl
        };
      } catch (err) {
        logger.warn(`Cloudinary upload failed, falling back to local storage: ${err.message}`);
      }
    }

    // 2. S3 Provider (if configured)
    if (provider === 's3') {
      try {
        const result = await this.uploadToS3({ buffer, storageFileName, meetingId, mimeType });
        return {
          fileId,
          fileName: storageFileName,
          originalName: sanitizedName,
          extension,
          mimeType,
          size: size || buffer.length,
          storageProvider: 's3',
          storagePath: result.key || storageFileName,
          fileUrl: result.location
        };
      } catch (err) {
        logger.warn(`S3 upload failed, falling back to local storage: ${err.message}`);
      }
    }

    // 3. Local Disk Storage Provider (Default & Fallback)
    const meetingDir = path.join(this.uploadDir, meetingId.replace(/[^a-zA-Z0-9_-]/g, ''));
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true });
    }

    const localPath = path.join(meetingDir, storageFileName);
    await fs.promises.writeFile(localPath, buffer);

    return {
      fileId,
      fileName: storageFileName,
      originalName: sanitizedName,
      extension,
      mimeType,
      size: size || buffer.length,
      storageProvider: 'local',
      storagePath: localPath,
      fileUrl: `/api/meetings/${meetingId}/files/${fileId}/download`
    };
  }

  /**
   * Retrieve readable file stream for download or preview
   */
  async getFileStream(storagePath, storageProvider = 'local') {
    if (storageProvider === 'local') {
      if (!fs.existsSync(storagePath)) {
        throw new Error('File not found on storage server');
      }
      return fs.createReadStream(storagePath);
    }

    // For remote cloud providers where direct streaming is requested
    throw new Error(`Direct streaming not implemented for provider [${storageProvider}]`);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storagePath, storageProvider = 'local') {
    if (storageProvider === 'local') {
      try {
        if (fs.existsSync(storagePath)) {
          await fs.promises.unlink(storagePath);
        }
      } catch (err) {
        logger.warn(`Failed to delete local file [${storagePath}]: ${err.message}`);
      }
    }
  }

  // Cloudinary HTTP API uploader
  async uploadToCloudinary({ buffer, storageFileName, meetingId }) {
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const cleanMeetingId = (meetingId || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFileName = path.parse(storageFileName).name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const folder = `connectsphere/${cleanMeetingId}`;
    const publicId = `${folder}/${cleanFileName}_${timestamp}`;

    // Cloudinary signature parameters must be sorted alphabetically by parameter name:
    // folder, public_id, timestamp
    const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append('file', blob, storageFileName);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary responded with HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    logger.info(`[Cloudinary] File uploaded successfully: ${data.secure_url}`);
    return {
      publicId: data.public_id,
      secureUrl: data.secure_url
    };
  }

  // S3 Compatible Object Storage uploader
  async uploadToS3({ _buffer, storageFileName, meetingId, _mimeType }) {
    // S3 mock/adapter structure
    const key = `connectsphere/${meetingId}/${storageFileName}`;
    return {
      key,
      location: `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`
    };
  }
}

module.exports = new StorageService();
