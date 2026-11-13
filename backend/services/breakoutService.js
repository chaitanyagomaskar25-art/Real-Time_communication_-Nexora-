// Breakout Rooms Service: Manages sub-rooms within live meeting sessions
// Map: meetingId -> {
//   rooms: Map<subRoomId, { id, name, participants: Set<socketId/userId> }>,
//   isActive: Boolean,
//   allowSwitching: Boolean,
//   createdAt: Date
// }

const meetingBreakouts = new Map();

class BreakoutService {
  constructor() {
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  // Get current breakout rooms for meeting
  getBreakouts(meetingId) {
    if (!meetingBreakouts.has(meetingId)) {
      return { isActive: false, rooms: [] };
    }

    const state = meetingBreakouts.get(meetingId);
    const roomsList = [];
    state.rooms.forEach((r) => {
      roomsList.push({
        id: r.id,
        name: r.name,
        participantCount: r.participants.size,
        participants: Array.from(r.participants)
      });
    });

    return {
      isActive: state.isActive,
      allowSwitching: state.allowSwitching,
      rooms: roomsList
    };
  }

  // Create breakout rooms
  createBreakouts(meetingId, { roomNames = [], allowSwitching = true, assignments = {} }) {
    if (!meetingId) throw new Error('Meeting ID is required.');

    const cleanNames = Array.isArray(roomNames) && roomNames.length > 0
      ? roomNames
      : ['Breakout Room 1', 'Breakout Room 2'];

    const roomsMap = new Map();
    cleanNames.forEach((name, idx) => {
      const subRoomId = `${meetingId}_bo_${idx + 1}`;
      roomsMap.set(subRoomId, {
        id: subRoomId,
        name,
        participants: new Set()
      });
    });

    // Apply any initial assignments { [socketId]: subRoomId }
    if (assignments && typeof assignments === 'object') {
      Object.entries(assignments).forEach(([targetId, subRoomId]) => {
        if (roomsMap.has(subRoomId)) {
          roomsMap.get(subRoomId).participants.add(targetId);
        }
      });
    }

    const state = {
      isActive: true,
      allowSwitching: Boolean(allowSwitching),
      rooms: roomsMap,
      createdAt: new Date()
    };

    meetingBreakouts.set(meetingId, state);
    return this.getBreakouts(meetingId);
  }

  // Join or switch breakout room
  joinBreakout(meetingId, subRoomId, participantId) {
    const state = meetingBreakouts.get(meetingId);
    if (!state || !state.isActive) {
      throw new Error('Breakout rooms are not currently active for this meeting.');
    }

    // Remove participant from all other sub-rooms in this meeting
    state.rooms.forEach((r) => {
      r.participants.delete(participantId);
    });

    // If subRoomId is null, user returned to main room
    if (subRoomId && state.rooms.has(subRoomId)) {
      state.rooms.get(subRoomId).participants.add(participantId);
    }

    return this.getBreakouts(meetingId);
  }

  // Close breakout rooms (Host action)
  closeBreakouts(meetingId) {
    if (meetingBreakouts.has(meetingId)) {
      meetingBreakouts.delete(meetingId);
    }
    return { isActive: false, rooms: [] };
  }
}

const breakoutService = new BreakoutService();
module.exports = breakoutService;

