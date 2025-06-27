const express = require("express");
const router = express.Router();
const tgOrderService = require("../service/tgOrderService");
const { success, fail } = require("../utils/responseWrapper");

// 分页+模糊+过滤 查询订单
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

router.post("/tg_order", async (req, res) => {
  try {
    const {
      channelMsgId = null,
      merchantMsgId,
      merchantChatId,
      channelGroupId,
      merchantOrderId = null,
      channelOrderId = null,
      tgReplyId = null
    } = req.body;

    //参数校验
    if (!merchantOrderId){
      return res.json(fail('merchantOrderId为必填字段'));
    }

    if (!merchantChatId || !channelGroupId){
      return res.json(fail('merchantChatId和channelGroupId为必填字段'));
    }

    const insertId = await tgOrderService.insertOrder({
      channelMsgId,
      merchantMsgId,
      merchantChatId,
      channelGroupId,
      merchantOrderId,
      channelOrderId,
      tgReplyId
    });

    res.json(success())
  } catch (err) {
    console.log('[ERROR]插入订单失败:',err)
    res.json(fail((err.message)));
  }
});

module.exports = router;
