const express = require('express');
const ruleController = require('../controllers/ruleController');

const router = express.Router();

router.get('/rule', ruleController.getRuleData);

module.exports = router;
