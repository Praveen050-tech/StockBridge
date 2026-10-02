const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const voiceController = require('../controllers/voice.controller');

// Process voice transcript -> classify intent and extract data
router.post('/process', authenticateToken, voiceController.processVoice);

// Confirm and execute the parsed action
router.post('/confirm', authenticateToken, voiceController.confirmAction);

module.exports = router;
