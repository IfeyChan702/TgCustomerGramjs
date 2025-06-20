const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 登录
router.post('/login/account', authController.login);

// 当前用户信息
router.get('/currentUser', authController.getCurrentUser);

// 获取 rule 列表
router.get('/rule', authController.getRules);

// 登出
router.post('/login/outLogin', authController.logout);

module.exports = router;
