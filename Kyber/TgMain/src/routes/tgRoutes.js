const express = require('express');
const { initRegister, submitPhone, submitCode, getStatus } = require('../service/tgRegisterService');
const { getGroupsByRegisterId } = require('../service/tgGroupService');
const { success, fail } = require('../utils/responseWrapper');

const router = express.Router();

/**
 * @swagger
 * /register/init:
 *   post:
 *     summary: 初始化注册
 *     description: 初始化 Telegram 注册，返回注册会话 ID。
 *     tags:
 *       - Register
 *     responses:
 *       200:
 *         description: 初始化成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     registerId:
 *                       type: string
 *                 errorMessage:
 *                   type: string
 */
router.post('/register/init', initRegister);

/**
 * @swagger
 * /register/phone:
 *   post:
 *     summary: 提交手机号
 *     description: 提交手机号进行注册。
 *     tags:
 *       - Register
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registerId:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 提交成功
 */
router.post('/register/phone', submitPhone);

/**
 * @swagger
 * /register/code:
 *   post:
 *     summary: 提交验证码
 *     description: 提交手机验证码。
 *     tags:
 *       - Register
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registerId:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 提交成功
 */
router.post('/register/code', submitCode);

/**
 * @swagger
 * /register/status:
 *   get:
 *     summary: 获取注册状态
 *     description: 查询注册流程当前状态。
 *     tags:
 *       - Register
 *     parameters:
 *       - name: registerId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: 注册会话 ID
 *     responses:
 *       200:
 *         description: 查询成功
 */
router.get('/register/status', getStatus);

/**
 * @swagger
 * /tg/groups:
 *   get:
 *     summary: 获取群组列表（测试用）
 *     description: 通过 registerId 查询群组列表。
 *     tags:
 *       - Register
 *     parameters:
 *       - name: registerId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: 注册会话 ID
 *     responses:
 *       200:
 *         description: 查询成功
 */
router.get('/groups', async (req, res) => {
  const { registerId } = req.query;
  if (!registerId)
    return res.json(fail(err));

  try {
    const groups = await getGroupsByRegisterId(registerId);
    res.json(success(groups));
  } catch (err) {
    console.error('[ERROR][/groups]', err);
    res.json(fail(err));
  }
});

module.exports = router;
