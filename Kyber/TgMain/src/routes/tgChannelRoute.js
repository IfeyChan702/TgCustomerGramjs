const express = require('express');
const router = express.Router();
const tgChannelService = require('../service/tgChannelService');
const { success, fail } = require('../utils/responseWrapper');

/**
 * @swagger
 * /tg-channel:
 *   get:
 *     summary: 查询所有渠道群
 *     tags:
 *       - Telegram Channel
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 支持模糊搜索 group_name/chat_id/tg_account_id
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       group_id: { type: string }
 *                       chat_id: { type: string }
 *                       group_name: { type: string }
 *                       tg_account_id: { type: string }
 *                       role: { type: string }
 *                       template_id: { type: string }
 */
router.get('/tg-channel', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgChannelService.getAllChannels(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-channel:
 *   post:
 *     summary: 新增渠道群
 *     tags:
 *       - Telegram Channel
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tg_account_id
 *               - group_id
 *               - chat_id
 *               - group_name
 *             properties:
 *               tg_account_id: { type: string }
 *               group_id: { type: string }
 *               chat_id: { type: string }
 *               group_name: { type: string }
 *               role: { type: string, default: "channel" }
 *               template_id: { type: string }
 *     responses:
 *       200:
 *         description: 新增成功
 */
router.post('/tg-channel', async (req, res) => {
  try {
    const result = await tgChannelService.createChannel(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-channel/{id}:
 *   put:
 *     summary: 更新渠道群
 *     tags:
 *       - Telegram Channel
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 渠道群主键ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tg_account_id: { type: string }
 *               group_id: { type: string }
 *               chat_id: { type: string }
 *               group_name: { type: string }
 *               role: { type: string }
 *               template_id: { type: string }
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/tg-channel/:id', async (req, res) => {
  try {
    const result = await tgChannelService.updateChannel(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-channel/{id}:
 *   delete:
 *     summary: 删除渠道群
 *     tags:
 *       - Telegram Channel
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 渠道群主键ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/tg-channel/:id', async (req, res) => {
  try {
    const result = await tgChannelService.deleteChannel(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-channel/list:
 *   get:
 *     summary: 查询全部渠道简要信息（id，渠道ID，渠道名称）
 *     tags:
 *       - Telegram Channel
 *     responses:
 *       200:
 *         description: 查询成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       group_id: { type: string }
 *                       group_name: { type: string }
 */
router.get('/tg-channel/list',async (req,res) => {
  try {
    const result = await tgChannelService.getAllChannelForSelect();
    res.json(success(result));
  }catch (err){
    res.json(fail(err.message));
  }
})

module.exports = router;
