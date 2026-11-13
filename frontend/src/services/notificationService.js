import api from './api';

export const notificationService = {
  // Get current user's notifications
  async getNotifications() {
    const res = await api.get('/notifications');
    return res.data;
  },

  // Mark single notification read
  async markAsRead(id) {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },

  // Mark all notifications read
  async markAllAsRead() {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },

  // Delete notification
  async deleteNotification(id) {
    const res = await api.delete(`/notifications/${id}`);
    return res.data;
  },

  // Send direct call notification to a user
  async callUser(recipientId, meetingId) {
    const res = await api.post('/notifications/call-user', { recipientId, meetingId });
    return res.data;
  }
};

