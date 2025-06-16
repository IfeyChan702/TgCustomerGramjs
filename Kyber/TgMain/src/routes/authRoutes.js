const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login/account', authController.login);
router.post('/login/outLogin', authController.logout);

module.exports = router;