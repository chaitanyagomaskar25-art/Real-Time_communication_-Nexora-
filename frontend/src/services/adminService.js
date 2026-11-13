import api from './api';

export const adminService = {
  // 1. Overview
  getOverview: async () => {
    const response = await api.get('/admin/overview');
    return response.data?.data || response.data;
  },

  // 2. User Management
  getUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data?.data || response.data;
  },

  getUserDetails: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data?.data || response.data;
  },

  updateUserStatus: async (userId, { status, reason }) => {
    const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
    return response.data?.data || response.data;
  },

  updateUserRole: async (userId, { role }) => {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response.data?.data || response.data;
  },

  // 3. Meeting Management
  getMeetings: async (params = {}) => {
    const response = await api.get('/admin/meetings', { params });
    return response.data?.data || response.data;
  },

  getMeetingDetails: async (meetingId) => {
    const response = await api.get(`/admin/meetings/${meetingId}`);
    return response.data?.data || response.data;
  },

  reportMeeting: async (meetingId, { reason, description }) => {
    const response = await api.post(`/admin/meetings/${meetingId}/report`, { reason, description });
    return response.data?.data || response.data;
  },

  resolveReport: async (meetingId, reportId, { status, resolutionNotes }) => {
    const response = await api.put(`/admin/meetings/${meetingId}/reports/${reportId}`, {
      status,
      resolutionNotes
    });
    return response.data?.data || response.data;
  },

  terminateMeeting: async (meetingId, { reason }) => {
    const response = await api.post(`/admin/meetings/${meetingId}/terminate`, { reason });
    return response.data?.data || response.data;
  },

  // 4. Analytics
  getAnalytics: async (days = 7) => {
    const response = await api.get('/admin/analytics', { params: { days } });
    return response.data?.data || response.data;
  },

  // 5. System Management
  getSystemMetrics: async () => {
    const response = await api.get('/admin/system/metrics');
    return response.data?.data || response.data;
  },

  // 6. Audit Logs
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data?.data || response.data;
  }
};

