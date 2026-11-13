const express = require('express');
const router = express.Router();
const { createRoom, getRoom, getMessages } = require('../controllers/roomController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { validateRoomCreate } = require('../middleware/validateMiddleware');

router.post('/create', optionalAuth, validateRoomCreate, createRoom);
router.get('/:roomId', getRoom);
router.get('/:roomId/messages', getMessages);

module.exports = router;

