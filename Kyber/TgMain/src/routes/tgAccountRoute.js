const express = require('express');
const router = express.Router();
const tgAccountService = require('../service/tgAccountService');
const { success, fail } = require('../utils/responseWrapper');

/**
 * @swagger
 * /tg-accounts:
 *   get:
 *     summary: 查询所有账户
 *     tags:
 *       - Telegram Account
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 支持模糊搜索 registerId、phone、api_id
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       registerId:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       api_id:
 *                         type: string
 */
router.get('/tg-accounts', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgAccountService.getAllAccounts(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-accounts:
 *   post:
 *     summary: 新增账户
 *     tags:
 *       - Telegram Account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registerId:
 *                 type: string
 *               Id:
 *                 type: string
 *               api_id:
 *                 type: string
 *               api_hash:
 *                 type: string
 *               session:
 *                 type: string
 *               is_running:
 *                 type: number
 *               code:
 *                 type: string
 *               phone:
 *                 type: string
 *               status:
 *                 type: string
 *               telegram_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 新增成功
 */
router.post('/tg-accounts', async (req, res) => {
  try {
    const result = await tgAccountService.createAccount(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-accounts/{registerId}:
 *   put:
 *     summary: 更新账户（通过 registerId）
 *     tags:
 *       - Telegram Account
 *     parameters:
 *       - in: path
 *         name: registerId
 *         required: true
 *         schema:
 *           type: string
 *         description: 注册账户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_running:
 *                 type: number
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/tg-accounts/:registerId', async (req, res) => {
  try {
    const result = await tgAccountService.updateAccount(req.params.registerId, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-accounts/{registerId}:
 *   delete:
 *     summary: 删除账户（通过 registerId）
 *     tags:
 *       - Telegram Account
 *     parameters:
 *       - in: path
 *         name: registerId
 *         required: true
 *         schema:
 *           type: string
 *         description: 注册账户ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/tg-accounts/:registerId', async (req, res) => {
  try {
    const result = await tgAccountService.deleteAccount(req.params.registerId);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
