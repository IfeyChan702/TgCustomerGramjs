const express = require("express");
const router = express.Router();
const tgOrderService = require("../service/tgOrderService");
const { success, fail } = require("../utils/responseWrapper");
const tgDbService = require("../service/tgDbService");
/**
 * 模糊查询、条件查询，分页查询--订单数据
 */
router.get("/tg-order", async (req, res) => {
  try {
    const {
      keyword = "",
      page = 1,
      size = 10,
      status = null,
      merchantId = null,
      channelId = null,
      startTime = null,
      endTime = null
    } = req.query;

    const params = {
      keyword,
      page: Number(page),
      size: Number(size),
      status: status !== null ? Number(status) : null,
      merchantId: merchantId ? Number(merchantId) : null,
      channelId: channelId ? Number(channelId) : null,
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
 * 插入订单数据
 */
router.post("/tg-order", async (req, res) => {
  try {
    const {
      channelMsgId = null,
      merchantMsgId = null,
      merchantChatId,
      channelGroupId,
      orderstatus,
      merchantOrderId = null,
      tgReplyId = null
    } = req.body;

    //参数校验
    if (!merchantOrderId) {
      return res.json(fail("merchantOrderId为必填字段"));
    }

    if (!merchantChatId || !channelGroupId) {
      return res.json(fail("merchantChatId和channelGroupId为必填字段"));
    }

    const insertId = await tgOrderService.insertOrder({
      channelMsgId,
      merchantMsgId,
      merchantChatId,
      orderstatus,
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
 * 根据id删除订单
 */
router.delete("/tg-order", async (req, res) => {
  try {
    const { id } = req.body;

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
 * 根据id修改用户的信息
 */
router.post("/tg-order", async (req, res) => {

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
