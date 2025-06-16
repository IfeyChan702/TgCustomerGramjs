const express = require('express');
const telegramController = require('../controllers/telegramController');

const router = express.Router();

router.post('/tg/register/init', telegramController.initTelegramRegister);

module.exports = router;
