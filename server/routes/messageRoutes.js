const express = require('express');
const router = express.Router();
const {
  getConversationMessages,
  sendConversationMessage,
  editConversationMessage,
  deleteConversationMessage,
  uploadMessageAttachment,
  clearConversationMessages,
  togglePinMessage
} = require('../controllers/messageController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { handleSingleFileUpload } = require('../middleware/fileUploadMiddleware');

router.post('/upload', optionalAuth, handleSingleFileUpload('file'), uploadMessageAttachment);
router.post('/:conversationId/upload', optionalAuth, handleSingleFileUpload('file'), uploadMessageAttachment);
router.get('/:conversationId', optionalAuth, getConversationMessages);
router.post('/:conversationId', optionalAuth, sendConversationMessage);
router.delete('/:conversationId/clear', optionalAuth, clearConversationMessages);
router.put('/:conversationId/:messageId/pin', optionalAuth, togglePinMessage);
router.put('/:conversationId/:messageId', optionalAuth, editConversationMessage);
router.delete('/:conversationId/:messageId', optionalAuth, deleteConversationMessage);

module.exports = router;
