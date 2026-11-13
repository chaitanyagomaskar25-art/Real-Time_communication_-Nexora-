import api from './api';

export const contactService = {
  // Get accepted contacts
  async getContacts() {
    const res = await api.get('/contacts');
    return res.data;
  },

  // Get pending connection requests (incoming and outgoing)
  async getRequests() {
    const res = await api.get('/contacts/requests');
    return res.data;
  },

  // Send a connection request
  async sendRequest(identifier) {
    const res = await api.post('/contacts/request', { identifier });
    return res.data;
  },

  // Respond to a connection request (accepted / rejected)
  async respondToRequest(requestId, status) {
    const res = await api.put(`/contacts/requests/${requestId}`, { status });
    return res.data;
  },

  // Delete a contact
  async deleteContact(contactId) {
    const res = await api.delete(`/contacts/${contactId}`);
    return res.data;
  },

  // Search registered users
  async searchUsers(query) {
    const res = await api.get('/users/search', { params: { q: query } });
    return res.data;
  },

  // Update current user's manual presence status
  async updatePresence(status) {
    const res = await api.put('/users/presence', { status });
    return res.data;
  }
};

