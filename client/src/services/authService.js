import api from './api';
import { STORAGE_KEYS } from '../utils/constants';

export const authService = {
  // Register with fullName, username, email, password
  async register({ fullName, username, email, password }) {
    const res = await api.post('/auth/register', {
      fullName,
      username,
      email,
      password
    });

    const user = res.user || res.data?.user;
    const token = res.token || res.data?.token;

    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }

    return { user, token };
  },

  // Login with identifier (email or username) and password
  async login({ identifier, password }) {
    const res = await api.post('/auth/login', {
      identifier,
      password
    });

    const user = res.user || res.data?.user;
    const token = res.token || res.data?.token;

    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }

    return { user, token };
  },

  // Get current user via cookie-based session
  async getCurrentUser() {
    const res = await api.get('/auth/me');
    const user = res.data || res.user;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    return user;
  },

  // Update profile
  async updateProfile({ fullName, username, bio, profileImage }) {
    const res = await api.put('/auth/profile', {
      fullName,
      username,
      bio,
      profileImage
    });
    const user = res.data || res.user;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    return user;
  },

  // Change password
  async changePassword({ currentPassword, newPassword }) {
    const res = await api.put('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return res;
  },

  // Forgot password
  async forgotPassword(email) {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  // Reset password
  async resetPassword(resetToken, password) {
    const res = await api.put(`/auth/reset-password/${resetToken}`, { password });
    const user = res.user || res.data?.user;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    return res;
  },

  // Logout
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getStoredUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  getStoredToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }
};
