import api from './api';

export const recordingService = {
  // Start recording (Host only)
  startRecording: async (meetingId) => {
    const res = await api.post(`/recordings/${meetingId}/start`);
    return res.data;
  },

  // Stop recording (Host only)
  stopRecording: async (meetingId, data = {}) => {
    const res = await api.post(`/recordings/${meetingId}/stop`, data);
    return res.data;
  },

  // Upload recorded video blob (Host only)
  uploadRecording: async (meetingId, formData) => {
    const res = await api.post(`/recordings/${meetingId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  // Record participant consent
  recordConsent: async (recordingId, data) => {
    const res = await api.post(`/recordings/${recordingId}/consent`, data);
    return res.data;
  },

  // Get library of recordings accessible to user
  getRecordings: async (meetingId = null) => {
    const params = meetingId ? { meetingId } : {};
    const res = await api.get('/recordings', { params });
    // Support both res.data.recordings and array response
    return res.data?.recordings || (Array.isArray(res.data) ? res.data : []);
  },

  // Get single recording metadata
  getRecording: async (recordingId) => {
    const res = await api.get(`/recordings/${recordingId}`);
    return res.data;
  },

  // Delete recording (Host only)
  deleteRecording: async (recordingId) => {
    const res = await api.delete(`/recordings/${recordingId}`);
    return res.data;
  },

  // Update recording access settings
  updatePermissions: async (recordingId, accessSettings) => {
    const res = await api.put(`/recordings/${recordingId}/permissions`, accessSettings);
    return res.data;
  },

  getStreamUrl: (recordingId) => {
    const token = localStorage.getItem('connectsphere_token') || localStorage.getItem('token');
    const base = `/api/recordings/${recordingId}/stream`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
  getDownloadUrl: (recordingId) => {
    const token = localStorage.getItem('connectsphere_token') || localStorage.getItem('token');
    const base = `/api/recordings/${recordingId}/download`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }
};

export default recordingService;
