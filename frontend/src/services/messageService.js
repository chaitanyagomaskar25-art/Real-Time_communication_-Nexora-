import api from './api';

export const messageService = {
  // Upload attachment file/image to Cloudinary (or local fallback)
  async uploadAttachment(file, conversationId = 'chat') {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/messages/${conversationId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data?.data || res.data || res;
  },

  // Get paginated messages for a conversation/group from MongoDB
  async getMessages(conversationId, params = {}) {
    const res = await api.get(`/messages/${conversationId}`, { params });
    return res.data || res;
  },

  // Save/send a message to MongoDB
  async sendMessage(conversationId, data) {
    const res = await api.post(`/messages/${conversationId}`, data);
    return res.data || res;
  },

  // Edit message in MongoDB
  async editMessage(conversationId, messageId, newContent) {
    const res = await api.put(`/messages/${conversationId}/${messageId}`, { newContent });
    return res.data || res;
  },

  // Delete message in MongoDB
  async deleteMessage(conversationId, messageId, params = {}) {
    const res = await api.delete(`/messages/${conversationId}/${messageId}`, { params });
    return res.data || res;
  },

  // Clear all messages in a conversation
  async clearMessages(conversationId) {
    const res = await api.delete(`/messages/${conversationId}/clear`);
    return res.data || res;
  },

  // Toggle pin status of a message
  async togglePinMessage(conversationId, messageId, alternateId = null) {
    const res = await api.put(`/messages/${conversationId}/${messageId}/pin`, { alternateId });
    return res.data || res;
  }
};

export default messageService;
