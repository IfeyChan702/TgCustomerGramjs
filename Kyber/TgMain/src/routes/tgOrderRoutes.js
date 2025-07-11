const express = require("express");
const router = express.Router();
const tgOrderService = require("../service/tgOrderService");
const { success, fail } = require("../utils/responseWrapper");
const tgDbService = require("../service/tgDbService");

/**
 * @swagger
 * /tg/order:
 *   get:
 *     summary: 订单列表 - 支持模糊、条件、分页查询
 *     tags: [Telegram Order]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 关键字模糊搜索
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: 页码
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 10 }
 *         description: 每页条数
 *       - in: query
 *         name: status
 *         schema: { type: integer }
 *         description: 订单状态
 *       - in: query
 *         name: merchantId
 *         schema: { type: integer }
 *         description: 商户ID
 *       - in: query
 *         name: channelId
 *         schema: { type: integer }
 *         description: 渠道ID
 *       - in: query
 *         name: merchantOrderId
 *         schema: { type: string }
 *         description: 商户订单号
 *       - in: query
 *         name: startTime
 *         schema: { type: string, format: date-time }
 *         description: 创建开始时间
 *       - in: query
 *         name: endTime
 *         schema: { type: string, format: date-time }
 *         description: 创建结束时间
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
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           merchant_order_id: { type: string }
 *                           merchant_chat_id: { type: string }
 *                           channel_group_id: { type: string }
 *                           status: { type: integer }
 *                           created_time: { type: string }
 */
router.get("/tg/order", async (req, res) => {
  try {
    const {
      keyword = "",
      page = 1,
      size = 10,
      status = null,
      merchantId = null,
      channelId = null,
      startTime = null,
      endTime = null,
      merchantOrderId = null
    } = req.query;

    const params = {
      keyword,
      page: Number(page),
      size: Number(size),
      status: status !== null ? Number(status) : null,
      merchantId: merchantId ? Number(merchantId) : null,
      channelId: channelId ? Number(channelId) : null,
      merchantOrderId,
      startTime,
      endTime
    };

    const data = await tgOrderService.getPageOrders(params);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg/order:
 *   post:
 *     summary: 新增订单
 *     tags: [Telegram Order]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - merchantChatId
 *               - channelGroupId
 *               - merchantOrderId
 *             properties:
 *               channelMsgId: { type: string, description: '渠道消息ID(可选)' }
 *               merchantMsgId: { type: string, description: '商户消息ID(可选)' }
 *               merchantChatId: { type: string, description: '商户群ID' }
 *               channelGroupId: { type: string, description: '渠道群ID' }
 *               orderStatus: { type: integer, default: 0, description: '订单状态' }
 *               merchantOrderId: { type: string, description: '商户订单号' }
 *               tgReplyId: { type: integer, description: '回复ID(可选)' }
 *     responses:
 *       200:
 *         description: 新增成功
 */
router.post("/tg/order", async (req, res) => {
  try {
    const {
      channelMsgId = null,
      merchantMsgId = null,
      merchantChatId,
      channelGroupId,
      orderStatus = 0,
      merchantOrderId = null,
      tgReplyId = 0
    } = req.body;

    //参数校验
    if (!merchantOrderId) {
      return res.json(fail("merchantOrderId为必填字段"));
    }

    const insertId = await tgOrderService.insertOrder({
      channelMsgId,
      merchantMsgId,
      merchantChatId,
      orderStatus,
      channelGroupId,
      merchantOrderId,
      tgReplyId
    });

    res.json(success());
  } catch (err) {
    console.log("[ERROR]插入订单失败:", err);
    res.json(fail((err.message)));
  }
});

/**
 * @swagger
 * /tg/order/{id}:
 *   delete:
 *     summary: 删除订单
 *     tags: [Telegram Order]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: 订单主键ID
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete("/tg/order/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.json(fail("订单 id 为空"));
    }

    const result = await tgOrderService.deleteOrderById(id);

    if (result.affectedRows === 0) {
      return res.json(fail("未找到这笔订单，删除失败"));
    }

    res.json(success("订单删除成功!"));
  } catch (err) {
    console.error("[ERROR] 删除订单失败：", err);
    res.json(fail(err.message));
  }
});

/**
 * @swagger
 * /tg/order:
 *   patch:
 *     summary: 处理订单状态（按商户订单号处理/更新状态）
 *     tags: [Telegram Order]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [merchantOrderId]
 *             properties:
 *               merchantOrderId: { type: string, description: '商户订单号' }
 *     responses:
 *       200:
 *         description: 处理成功/失败
 */
router.patch("/tg/order", async (req, res) => {

  const { merchantOrderId } = req.body;
  if (!merchantOrderId) {
    return res.json(fail("merchantOrderId 为必填字段"));
  }
  try {
    const result = await tgDbService.checkAndProcessOrder(merchantOrderId);
    const { found, alreadyProcessed, updated } = result;
    if (!found){
      return res.json(fail("没有这笔订单"))
    }

    if (alreadyProcessed){
      return res.json(fail("订单已处理,无法重复处理订单"))
    }

    if (updated){
      return res.json(success("订单状态已经更新成功"))
    }

    return res.json(fail("订单存在但是更新失败"))
  } catch (err) {
    console.error(`[ERROR] 处理修改订单状态失败：`, err);
    return res.json(fail(err.message));
  }
});

module.exports = router;
