import api from './api';

export const aiService = {
  // Get live / stored transcript
  getTranscript: async (meetingId) => {
    const res = await api.get(`/ai/${meetingId}/transcript`);
    return res.data.data;
  },

  // Append transcript segment
  appendSegment: async (meetingId, payload) => {
    const res = await api.post(`/ai/${meetingId}/transcript/segment`, payload);
    return res.data.data;
  },

  // Generate AI meeting summary & insights
  generateSummary: async (meetingId) => {
    const res = await api.post(`/ai/${meetingId}/summary`);
    return res.data.data;
  },

  // Retrieve meeting insights (Executive summary, key points, decisions, duration)
  getInsights: async (meetingId) => {
    const res = await api.get(`/ai/${meetingId}/insights`);
    return res.data.data;
  },

  // Retrieve action items
  getActionItems: async (meetingId) => {
    const res = await api.get(`/ai/${meetingId}/action-items`);
    return res.data.data?.actionItems || [];
  },

  // Create manual action item
  createActionItem: async (meetingId, payload) => {
    const res = await api.post(`/ai/${meetingId}/action-items`, payload);
    return res.data.data;
  },

  // Update action item (status, assignee, title, dueDate)
  updateActionItem: async (meetingId, taskId, updates) => {
    const res = await api.put(`/ai/${meetingId}/action-items/${taskId}`, updates);
    return res.data.data;
  },

  // Delete action item
  deleteActionItem: async (meetingId, taskId) => {
    const res = await api.delete(`/ai/${meetingId}/action-items/${taskId}`);
    return res.data.data;
  },

  // Smart search across transcripts and meeting notes
  smartSearch: async (query, meetingId = null) => {
    const params = { q: query };
    if (meetingId) params.meetingId = meetingId;
    const res = await api.get('/ai/search', { params });
    return res.data.data;
  }
};

