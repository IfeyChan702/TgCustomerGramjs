const express = require('express');
const telegramController = require('../controllers/telegramController');

const router = express.Router();

router.post('/tg/register/init', telegramController.initTelegramRegister);
router.post('/tg/register/phone', telegramController.submitPhoneNumber);
router.post('/tg/register/code', telegramController.submitVerificationCode);
router.get('/tg/register/status', telegramController.getRegistrationStatus);

module.exports = router;
