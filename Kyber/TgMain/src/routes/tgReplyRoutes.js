const express = require('express');
const router = express.Router();
const tgReplyService = require('../service/tgReplyService');
const { success, fail } = require('../utils/responseWrapper');

/**
 * @swagger
 * /tg-reply:
 *   get:
 *     summary: 查询所有语料
 *     tags:
 *       - Telegram Reply
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 按规则/内容关键词模糊搜索
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
 *                       match_rule: { type: string, description: 匹配规则 }
 *                       reply_text: { type: string, description: 回复内容 }
 *                       ...: { description: 你自己的其他字段 }
 */
router.get('/tg-reply', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgReplyService.getAllReplies(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-reply:
 *   post:
 *     summary: 新增语料
 *     tags:
 *       - Telegram Reply
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - match_rule
 *               - reply_text
 *             properties:
 *               match_rule: { type: string, description: 匹配规则 }
 *               reply_text: { type: string, description: 回复内容 }
 *               ...: { description: 你自己的其他字段 }
 *     responses:
 *       200:
 *         description: 新增成功
 */
router.post('/tg-reply', async (req, res) => {
  try {
    const result = await tgReplyService.createReply(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-reply/{id}:
 *   put:
 *     summary: 更新语料
 *     tags:
 *       - Telegram Reply
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 语料主键ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               match_rule: { type: string }
 *               reply_text: { type: string }
 *               ...: { description: 你自己的其他字段 }
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/tg-reply/:id', async (req, res) => {
  try {
    const result = await tgReplyService.updateReply(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-reply/{id}:
 *   delete:
 *     summary: 删除语料
 *     tags:
 *       - Telegram Reply
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 语料主键ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/tg-reply/:id', async (req, res) => {
  try {
    const result = await tgReplyService.deleteReply(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
