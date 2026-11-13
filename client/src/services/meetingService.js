import api from './api';

export const meetingService = {
  // Create instant meeting
  async createInstantMeeting(data = {}) {
    const res = await api.post('/meetings/instant', data);
    return res.data;
  },

  // Schedule future meeting
  async scheduleMeeting(data) {
    const res = await api.post('/meetings/schedule', data);
    return res.data;
  },

  // Edit/update scheduled meeting (Host only)
  async updateScheduledMeeting(meetingId, data) {
    const res = await api.put(`/meetings/${meetingId}`, data);
    return res.data;
  },

  // Get meetings in calendar format with date window
  async getCalendarMeetings(params = {}) {
    const res = await api.get('/meetings/calendar', { params });
    return res.data;
  },

  // Get user invitations
  async getUserInvitations() {
    const res = await api.get('/meetings/invitations');
    return res.data;
  },

  // RSVP to meeting invitation (accept / decline)
  async rsvpInvitation(meetingId, status) {
    const res = await api.put(`/meetings/${meetingId}/invitations/rsvp`, { status });
    return res.data;
  },

  // Invite participant to meeting by email
  async inviteToMeeting(meetingId, { email, name = '' }) {
    const res = await api.post(`/meetings/${meetingId}/invite`, { email, name });
    return res.data;
  },

  // Get upcoming meeting reminders
  async getUpcomingReminders() {
    const res = await api.get('/meetings/reminders');
    return res.data;
  },

  // Validate meeting access credentials (password, lock, waiting room)
  async validateMeetingAccess(meetingId, password = '') {
    const res = await api.post('/meetings/validate-access', {
      meetingId,
      password
    });
    return res.data;
  },

  // Get meeting details by ID
  async getMeetingDetails(meetingId) {
    const res = await api.get(`/meetings/${meetingId}`);
    return res.data;
  },

  // Get user's upcoming scheduled meetings
  async getUpcomingMeetings() {
    const res = await api.get('/meetings/upcoming');
    return res.data;
  },

  // Get user's meeting history
  async getMeetingHistory() {
    const res = await api.get('/meetings/history');
    return res.data;
  },

  // Update meeting settings (Host only)
  async updateMeetingSettings(meetingId, settings) {
    const res = await api.put(`/meetings/${meetingId}/settings`, { settings });
    return res.data;
  },

  // End meeting for everyone (Host only)
  async endMeeting(meetingId) {
    const res = await api.put(`/meetings/${meetingId}/end`);
    return res.data;
  },

  // Cancel scheduled meeting (Host only)
  async cancelMeeting(meetingId) {
    const res = await api.delete(`/meetings/${meetingId}`);
    return res.data;
  },

  // Get paginated meeting messages
  async getMeetingMessages(meetingId, params = {}) {
    const res = await api.get(`/meetings/${meetingId}/messages`, { params });
    return res.data;
  },

  // Upload files to meeting room with upload progress tracking
  async uploadMeetingFiles(meetingId, formData, onUploadProgress) {
    const res = await api.post(`/meetings/${meetingId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
    return res.data;
  },

  // Get shared files history for a meeting
  async getMeetingFiles(meetingId) {
    const res = await api.get(`/meetings/${meetingId}/files`);
    return res.data;
  },

  // Delete shared meeting file
  async deleteMeetingFile(meetingId, fileId) {
    const res = await api.delete(`/meetings/${meetingId}/files/${fileId}`);
    return res.data;
  },

  // Get meeting whiteboard state
  async getMeetingWhiteboard(meetingId) {
    const res = await api.get(`/meetings/${meetingId}/whiteboard`);
    return res.data;
  },

  // Save whiteboard snapshot
  async saveWhiteboardSnapshot(meetingId, snapshot) {
    const res = await api.put(`/meetings/${meetingId}/whiteboard/snapshot`, { snapshot });
    return res.data;
  },

  // Shared Meeting Notes
  async getMeetingNotes(meetingId) {
    const res = await api.get(`/meetings/${meetingId}/notes`);
    return res.data;
  },

  async saveMeetingNotes(meetingId, content) {
    const res = await api.put(`/meetings/${meetingId}/notes`, { content });
    return res.data;
  },

  // Meeting Polls
  async getMeetingPolls(meetingId) {
    const res = await api.get(`/meetings/${meetingId}/polls`);
    return res.data;
  },

  async createMeetingPoll(meetingId, pollData) {
    const res = await api.post(`/meetings/${meetingId}/polls`, pollData);
    return res.data;
  },

  async voteMeetingPoll(meetingId, pollId, optionId, voterId = null) {
    const res = await api.post(`/meetings/${meetingId}/polls/${pollId}/vote`, { optionId, voterId });
    return res.data;
  },

  async endMeetingPoll(meetingId, pollId) {
    const res = await api.put(`/meetings/${meetingId}/polls/${pollId}/end`);
    return res.data;
  },

  // Breakout Rooms
  async getBreakoutRooms(meetingId) {
    const res = await api.get(`/meetings/${meetingId}/breakout`);
    return res.data;
  },

  async createBreakoutRooms(meetingId, data) {
    const res = await api.post(`/meetings/${meetingId}/breakout`, data);
    return res.data;
  },

  async closeBreakoutRooms(meetingId) {
    const res = await api.post(`/meetings/${meetingId}/breakout/close`);
    return res.data;
  }
};
