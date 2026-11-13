const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      maxlength: [60, 'Full name cannot exceed 60 characters']
    },
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-z0-9_.-]+$/, 'Username can only contain alphanumeric characters, underscores, dots, and hyphens']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    profileImage: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: '',
      maxlength: [300, 'Bio cannot exceed 300 characters']
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    presenceStatus: {
      type: String,
      enum: ['available', 'busy', 'in-meeting', 'away', 'offline'],
      default: 'available'
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true
    },
    suspendedReason: {
      type: String,
      default: ''
    },
    suspendedAt: {
      type: Date,
      default: null
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpire: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Hash password with bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire time (30 minutes)
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

  return resetToken;
};

// Format safe user object for API responses (never expose password or internal tokens)
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : this.id,
    fullName: this.fullName,
    name: this.fullName, // backward compatibility
    username: this.username,
    email: this.email,
    profileImage: this.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.fullName)}`,
    bio: this.bio || '',
    isOnline: Boolean(this.isOnline),
    presenceStatus: this.presenceStatus || (this.isOnline ? 'available' : 'offline'),
    lastSeen: this.lastSeen,
    role: this.role || 'user',
    status: this.status || 'active',
    suspendedReason: this.suspendedReason || '',
    suspendedAt: this.suspendedAt || null,
    createdAt: this.createdAt
  };
};

// Compound indexes for high-frequency queries
userSchema.index({ role: 1, status: 1 });
userSchema.index({ email: 1, status: 1 });
userSchema.index({ isOnline: 1, presenceStatus: 1 });

module.exports = mongoose.model('User', userSchema);
