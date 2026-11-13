import api from './api';

export const roomService = {
  async createRoom(title, isLocked = false) {
    const res = await api.post('/rooms/create', { title, isLocked });
    return res.data;
  },

  async getRoom(roomId) {
    const res = await api.get(`/rooms/${roomId}`);
    return res.data;
  },

  async getRoomMessages(roomId) {
    const res = await api.get(`/rooms/${roomId}/messages`);
    return res.data;
  }
};

