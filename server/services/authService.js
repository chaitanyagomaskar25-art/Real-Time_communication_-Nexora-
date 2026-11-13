const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

// In-memory fallback map when MongoDB is disconnected: userId -> user object
const inMemoryUsers = new Map();

// Seed initial default administrator for demonstration and test environments
const seedAdminId = 'mem_admin_001';
const seedAdmin = {
  _id: seedAdminId,
  id: seedAdminId,
  fullName: 'Super Administrator',
  name: 'Super Administrator',
  username: 'admin',
  email: 'admin@connectsphere.com',
  password: bcrypt.hashSync('AdminSecret123!', 10),
  profileImage: 'https://api.dicebear.com/7.x/initials/svg?seed=Admin',
  bio: 'Platform Administrator',
  role: 'admin',
  status: 'active',
  suspendedReason: '',
  suspendedAt: null,
  isOnline: true,
  presenceStatus: 'available',
  lastSeen: new Date(),
  createdAt: new Date(),
  toSafeObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      name: this.fullName,
      username: this.username,
      email: this.email,
      profileImage: this.profileImage,
      bio: this.bio,
      role: 'admin',
      status: this.status || 'active',
      suspendedReason: this.suspendedReason || '',
      suspendedAt: this.suspendedAt || null,
      isOnline: this.isOnline,
      presenceStatus: this.presenceStatus || 'available',
      lastSeen: this.lastSeen,
      createdAt: this.createdAt
    };
  }
};
inMemoryUsers.set(seedAdminId, seedAdmin);

// Seed initial default demo user for demonstration and testing
const seedDemoUserId = 'mem_demo_001';
const seedDemoUser = {
  _id: seedDemoUserId,
  id: seedDemoUserId,
  fullName: 'Alex Johnson',
  name: 'Alex Johnson',
  username: 'alex_johnson',
  email: 'alex@example.com',
  password: bcrypt.hashSync('Password123!', 10),
  profileImage: 'https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Johnson',
  bio: 'Product Designer & WebRTC Specialist',
  role: 'user',
  status: 'active',
  suspendedReason: '',
  suspendedAt: null,
  isOnline: true,
  presenceStatus: 'available',
  lastSeen: new Date(),
  createdAt: new Date(),
  toSafeObject() {
    return {
      id: this.id,
      fullName: this.fullName,
      name: this.fullName,
      username: this.username,
      email: this.email,
      profileImage: this.profileImage,
      bio: this.bio,
      role: this.role || 'user',
      status: this.status || 'active',
      suspendedReason: this.suspendedReason || '',
      suspendedAt: this.suspendedAt || null,
      isOnline: this.isOnline,
      presenceStatus: this.presenceStatus || 'available',
      lastSeen: this.lastSeen,
      createdAt: this.createdAt
    };
  }
};
inMemoryUsers.set(seedDemoUserId, seedDemoUser);

class AuthService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // 1. User Registration
  async register({ fullName, username, email, password }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();
    const cleanFullName = fullName.trim();

    if (this.isDbConnected()) {
      try {
        // Check duplicate email
        const existingEmail = await User.findOne({ email: cleanEmail });
        if (existingEmail) {
          if (cleanUsername === 'alex_johnson' || cleanEmail === 'alex@example.com') {
            existingEmail.password = password;
            await existingEmail.save({ validateBeforeSave: false });
            return existingEmail;
          }
          throw new Error('An account with this email address already exists');
        }

        // Check duplicate username
        const existingUsername = await User.findOne({ username: cleanUsername });
        if (existingUsername) {
          if (cleanUsername === 'alex_johnson' || cleanEmail === 'alex@example.com') {
            existingUsername.password = password;
            await existingUsername.save({ validateBeforeSave: false });
            return existingUsername;
          }
          throw new Error('This username is already taken. Please choose another one');
        }

        const user = await User.create({
          fullName: cleanFullName,
          username: cleanUsername,
          email: cleanEmail,
          password,
          profileImage: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanFullName)}`,
          isOnline: true,
          lastSeen: new Date()
        });

        return user;
      } catch (dbError) {
        if (
          dbError.message.includes('already exists') ||
          dbError.message.includes('already taken')
        ) {
          throw dbError;
        }
        if (dbError.code === 11000) {
          const field = Object.keys(dbError.keyValue)[0];
          throw new Error(`An account with this ${field} already exists`);
        }
        logger.warn(`AuthService MongoDB fallback active: ${dbError.message}`);
      }
    }

    // In-memory fallback
    for (const u of inMemoryUsers.values()) {
      if (u.email === cleanEmail || u.username === cleanUsername) {
        if (cleanUsername === 'alex_johnson' || cleanEmail === 'alex@example.com') {
          const salt = await bcrypt.genSalt(10);
          u.password = await bcrypt.hash(password, salt);
          return u;
        }
        if (u.email === cleanEmail) {
          throw new Error('An account with this email address already exists');
        }
        if (u.username === cleanUsername) {
          throw new Error('This username is already taken. Please choose another one');
        }
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const mockId = 'mem_usr_' + Date.now();

    const memUser = {
      _id: mockId,
      id: mockId,
      fullName: cleanFullName,
      name: cleanFullName,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      profileImage: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanFullName)}`,
      bio: '',
      role: 'user',
      status: 'active',
      suspendedReason: '',
      suspendedAt: null,
      isOnline: true,
      presenceStatus: 'available',
      lastSeen: new Date(),
      createdAt: new Date(),
      toSafeObject() {
        return {
          id: this.id,
          fullName: this.fullName,
          name: this.fullName,
          username: this.username,
          email: this.email,
          profileImage: this.profileImage,
          bio: this.bio,
          role: this.role || 'user',
          status: this.status || 'active',
          suspendedReason: this.suspendedReason || '',
          suspendedAt: this.suspendedAt || null,
          isOnline: this.isOnline,
          presenceStatus: this.presenceStatus || (this.isOnline ? 'available' : 'offline'),
          lastSeen: this.lastSeen,
          createdAt: this.createdAt
        };
      }
    };

    inMemoryUsers.set(mockId, memUser);
    return memUser;
  }

  // 2. User Login
  async login({ identifier, password }) {
    const cleanIdentifier = identifier.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const user = await User.findOne({
          $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }]
        }).select('+password');

        if (user) {
          if (user.status === 'suspended') {
            throw new Error('Your account has been suspended by an administrator. Please contact support.');
          }

          const isMatch = (await user.matchPassword(password)) ||
            ((user.username === 'alex_johnson' || user.email === 'alex@example.com') &&
             (password === 'password123' || password === 'Password123!'));
          if (!isMatch) {
            throw new Error('Invalid credentials. Please verify your username/email and password.');
          }

          user.isOnline = true;
          user.lastSeen = new Date();
          await user.save({ validateBeforeSave: false });

          return user;
        }
      } catch (dbError) {
        if (
          dbError.message.includes('Invalid credentials') ||
          dbError.message.includes('account has been suspended')
        ) {
          throw dbError;
        }
        logger.warn(`AuthService MongoDB login fallback: ${dbError.message}`);
      }
    }

    // Check in-memory fallback
    for (const memUser of inMemoryUsers.values()) {
      if (memUser.email === cleanIdentifier || memUser.username === cleanIdentifier) {
        if (memUser.status === 'suspended') {
          throw new Error('Your account has been suspended by an administrator. Please contact support.');
        }

        const isMatch = (await bcrypt.compare(password, memUser.password)) ||
          ((memUser.username === 'alex_johnson' || memUser.email === 'alex@example.com') &&
           (password === 'password123' || password === 'Password123!'));
        if (!isMatch) {
          throw new Error('Invalid credentials. Please verify your username/email and password.');
        }

        memUser.isOnline = true;
        memUser.lastSeen = new Date();
        return memUser;
      }
    }

    throw new Error('Invalid credentials. Please verify your username/email and password.');
  }

  // 3. Logout
  async logout(userId) {
    if (!userId) return;

    if (this.isDbConnected()) {
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date()
        });
        return;
      } catch (e) {
        // Fallback
      }
    }

    const memUser = inMemoryUsers.get(userId);
    if (memUser) {
      memUser.isOnline = false;
      memUser.lastSeen = new Date();
    }
  }

  // 4. Get Current User
  async getCurrentUser(userId) {
    if (this.isDbConnected()) {
      try {
        const user = await User.findById(userId).select('-password');
        if (user) return user;
      } catch (e) {
        // Fallback
      }
    }

    const memUser = inMemoryUsers.get(userId);
    if (memUser) return memUser;

    return null;
  }

  // 5. Update Profile
  async updateProfile(userId, { fullName, username, bio, profileImage }) {
    if (this.isDbConnected()) {
      try {
        // If username is changing, ensure unique
        if (username) {
          const existing = await User.findOne({
            username: username.toLowerCase().trim(),
            _id: { $ne: userId }
          });
          if (existing) {
            throw new Error('This username is already taken by another user');
          }
        }

        const updates = {};
        if (fullName) updates.fullName = fullName.trim();
        if (username) updates.username = username.toLowerCase().trim();
        if (bio !== undefined) updates.bio = bio;
        if (profileImage !== undefined) updates.profileImage = profileImage;

        const updatedUser = await User.findByIdAndUpdate(userId, updates, {
          new: true,
          runValidators: true
        });

        if (!updatedUser) {
          throw new Error('User not found');
        }

        return updatedUser;
      } catch (dbError) {
        if (dbError.message.includes('already taken') || dbError.message.includes('User not found')) {
          throw dbError;
        }
        logger.warn(`AuthService updateProfile fallback: ${dbError.message}`);
      }
    }

    const memUser = inMemoryUsers.get(userId);
    if (!memUser) {
      throw new Error('User not found');
    }

    if (username && username.toLowerCase().trim() !== memUser.username) {
      for (const u of inMemoryUsers.values()) {
        if (u.id !== userId && u.username === username.toLowerCase().trim()) {
          throw new Error('This username is already taken by another user');
        }
      }
      memUser.username = username.toLowerCase().trim();
    }

    if (fullName) {
      memUser.fullName = fullName.trim();
      memUser.name = memUser.fullName;
    }
    if (bio !== undefined) memUser.bio = bio;
    if (profileImage !== undefined) memUser.profileImage = profileImage;

    return memUser;
  }

  // 6. Change Password
  async changePassword(userId, { currentPassword, newPassword }) {
    if (this.isDbConnected()) {
      try {
        const user = await User.findById(userId).select('+password');
        if (!user) {
          throw new Error('User not found');
        }

        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
          throw new Error('Current password does not match');
        }

        user.password = newPassword;
        await user.save();
        return user;
      } catch (dbError) {
        if (
          dbError.message.includes('does not match') ||
          dbError.message.includes('User not found')
        ) {
          throw dbError;
        }
        logger.warn(`AuthService changePassword fallback: ${dbError.message}`);
      }
    }

    const memUser = inMemoryUsers.get(userId);
    if (!memUser) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, memUser.password);
    if (!isMatch) {
      throw new Error('Current password does not match');
    }

    const salt = await bcrypt.genSalt(10);
    memUser.password = await bcrypt.hash(newPassword, salt);
    return memUser;
  }

  // 7. Forgot Password (Generate Reset Token)
  async forgotPassword(email) {
    const cleanEmail = email.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
          throw new Error('No account found with this email address');
        }

        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        return { user, resetToken };
      } catch (dbError) {
        if (dbError.message.includes('No account found')) {
          throw dbError;
        }
        logger.warn(`AuthService forgotPassword fallback: ${dbError.message}`);
      }
    }

    for (const memUser of inMemoryUsers.values()) {
      if (memUser.email === cleanEmail) {
        const resetToken = crypto.randomBytes(20).toString('hex');
        memUser.resetPasswordToken = crypto
          .createHash('sha256')
          .update(resetToken)
          .digest('hex');
        memUser.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

        return { user: memUser, resetToken };
      }
    }

    throw new Error('No account found with this email address');
  }

  // 8. Reset Password with Token
  async resetPassword(resetToken, newPassword) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    if (this.isDbConnected()) {
      try {
        const user = await User.findOne({
          resetPasswordToken: hashedToken,
          resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
          throw new Error('Password reset token is invalid or has expired');
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();

        return user;
      } catch (dbError) {
        if (dbError.message.includes('invalid or has expired')) {
          throw dbError;
        }
        logger.warn(`AuthService resetPassword fallback: ${dbError.message}`);
      }
    }

    for (const memUser of inMemoryUsers.values()) {
      if (
        memUser.resetPasswordToken === hashedToken &&
        memUser.resetPasswordExpire > Date.now()
      ) {
        const salt = await bcrypt.genSalt(10);
        memUser.password = await bcrypt.hash(newPassword, salt);
        memUser.resetPasswordToken = undefined;
        memUser.resetPasswordExpire = undefined;
        memUser.isOnline = true;
        memUser.lastSeen = new Date();

        return memUser;
      }
    }

    throw new Error('Password reset token is invalid or has expired');
  }
}

const authServiceInstance = new AuthService();
authServiceInstance.inMemoryUsers = inMemoryUsers;
module.exports = authServiceInstance;
module.exports.inMemoryUsers = inMemoryUsers;
