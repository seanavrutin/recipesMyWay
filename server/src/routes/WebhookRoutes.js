const express = require('express');
const WebhookController = require('../controllers/WebhookController');
const router = express.Router();

const webhookController = new WebhookController();

router.get('/', (req, res) => webhookController.verifyWebhook(req, res)); // For verification
router.post('/', (req, res) => webhookController.handleMessage(req, res)); // For handling messages

module.exports = router;
