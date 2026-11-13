const express = require('express');
const router = express.Router();
const {
  getContacts,
  getRequests,
  sendRequest,
  respondToRequest,
  deleteContact
} = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getContacts);
router.get('/requests', protect, getRequests);
router.post('/request', protect, sendRequest);
router.put('/requests/:requestId', protect, respondToRequest);
router.delete('/:contactId', protect, deleteContact);

module.exports = router;

