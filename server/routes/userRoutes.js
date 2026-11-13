const express = require('express');
const router = express.Router();
const { getProfile, searchUsers, updatePresence } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/profile', protect, getProfile);
router.get('/search', protect, searchUsers);
router.put('/presence', protect, updatePresence);

module.exports = router;
