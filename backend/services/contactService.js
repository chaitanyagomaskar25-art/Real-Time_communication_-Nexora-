const mongoose = require('mongoose');
const User = require('../models/User');
const Contact = require('../models/Contact');
const presenceService = require('./presenceService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

// In-memory fallback: contactId -> contact object
const inMemoryContacts = new Map();

class ContactService {
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Search registered users
  async searchUsers(queryStr, currentUserId) {
    if (!queryStr || typeof queryStr !== 'string') return [];
    const q = queryStr.trim();
    if (!q) return [];

    const regex = new RegExp(q, 'i');
    const currId = currentUserId ? currentUserId.toString() : null;

    if (this.isDbConnected()) {
      try {
        const users = await User.find({
          _id: { $ne: currId },
          $or: [{ fullName: regex }, { username: regex }, { email: regex }]
        })
          .limit(20)
          .select('-password');

        return users.map((u) => {
          const safe = u.toSafeObject();
          return {
            ...safe,
            isOnline: presenceService.isUserOnline(safe.id),
            presenceStatus: presenceService.getUserStatus(safe.id)
          };
        });
      } catch (err) {
        logger.warn(`searchUsers DB error: ${err.message}`);
      }
    }

    // In-memory fallback
    const { inMemoryUsers } = require('./authService');
    const results = [];
    for (const u of inMemoryUsers.values()) {
      if (u.id !== currId) {
        if (
          regex.test(u.fullName || '') ||
          regex.test(u.username || '') ||
          regex.test(u.email || '')
        ) {
          const safe = typeof u.toSafeObject === 'function' ? u.toSafeObject() : u;
          results.push({
            ...safe,
            isOnline: presenceService.isUserOnline(safe.id),
            presenceStatus: presenceService.getUserStatus(safe.id)
          });
        }
      }
    }
    return results;
  }

  // Get user's accepted contacts with presence data
  async getContacts(userId) {
    if (!userId) return [];
    const uid = userId.toString();
    const contactsList = [];

    if (this.isDbConnected()) {
      try {
        const contacts = await Contact.find({
          $or: [{ requester: uid }, { recipient: uid }],
          status: 'accepted'
        })
          .populate('requester', '-password')
          .populate('recipient', '-password')
          .sort({ updatedAt: -1 });

        for (const c of contacts) {
          const isReq = c.requester._id.toString() === uid;
          const contactUser = isReq ? c.recipient : c.requester;
          if (contactUser) {
            const safe = contactUser.toSafeObject ? contactUser.toSafeObject() : contactUser;
            contactsList.push({
              contactId: c._id.toString(),
              user: {
                ...safe,
                isOnline: presenceService.isUserOnline(safe.id),
                presenceStatus: presenceService.getUserStatus(safe.id)
              },
              connectedSince: c.updatedAt
            });
          }
        }
        return contactsList;
      } catch (err) {
        logger.warn(`getContacts DB error: ${err.message}`);
      }
    }

    // In-memory fallback
    const { inMemoryUsers } = require('./authService');
    for (const c of inMemoryContacts.values()) {
      if (c.status === 'accepted' && (c.requester === uid || c.recipient === uid)) {
        const targetId = c.requester === uid ? c.recipient : c.requester;
        const u = inMemoryUsers.get(targetId);
        if (u) {
          const safe = typeof u.toSafeObject === 'function' ? u.toSafeObject() : u;
          contactsList.push({
            contactId: c.id,
            user: {
              ...safe,
              isOnline: presenceService.isUserOnline(safe.id),
              presenceStatus: presenceService.getUserStatus(safe.id)
            },
            connectedSince: c.updatedAt || c.createdAt
          });
        }
      }
    }
    return contactsList;
  }

  // Get user's pending incoming and outgoing requests
  async getRequests(userId) {
    if (!userId) return { incoming: [], outgoing: [] };
    const uid = userId.toString();

    if (this.isDbConnected()) {
      try {
        const incoming = await Contact.find({ recipient: uid, status: 'pending' })
          .populate('requester', '-password')
          .sort({ createdAt: -1 });

        const outgoing = await Contact.find({ requester: uid, status: 'pending' })
          .populate('recipient', '-password')
          .sort({ createdAt: -1 });

        return {
          incoming: incoming.map((c) => ({
            requestId: c._id.toString(),
            user: c.requester.toSafeObject ? c.requester.toSafeObject() : c.requester,
            createdAt: c.createdAt
          })),
          outgoing: outgoing.map((c) => ({
            requestId: c._id.toString(),
            user: c.recipient.toSafeObject ? c.recipient.toSafeObject() : c.recipient,
            createdAt: c.createdAt
          }))
        };
      } catch (err) {
        logger.warn(`getRequests DB error: ${err.message}`);
      }
    }

    // In-memory fallback
    const { inMemoryUsers } = require('./authService');
    const incoming = [];
    const outgoing = [];

    for (const c of inMemoryContacts.values()) {
      if (c.status === 'pending') {
        if (c.recipient === uid) {
          const u = inMemoryUsers.get(c.requester);
          if (u) {
            incoming.push({
              requestId: c.id,
              user: typeof u.toSafeObject === 'function' ? u.toSafeObject() : u,
              createdAt: c.createdAt
            });
          }
        } else if (c.requester === uid) {
          const u = inMemoryUsers.get(c.recipient);
          if (u) {
            outgoing.push({
              requestId: c.id,
              user: typeof u.toSafeObject === 'function' ? u.toSafeObject() : u,
              createdAt: c.createdAt
            });
          }
        }
      }
    }

    return { incoming, outgoing };
  }

  // Send a contact request
  async sendRequest(requesterUser, recipientIdentifier) {
    const reqId = requesterUser.id || requesterUser._id;
    const cleanId = String(recipientIdentifier).trim().toLowerCase();

    let targetUser = null;

    if (this.isDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(cleanId)) {
          targetUser = await User.findById(cleanId);
        }
        if (!targetUser) {
          targetUser = await User.findOne({
            $or: [{ email: cleanId }, { username: cleanId }]
          });
        }
      } catch (err) {
        // Fallback
      }
    }

    if (!targetUser) {
      const { inMemoryUsers } = require('./authService');
      for (const u of inMemoryUsers.values()) {
        if (u.id === cleanId || u.email === cleanId || u.username === cleanId) {
          targetUser = u;
          break;
        }
      }
    }

    if (!targetUser) {
      throw new Error('User not found.');
    }

    const recipientId = (targetUser._id || targetUser.id).toString();

    if (recipientId === reqId.toString()) {
      throw new Error('You cannot send a contact request to yourself.');
    }

    // Check existing relationship
    if (this.isDbConnected()) {
      try {
        const existing = await Contact.findOne({
          $or: [
            { requester: reqId, recipient: recipientId },
            { requester: recipientId, recipient: reqId }
          ]
        });

        if (existing) {
          if (existing.status === 'accepted') throw new Error('Already connected with this user.');
          if (existing.status === 'pending') throw new Error('A connection request is already pending.');
          // If rejected, allow re-request
          existing.requester = reqId;
          existing.recipient = recipientId;
          existing.status = 'pending';
          await existing.save();

          // Send notification
          await notificationService.createNotification({
            recipient: recipientId,
            sender: reqId,
            senderName: requesterUser.fullName || requesterUser.name,
            type: 'contact-request',
            title: 'New Contact Request',
            message: `${requesterUser.fullName || requesterUser.name} sent you a connection request.`,
            data: { requestId: existing._id.toString() }
          });

          return { success: true, contact: existing };
        }

        const newContact = await Contact.create({
          requester: reqId,
          recipient: recipientId,
          status: 'pending'
        });

        await notificationService.createNotification({
          recipient: recipientId,
          sender: reqId,
          senderName: requesterUser.fullName || requesterUser.name,
          type: 'contact-request',
          title: 'New Contact Request',
          message: `${requesterUser.fullName || requesterUser.name} sent you a connection request.`,
          data: { requestId: newContact._id.toString() }
        });

        return { success: true, contact: newContact };
      } catch (err) {
        if (err.message.includes('Already') || err.message.includes('pending')) throw err;
      }
    }

    // In-memory fallback
    for (const c of inMemoryContacts.values()) {
      if (
        (c.requester === reqId.toString() && c.recipient === recipientId) ||
        (c.requester === recipientId && c.recipient === reqId.toString())
      ) {
        if (c.status === 'accepted') throw new Error('Already connected with this user.');
        if (c.status === 'pending') throw new Error('A connection request is already pending.');
        c.status = 'pending';
        c.requester = reqId.toString();
        c.recipient = recipientId;
        return { success: true, contact: c };
      }
    }

    const mockId = 'cnt_' + Date.now();
    const memContact = {
      id: mockId,
      _id: mockId,
      requester: reqId.toString(),
      recipient: recipientId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryContacts.set(mockId, memContact);

    await notificationService.createNotification({
      recipient: recipientId,
      sender: reqId,
      senderName: requesterUser.fullName || requesterUser.name,
      type: 'contact-request',
      title: 'New Contact Request',
      message: `${requesterUser.fullName || requesterUser.name} sent you a connection request.`,
      data: { requestId: mockId }
    });

    return { success: true, contact: memContact };
  }

  // Accept or reject a connection request
  async respondToRequest(requestId, recipientUser, status) {
    const recId = recipientUser.id || recipientUser._id;
    const cleanStatus = status === 'accepted' ? 'accepted' : 'rejected';

    if (this.isDbConnected()) {
      try {
        const contact = await Contact.findOne({
          _id: requestId,
          recipient: recId,
          status: 'pending'
        });

        if (!contact) {
          throw new Error('Connection request not found or already processed.');
        }

        contact.status = cleanStatus;
        await contact.save();

        if (cleanStatus === 'accepted') {
          await notificationService.createNotification({
            recipient: contact.requester,
            sender: recId,
            senderName: recipientUser.fullName || recipientUser.name,
            type: 'contact-request',
            title: 'Connection Accepted',
            message: `${recipientUser.fullName || recipientUser.name} accepted your connection request.`,
            data: { contactId: contact._id.toString() }
          });
        }

        return { success: true, status: cleanStatus };
      } catch (err) {
        if (err.message.includes('not found')) throw err;
      }
    }

    // In-memory fallback
    const memContact = inMemoryContacts.get(requestId);
    if (!memContact || memContact.recipient !== recId.toString() || memContact.status !== 'pending') {
      throw new Error('Connection request not found or already processed.');
    }

    memContact.status = cleanStatus;
    memContact.updatedAt = new Date();

    if (cleanStatus === 'accepted') {
      await notificationService.createNotification({
        recipient: memContact.requester,
        sender: recId,
        senderName: recipientUser.fullName || recipientUser.name,
        type: 'contact-request',
        title: 'Connection Accepted',
        message: `${recipientUser.fullName || recipientUser.name} accepted your connection request.`,
        data: { contactId: memContact.id }
      });
    }

    return { success: true, status: cleanStatus };
  }

  // Delete an existing contact
  async deleteContact(contactId, userId) {
    const uid = userId.toString();

    if (this.isDbConnected()) {
      try {
        await Contact.findOneAndDelete({
          _id: contactId,
          $or: [{ requester: uid }, { recipient: uid }]
        });
        return { success: true };
      } catch (err) {
        // Fallback
      }
    }

    inMemoryContacts.delete(contactId);
    return { success: true };
  }
}

const contactService = new ContactService();
module.exports = contactService;

