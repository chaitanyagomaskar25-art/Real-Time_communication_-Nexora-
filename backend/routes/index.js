const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const meetingRoutes = require('./meetingRoutes');
const roomRoutes = require('./roomRoutes');
const userRoutes = require('./userRoutes');
const contactRoutes = require('./contactRoutes');
const notificationRoutes = require('./notificationRoutes');
const recordingRoutes = require('./recordingRoutes');
const aiRoutes = require('./aiRoutes');
const adminRoutes = require('./adminRoutes');
const healthRoutes = require('./healthRoutes');
const messageRoutes = require('./messageRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/meetings', meetingRoutes);
router.use('/recordings', recordingRoutes);
router.use('/ai', aiRoutes);
router.use('/admin', adminRoutes);
router.use('/rooms', roomRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);

module.exports = router;
