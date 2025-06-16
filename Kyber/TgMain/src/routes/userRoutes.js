const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/currentUser', userController.getCurrentUser);

module.exports = router;
