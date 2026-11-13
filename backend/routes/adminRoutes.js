const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// Public/participant reporting of abusive meetings
router.post('/meetings/:meetingId/report', protect, adminController.reportMeeting);

// All subsequent routes require strict Admin authentication and role
router.use(protect);
router.use(requireAdmin);

// 1. Overview
router.get('/overview', adminController.getOverview);

// 2. User Management
router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.put('/users/:userId/role', adminController.updateUserRole);

// 3. Meeting Management
router.get('/meetings', adminController.getMeetings);
router.get('/meetings/:meetingId', adminController.getMeetingDetails);
router.put('/meetings/:meetingId/reports/:reportId', adminController.resolveMeetingReport);
router.post('/meetings/:meetingId/terminate', adminController.terminateMeeting);

// 4. Analytics
router.get('/analytics', adminController.getAnalytics);

// 5. System Management
router.get('/system/metrics', adminController.getSystemMetrics);

// 6. Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;

