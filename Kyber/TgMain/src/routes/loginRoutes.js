const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * /login/account:
 *   post:
 *     summary: 用户登录
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 登录成功
 */
router.post('/login/account', authController.login);

/**
 * @swagger
 * /currentUser:
 *   get:
 *     summary: 获取当前用户信息
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: 返回当前登录用户信息
 */
router.get('/currentUser', authController.getCurrentUser);

/**
 * @swagger
 * /rule:
 *   get:
 *     summary: 获取 rule 列表
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: 规则列表
 */
router.get('/rule', authController.getRules);

/**
 * @swagger
 * /login/outLogin:
 *   post:
 *     summary: 用户登出
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: 登出成功
 */
router.post('/login/outLogin', authController.logout);

/**
 * @swagger
 * /captcha:
 *   get:
 *     summary: 获取验证码
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: 返回验证码图片或内容
 */
router.get('/captcha', authController.getCaptcha);

module.exports = router;
