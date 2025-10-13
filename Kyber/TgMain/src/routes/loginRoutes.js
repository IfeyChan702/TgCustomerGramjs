const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth'); // 引入认证中间件

/**
 * @swagger
 * /login/account:
 *   post:
 *     summary: 用户登录
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: "123456"
 *               captcha:
 *                 type: string
 *                 example: "a1b2"
 *     responses:
 *       200:
 *         description: 登录成功，返回 Token 和用户信息
 */
router.post('/login/account', authController.login);

/**
 * @swagger
 * /currentUser:
 *   get:
 *     summary: 获取当前用户信息
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 当前登录用户信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userid:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     email:
 *                       type: string
 *                     access:
 *                       type: string
 */
router.get('/currentUser', authMiddleware.verifyToken, authController.getCurrentUser);

/**
 * @swagger
 * /rule:
 *   get:
 *     summary: 获取权限规则列表
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 规则列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["dashboard:view", "user:edit"]
 */
router.get('/rule', authMiddleware.verifyToken, authController.getRules);

/**
 * @swagger
 * /login/outLogin:
 *   post:
 *     summary: 用户登出
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: 退出成功
 */
router.post('/login/outLogin', authController.logout);

/**
 * @swagger
 * /captcha:
 *   get:
 *     summary: 获取验证码
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: SVG 格式验证码
 *         content:
 *           image/svg+xml:
 *             schema:
 *               type: string
 */
router.get('/captcha', authController.getCaptcha);

module.exports = router;
