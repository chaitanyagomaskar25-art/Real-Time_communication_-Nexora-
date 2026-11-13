const mongoose = require('mongoose');
const Message = require('../models/Message');
const Meeting = require('../models/Meeting');
const Room = require('../models/Room');
const logger = require('../utils/logger');

// In-memory fallback map: roomId -> Array<MessageObject>
const inMemoryMessages = new Map();
// Tracking sets to prevent cleared chat histories from re-seeding
const clearedRoomsSet = new Set();
const seededRoomsSet = new Set();

class ChatService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Mark call messages associated with a room as ended in MongoDB
  async markCallAsEnded(callRoomId) {
    if (!callRoomId) return;
    const clean = callRoomId.toLowerCase().trim();
    if (this.isDbConnected()) {
      try {
        await Message.updateMany(
          { content: { $regex: `/room/${clean}`, $options: 'i' } },
          { $set: { isCallEnded: true } }
        );
      } catch (err) {
        logger.warn(`Failed to mark call messages as ended for ${clean}: ${err.message}`);
      }
    }
  }

  // 1. Create and persist user message (Group or Private)
  async createMessage({
    roomId,
    senderId,
    senderName,
    senderAvatar = '',
    content = '',
    file = null,
    isPrivate = false,
    recipientId = null,
    recipientName = null,
    replyTo = null,
    clientTempId = null,
    messageType = 'user'
  }) {
    const formattedFile = file && (file.url || file.fileUrl || file.name) ? {
      name: file.name || file.fileName || file.originalName || 'Attachment',
      size: file.size || 0,
      type: file.type || file.mimeType || 'application/octet-stream',
      url: file.url || file.fileUrl || null,
      publicId: file.publicId || file.storagePath || null,
      storageProvider: file.storageProvider || 'local'
    } : null;

    const messageDoc = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      clientTempId: clientTempId || null,
      roomId,
      senderId: senderId || '',
      senderName: senderName || 'Anonymous',
      senderAvatar: senderAvatar || '',
      content: (content || '').trim(),
      file: formattedFile,
      isPrivate: Boolean(isPrivate),
      recipientId: isPrivate ? recipientId : null,
      recipientName: isPrivate ? recipientName : null,
      replyTo: replyTo && replyTo.content ? {
        messageId: replyTo.messageId || null,
        senderName: replyTo.senderName || 'Participant',
        content: replyTo.content.substring(0, 120)
      } : null,
      reactions: [],
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      messageType: messageType || 'user',
      status: 'delivered',
      timestamp: new Date()
    };

    if (this.isDbConnected()) {
      try {
        const saved = await Message.create(messageDoc);
        if (clearedRoomsSet.has(roomId)) {
          clearedRoomsSet.delete(roomId);
        }
        await Room.updateOne({ roomId }, { $set: { isCleared: false } }).catch(() => {});
        const obj = saved.toObject();
        obj.id = saved._id.toString();
        obj._id = saved._id.toString();
        obj.clientTempId = saved.clientTempId || clientTempId;
        return obj;
      } catch (err) {
        logger.warn(`ChatService MongoDB save error, using fallback: ${err.message}`);
      }
    }

    if (!inMemoryMessages.has(roomId)) {
      inMemoryMessages.set(roomId, []);
    }
    const memDoc = {
      ...messageDoc,
      _id: messageDoc.id
    };
    inMemoryMessages.get(roomId).push(memDoc);
    return memDoc;
  }

  // 2. Create System Message (e.g. User joined / left)
  async createSystemMessage({ roomId, content }) {
    const sysDoc = {
      id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      roomId,
      senderId: 'system',
      senderName: 'System',
      senderAvatar: '',
      content,
      isPrivate: false,
      recipientId: null,
      recipientName: null,
      replyTo: null,
      reactions: [],
      isEdited: false,
      isDeleted: false,
      messageType: 'system',
      status: 'delivered',
      timestamp: new Date()
    };

    if (this.isDbConnected()) {
      try {
        const saved = await Message.create(sysDoc);
        const obj = saved.toObject();
        obj.id = saved._id.toString();
        return obj;
      } catch (err) {
        // Fallback
      }
    }

    if (!inMemoryMessages.has(roomId)) {
      inMemoryMessages.set(roomId, []);
    }
    inMemoryMessages.get(roomId).push(sysDoc);
    return sysDoc;
  }

  // Seed initial realistic group chat history if room has no messages
  async seedDefaultGroupMessages(roomId) {
    const cleanRoom = (roomId || '').toLowerCase().trim();
    if (cleanRoom !== 'group-general' && cleanRoom !== 'group-engineering') return;

    // NEVER re-seed if room was cleared by user or already seeded during this session
    if (clearedRoomsSet.has(cleanRoom) || seededRoomsSet.has(cleanRoom)) return;

    if (this.isDbConnected()) {
      try {
        const roomDoc = await Room.findOne({ roomId: cleanRoom });
        if (roomDoc && roomDoc.isCleared) {
          clearedRoomsSet.add(cleanRoom);
          return;
        }
      } catch {}
    }

    let totalExisting = 0;
    if (this.isDbConnected()) {
      try {
        totalExisting = await Message.countDocuments({ roomId: cleanRoom });
      } catch {
        totalExisting = 0;
      }
    } else {
      totalExisting = (inMemoryMessages.get(cleanRoom) || []).length;
    }

    if (totalExisting > 0) {
      seededRoomsSet.add(cleanRoom);
      return;
    }

    // Mark as seeded so clearing messages never re-triggers seeding
    seededRoomsSet.add(cleanRoom);

    const baseTime = Date.now();
    const generalTexts = [
      'Welcome everyone to the General Workspace channel!',
      'Please review the updated team sprint roadmap in the files tab.',
      'Has anyone verified the latest release candidate build?',
      'The design system tokens were updated in Figma.',
      'Reminder: all hands standup tomorrow at 10 AM.',
      'Great job on hitting the milestone early this sprint!',
      'Don\'t forget to submit your weekly status reports before EOD.',
      'Testing the conference room audio pipeline with high-fidelity Opus.',
      'Screen sharing latency looks ultra smooth on 1080p 60fps.',
      'Let\'s ensure all pending pull requests are reviewed before 4 PM.',
      'Shared the quarterly planning docs in the shared repository.',
      'Checking if the notification badges sync correctly across tabs.',
      'Looks good on both desktop and mobile viewports.',
      'Thanks for the feedback on the dark mode contrast theme!',
      'We are testing the low-latency WebSocket signaling mesh.',
      'Audio quality on the new noise cancellation filter is crystal clear.',
      'The new dashboard activity cards are looking sharp.',
      'Let\'s schedule a quick sync after lunch to align on testing.',
      'Can someone confirm if the instant room invite links work?',
      'Confirmed, joined the instant room seamlessly without any delay.',
      'MongoDB message indexing is fully active for high-speed queries.',
      'Paginated message scrolling is working well with infinite scroll.',
      'General announcements and updates will be posted here regularly.',
      'Signaling server connected & ready for conference calls.',
      'Workspace collaboration is active and ready for the team!'
    ];

    const engineeringTexts = [
      'WebRTC Architecture sync channel initiated.',
      'ICE candidates gathering state: complete.',
      'STUN/TURN fallback server verified on port 3478.',
      'Benchmarking full mesh topology vs selective forwarding unit.',
      'Mesh is ideal for up to 6 peers with minimal signaling overhead.',
      'RTCPeerConnection onicecandidate handler registered with trickle ICE.',
      'Evaluating VP8 and VP9 hardware acceleration across modern browsers.',
      'Packet loss recovery with NACK and PLI working reliably.',
      'DataChannel binary throughput tested at 64KB chunks per frame.',
      'Socket.IO signaling latency is under 15ms on local cluster.',
      'Echo cancellation and noise suppression enabled on getUserMedia.',
      'Camera resolution constraints set to ideal 1080p with fallback to 720p.',
      'Testing renegotiation flow during screen share toggle.',
      'Added offer/answer collision handling using polite peer pattern.',
      'Audio track bitrate locked to 48kbps Opus stereo stream.',
      'WebRTC getStats() API wired for real-time telemetry.',
      'Jitter buffer delay is steady around 20ms across peers.',
      'ICE restart implemented when network connectivity switches.',
      'Secure DTLS-SRTP handshake validated for peer encryption.',
      'Simulcast layers: 720p high, 360p medium, 180p low.',
      'Bandwidth estimation algorithm dynamically adapts sending bitrate.',
      'P2P mesh video bitrate verified at 1080p 60fps.',
      'Testing MongoDB persistence with cursor pagination.',
      'Earlier message stream chunking verified for smooth scrolling.',
      'All WebRTC signaling channels operational and benchmarked.'
    ];

    const texts = cleanRoom === 'group-general' ? generalTexts : engineeringTexts;
    const authorNames = cleanRoom === 'group-general'
      ? ['Alex Morgan', 'Sarah Chen', 'Jordan Lee', 'David Kim', 'Elena Rostova']
      : ['Marcus Vance', 'Priya Sharma', 'David Kim', 'Liam O\'Connor', 'NEXORA Bot'];

    const seedDocs = texts.map((txt, index) => {
      const minutesAgo = (texts.length - 1 - index) * 45 + 5;
      const timestamp = new Date(baseTime - minutesAgo * 60 * 1000);
      const sender = authorNames[index % authorNames.length];
      return {
        id: `seed_${cleanRoom}_${index}_${timestamp.getTime()}`,
        roomId: cleanRoom,
        senderId: `user_seed_${(index % authorNames.length) + 1}`,
        senderName: sender,
        senderAvatar: '',
        content: txt,
        isPrivate: false,
        recipientId: null,
        recipientName: null,
        replyTo: null,
        reactions: [],
        isEdited: false,
        isDeleted: false,
        messageType: 'user',
        status: 'delivered',
        timestamp
      };
    });

    if (this.isDbConnected()) {
      try {
        await Message.insertMany(seedDocs);
      } catch (err) {
        logger.warn(`Failed to seed MongoDB group messages: ${err.message}`);
      }
    }

    inMemoryMessages.set(cleanRoom, seedDocs);
  }

  // 3. Get Meeting Messages with Pagination & Privacy Filtering
  async getMeetingMessages(roomId, { page = 1, limit = 30, before = null, userId = null }) {
    await this.seedDefaultGroupMessages(roomId);

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(5, parseInt(limit, 10) || 30));
    const skip = before ? 0 : (parsedPage - 1) * parsedLimit;

    // Filter condition: public messages OR private messages where user is sender or recipient
    const privacyFilter = {
      roomId,
      $or: [
        { isPrivate: false },
        { isPrivate: true, senderId: userId },
        { isPrivate: true, recipientId: userId }
      ]
    };

    if (before) {
      privacyFilter.timestamp = { $lt: new Date(before) };
    }

    if (this.isDbConnected()) {
      try {
        const total = await Message.countDocuments(privacyFilter);
        const messages = await Message.find(privacyFilter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parsedLimit);

        // Reverse to return in chronological order
        const chronological = messages.reverse().map((m) => {
          const obj = m.toObject();
          obj.id = m._id.toString();
          return obj;
        });

        // Check if any call room in messages has ended
        for (const msg of chronological) {
          if (msg.content && msg.content.includes('/room/')) {
            const match = msg.content.match(/\/room\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              const cId = match[1].toLowerCase().trim();
              try {
                const meeting = await Meeting.findOne({
                  $or: [{ meetingId: cId }, { meetingId: cId.replace(/-/g, '') }]
                });
                if (meeting && (meeting.status === 'ended' || meeting.status === 'cancelled')) {
                  msg.isCallEnded = true;
                }
              } catch {}
            }
          }
        }

        const hasMore = before ? (total > parsedLimit) : (total > skip + parsedLimit);
        const totalPages = Math.ceil(total / parsedLimit);

        return {
          messages: chronological,
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages,
          hasMore,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages,
            hasMore
          }
        };
      } catch (err) {
        logger.warn(`ChatService getMeetingMessages MongoDB error: ${err.message}`);
      }
    }

    // In-memory fallback pagination
    const all = inMemoryMessages.get(roomId) || [];
    const filtered = all.filter((m) => {
      if (before && new Date(m.timestamp || m.createdAt) >= new Date(before)) return false;
      if (!m.isPrivate) return true;
      if (!userId) return false;
      return m.senderId === userId || m.recipientId === userId;
    });

    const total = filtered.length;
    const paginated = before
      ? filtered.slice(Math.max(0, filtered.length - parsedLimit))
      : filtered.slice(Math.max(0, filtered.length - parsedPage * parsedLimit), filtered.length - (parsedPage - 1) * parsedLimit);
    const hasMore = before ? (total > parsedLimit) : (total > parsedPage * parsedLimit);
    const totalPages = Math.ceil(total / parsedLimit);

    return {
      messages: paginated,
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasMore,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
        hasMore
      }
    };
  }

  // 4. Edit Own Message
  async editMessage({ messageId, roomId, newContent, userId }) {
    if (!newContent || newContent.trim().length === 0) {
      throw new Error('Message content cannot be empty.');
    }

    if (this.isDbConnected()) {
      try {
        const query = mongoose.Types.ObjectId.isValid(messageId)
          ? { _id: messageId, roomId }
          : { id: messageId, roomId };

        const msg = await Message.findOne(query);
        if (msg) {
          if (userId && msg.senderId && msg.senderId !== userId) {
            throw new Error('Unauthorized to edit this message.');
          }
          if (msg.isDeleted) {
            throw new Error('Cannot edit a deleted message.');
          }

          msg.content = newContent.trim();
          msg.isEdited = true;
          await msg.save();

          const obj = msg.toObject();
          obj.id = msg._id.toString();
          return obj;
        }
      } catch (err) {
        if (err.message.includes('Unauthorized') || err.message.includes('deleted')) throw err;
      }
    }

    const roomMsgs = inMemoryMessages.get(roomId) || [];
    const msg = roomMsgs.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');

    if (userId && msg.senderId && msg.senderId !== userId) {
      throw new Error('Unauthorized to edit this message.');
    }
    if (msg.isDeleted) {
      throw new Error('Cannot edit a deleted message.');
    }

    msg.content = newContent.trim();
    msg.isEdited = true;
    return msg;
  }

  // 5. Delete Own Message (or Host Override)
  async deleteMessage({ messageId, alternateId = null, roomId, userId, isHost }) {
    const cleanRoom = (roomId || '').toLowerCase().trim();
    const idsToTry = [messageId, alternateId].filter(Boolean);

    if (this.isDbConnected()) {
      try {
        for (const targetId of idsToTry) {
          const isObjId = mongoose.Types.ObjectId.isValid(targetId);
          const filter = {
            $or: [
              ...(isObjId ? [{ _id: targetId }] : []),
              { id: targetId },
              { clientTempId: targetId }
            ]
          };
          if (cleanRoom) {
            filter.roomId = cleanRoom;
          }

          const msg = await Message.findOne(filter);
          if (msg) {
            if (!isHost && userId && msg.senderId && String(msg.senderId) !== String(userId)) {
              throw new Error('Unauthorized to delete this message.');
            }

            await Message.deleteOne({ _id: msg._id });
            return { id: targetId, roomId: cleanRoom, success: true };
          }
        }
      } catch (err) {
        if (err.message.includes('Unauthorized')) throw err;
        logger.warn(`ChatService deleteMessage MongoDB error: ${err.message}`);
      }
    }

    const roomMsgs = inMemoryMessages.get(cleanRoom) || [];
    const index = roomMsgs.findIndex((m) =>
      idsToTry.some((targetId) => m.id === targetId || m._id === targetId || m.clientTempId === targetId)
    );
    if (index !== -1) {
      const msg = roomMsgs[index];
      if (!isHost && userId && msg.senderId && String(msg.senderId) !== String(userId)) {
        throw new Error('Unauthorized to delete this message.');
      }
      roomMsgs.splice(index, 1);
      return { id: messageId, roomId: cleanRoom, success: true };
    }

    return { id: messageId, roomId: cleanRoom, success: true };
  }

  // 6. Toggle Emoji Reaction on a Message
  async toggleReaction({ messageId, roomId, emoji, user: { userId, userName } }) {
    if (!emoji || !userId) throw new Error('Emoji and user info required.');
    const cleanRoom = (roomId || '').toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const isObjId = mongoose.Types.ObjectId.isValid(messageId);
        const query = {
          $or: [
            ...(isObjId ? [{ _id: messageId }] : []),
            { id: messageId },
            { clientTempId: messageId }
          ]
        };
        if (cleanRoom) {
          query.roomId = cleanRoom;
        }

        const msg = await Message.findOne(query);
        if (msg) {
          if (!msg.reactions) msg.reactions = [];
          const reactions = msg.reactions;
          let targetReaction = reactions.find((r) => r.emoji === emoji);

          if (targetReaction) {
            const userIndex = (targetReaction.users || []).findIndex(
              (u) => String(typeof u === 'string' ? u : u.userId) === String(userId)
            );
            if (userIndex !== -1) {
              // Remove user's reaction (toggle off)
              targetReaction.users.splice(userIndex, 1);
              if (targetReaction.users.length === 0) {
                msg.reactions = reactions.filter((r) => r.emoji !== emoji);
              }
            } else {
              // Add user to existing emoji
              targetReaction.users.push({ userId, userName: userName || 'Participant' });
            }
          } else {
            // New emoji reaction
            msg.reactions.push({
              emoji,
              users: [{ userId, userName: userName || 'Participant' }]
            });
          }

          await msg.save();
          const mapped = msg.reactions.map((r) => ({
            emoji: r.emoji,
            count: (r.users || []).length,
            users: r.users || []
          }));
          return { messageId, roomId: cleanRoom, reactions: mapped };
        }
      } catch (err) {
        logger.warn(`ChatService toggleReaction MongoDB error: ${err.message}`);
      }
    }

    const roomMsgs = inMemoryMessages.get(cleanRoom) || [];
    const msg = roomMsgs.find(
      (m) => m.id === messageId || m._id === messageId || m.clientTempId === messageId
    );
    if (!msg) throw new Error('Message not found.');

    if (!msg.reactions) msg.reactions = [];
    let target = msg.reactions.find((r) => r.emoji === emoji);

    if (target) {
      if (!target.users) target.users = [];
      const uIndex = target.users.findIndex(
        (u) => String(typeof u === 'string' ? u : u.userId) === String(userId)
      );
      if (uIndex !== -1) {
        target.users.splice(uIndex, 1);
        if (target.users.length === 0) {
          msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        target.users.push({ userId, userName: userName || 'Participant' });
      }
    } else {
      msg.reactions.push({
        emoji,
        users: [{ userId, userName: userName || 'Participant' }]
      });
    }

    const mapped = msg.reactions.map((r) => ({
      emoji: r.emoji,
      count: (r.users || []).length,
      users: r.users || []
    }));

    return { messageId, roomId: cleanRoom, reactions: mapped };
  }

  // 6. Clear All Messages for a Room / Conversation
  async clearRoomMessages(roomId) {
    if (!roomId) return true;
    const cleanRoom = roomId.toLowerCase().trim();
    clearedRoomsSet.add(cleanRoom);
    seededRoomsSet.add(cleanRoom);

    if (this.isDbConnected()) {
      try {
        await Message.deleteMany({ roomId: cleanRoom });
        await Room.findOneAndUpdate(
          { roomId: cleanRoom },
          { $set: { isCleared: true, clearedAt: new Date() } },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.warn(`ChatService clearRoomMessages MongoDB error: ${err.message}`);
      }
    }
    inMemoryMessages.set(cleanRoom, []);
    return true;
  }

  // 7. Toggle Pin Status for a Message
  async togglePinMessage({ messageId, alternateId, roomId }) {
    if (!roomId || !messageId) throw new Error('Room and Message ID are required.');
    const cleanRoom = roomId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const idConditions = [];
        if (mongoose.Types.ObjectId.isValid(messageId)) {
          idConditions.push({ _id: messageId });
        }
        idConditions.push({ id: messageId });
        idConditions.push({ clientTempId: messageId });
        if (alternateId) {
          if (mongoose.Types.ObjectId.isValid(alternateId)) {
            idConditions.push({ _id: alternateId });
          }
          idConditions.push({ id: alternateId });
          idConditions.push({ clientTempId: alternateId });
        }

        const msg = await Message.findOne({
          roomId: cleanRoom,
          $or: idConditions
        });

        if (msg) {
          msg.isPinned = !msg.isPinned;
          await msg.save();
          return {
            messageId,
            alternateId,
            roomId: cleanRoom,
            isPinned: msg.isPinned
          };
        }
      } catch (err) {
        logger.warn(`ChatService togglePinMessage MongoDB error: ${err.message}`);
      }
    }

    const roomMsgs = inMemoryMessages.get(cleanRoom) || [];
    const msg = roomMsgs.find(
      (m) =>
        m.id === messageId ||
        m._id === messageId ||
        m.clientTempId === messageId ||
        (alternateId && (m.id === alternateId || m._id === alternateId || m.clientTempId === alternateId))
    );

    if (!msg) throw new Error('Message not found.');

    msg.isPinned = !msg.isPinned;
    return {
      messageId,
      alternateId,
      roomId: cleanRoom,
      isPinned: msg.isPinned
    };
  }
}

module.exports = new ChatService();
