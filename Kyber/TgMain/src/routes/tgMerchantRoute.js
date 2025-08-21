const express = require('express');
const router = express.Router();
const tgMerchantService = require('../service/tgMerchantService');
const { success, fail } = require('../utils/responseWrapper');

/**
 * @swagger
 * /tg-merchant:
 *   get:
 *     summary: 查询所有商户群
 *     tags:
 *       - Telegram Merchant
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
router.get('/tg-merchant', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgMerchantService.getAllMerchants(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-merchant:
 *   post:
 *     summary: 新增商户群
 *     tags:
 *       - Telegram Merchant
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
 *               role: { type: string, default: "merchant" }
 *               template_id: { type: string }
 *     responses:
 *       200:
 *         description: 新增成功
 */
router.post('/tg-merchant', async (req, res) => {
  try {
    const result = await tgMerchantService.createMerchant(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-merchant/{id}:
 *   put:
 *     summary: 更新商户群
 *     tags:
 *       - Telegram Merchant
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 商户群主键ID
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
router.put('/tg-merchant/:id', async (req, res) => {
  try {
    const result = await tgMerchantService.updateMerchant(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-merchant/{id}:
 *   delete:
 *     summary: 删除商户群
 *     tags:
 *       - Telegram Merchant
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 商户群主键ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/tg-merchant/:id', async (req, res) => {
  try {
    const result = await tgMerchantService.deleteMerchant(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg-merchant/list:
 *   get:
 *     summary: 查询全部的商户简要信息（id，聊天室ID，商户名称）
 *     tags:
 *       - Telegram Merchant
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
router.get('/tg-merchant/list',async (req,res) => {
  try {
    const result = await tgMerchantService.getAllMerchantForSelect();
    res.json(success(result))
  }catch (err){
    res.json(fail(err.message));
  }
})


module.exports = router;
