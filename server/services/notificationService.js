const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const presenceService = require('./presenceService');
const logger = require('../utils/logger');

// In-memory notifications fallback: notificationId -> notification object
const inMemoryNotifications = new Map();

class NotificationService {
  constructor() {
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Create & emit a real-time notification
  async createNotification({
    recipient,
    recipientId,
    sender = null,
    senderId = null,
    senderName = 'ConnectSphere',
    type,
    title,
    message,
    data = {}
  }) {
    const finalRecipient = recipient || recipientId;
    const finalSender = sender || senderId;
    if (!finalRecipient) return null;
    const recId = finalRecipient.toString();

    let notificationObj = null;

    if (this.isDbConnected()) {
      try {
        const notif = await Notification.create({
          recipient: recId,
          sender: finalSender ? finalSender.toString() : null,
          senderName,
          type,
          title,
          message,
          data,
          isRead: false
        });

        notificationObj = {
          id: notif._id.toString(),
          _id: notif._id.toString(),
          recipient: recId,
          sender: notif.sender,
          senderName: notif.senderName,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          data: notif.data,
          isRead: notif.isRead,
          createdAt: notif.createdAt
        };
      } catch (err) {
        logger.warn(`NotificationService DB create error: ${err.message}`);
      }
    }

    if (!notificationObj) {
      const mockId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      notificationObj = {
        id: mockId,
        _id: mockId,
        recipient: recId,
        sender: finalSender ? finalSender.toString() : null,
        senderName,
        type,
        title,
        message,
        data,
        isRead: false,
        createdAt: new Date()
      };
      inMemoryNotifications.set(mockId, notificationObj);
    }

    // Emit live via socket to recipient's connected clients
    if (this.io) {
      const socketIds = presenceService.getUserSockets(recId);
      socketIds.forEach((sid) => {
        this.io.to(sid).emit('notification-received', notificationObj);
      });
    }

    return notificationObj;
  }

  // Get user's notifications
  async getUserNotifications(userId) {
    if (!userId) return [];
    const uid = userId.toString();

    if (this.isDbConnected()) {
      try {
        // Auto-sync meeting invitations for this user if any exist in Meeting records
        const User = require('../models/User');
        const Meeting = require('../models/Meeting');
        const currentUser = await User.findById(uid).select('email fullName username');
        if (currentUser && currentUser.email) {
          const userEmail = currentUser.email.toLowerCase().trim();

          const invitedMeetings = await Meeting.find({
            'invitees.email': userEmail,
            status: { $ne: 'cancelled' }
          })
            .sort({ scheduledDate: -1, createdAt: -1 })
            .limit(20);

          for (const m of invitedMeetings) {
            const myInv = m.invitees?.find((i) => i.email === userEmail);
            const existingNotif = await Notification.findOne({
              recipient: uid,
              type: 'meeting-invite',
              'data.meetingId': m.meetingId
            });

            if (!existingNotif) {
              await this.createNotification({
                recipient: uid,
                sender: m.host ? m.host.toString() : null,
                senderName: m.hostName || 'Meeting Host',
                type: 'meeting-invite',
                title: 'Meeting Invitation',
                message: `${m.hostName || 'A host'} invited you to "${m.title || 'a meeting'}"`,
                data: {
                  meetingId: m.meetingId,
                  roomId: m.meetingId,
                  title: m.title,
                  scheduledDate: m.scheduledDate,
                  scheduledTime: m.scheduledTime,
                  startTime: m.startTime,
                  status: myInv?.status || 'pending',
                  inviteLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/room/${m.meetingId}`
                }
              });
            }
          }
        }

        const list = await Notification.find({ recipient: uid })
          .sort({ createdAt: -1 })
          .limit(50);

        return list.map((n) => ({
          id: n._id.toString(),
          _id: n._id.toString(),
          recipient: n.recipient.toString(),
          sender: n.sender ? n.sender.toString() : null,
          senderName: n.senderName,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          isRead: n.isRead,
          createdAt: n.createdAt
        }));
      } catch (err) {
        logger.warn(`getUserNotifications DB error: ${err.message}`);
      }
    }

    const results = [];
    for (const n of inMemoryNotifications.values()) {
      if (n.recipient === uid) {
        results.push(n);
      }
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Mark single notification read
  async markAsRead(notificationId, userId) {
    if (this.isDbConnected()) {
      try {
        const updated = await Notification.findOneAndUpdate(
          { _id: notificationId, recipient: userId },
          { isRead: true },
          { new: true }
        );
        if (updated) return true;
      } catch (err) {
        // Fallback
      }
    }

    if (inMemoryNotifications.has(notificationId)) {
      const notif = inMemoryNotifications.get(notificationId);
      if (notif.recipient === userId.toString()) {
        notif.isRead = true;
        return true;
      }
    }
    return false;
  }

  // Mark all user notifications read
  async markAllAsRead(userId) {
    const uid = userId.toString();
    if (this.isDbConnected()) {
      try {
        await Notification.updateMany({ recipient: uid, isRead: false }, { isRead: true });
      } catch (err) {
        // Fallback
      }
    }

    for (const n of inMemoryNotifications.values()) {
      if (n.recipient === uid) {
        n.isRead = true;
      }
    }
    return true;
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    if (this.isDbConnected()) {
      try {
        await Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
      } catch (err) {
        // Fallback
      }
    }

    inMemoryNotifications.delete(notificationId);
    return true;
  }

  // Initiate direct call notification to a contact
  async callContact(caller, recipientId, meetingId) {
    const callData = {
      meetingId,
      roomUrl: `/room/${meetingId}`,
      callerId: caller.id || caller._id,
      callerName: caller.fullName || caller.name || 'A Contact',
      callerEmail: caller.email,
      timestamp: Date.now()
    };

    // 1. Send live incoming-call socket event
    if (this.io) {
      const recipientSockets = presenceService.getUserSockets(recipientId);
      recipientSockets.forEach((sid) => {
        this.io.to(sid).emit('incoming-call', callData);
      });
    }

    // 2. Persist notification
    const notification = await this.createNotification({
      recipient: recipientId,
      sender: caller.id || caller._id,
      senderName: caller.fullName || caller.name,
      type: 'incoming-call',
      title: `Incoming Call from ${caller.fullName || caller.name}`,
      message: `${caller.fullName || caller.name} is calling you on ConnectSphere.`,
      data: callData
    });

    return { success: true, notification, callData };
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;

