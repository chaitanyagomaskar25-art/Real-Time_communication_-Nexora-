const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/connectsphere',
  jwtSecret: process.env.JWT_SECRET || 'connectsphere_default_secret_dev_key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // File Upload & Storage Configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 25 * 1024 * 1024, // 25 MB default limit
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },
  s3: {
    bucket: process.env.AWS_S3_BUCKET || '',
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },

  // Redis Multi-instance Scaling (Socket.IO Adapter)
  redisUrl: process.env.REDIS_URL || '',

  // WebRTC ICE / TURN Relay Configuration
  turn: {
    url: process.env.TURN_URL || '',
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || ''
  },

  // AI Productivity Configuration (Keys stored securely on backend)
  ai: {
    provider: process.env.AI_PROVIDER || 'built-in',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || ''
  }
};

// Security check for production secret hygiene
if (config.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('default') || process.env.JWT_SECRET.length < 32) {
    console.warn('[SECURITY WARNING] Insecure or default JWT_SECRET detected in production. Secrets must be cryptographically random.');
  }
}

module.exports = config;

