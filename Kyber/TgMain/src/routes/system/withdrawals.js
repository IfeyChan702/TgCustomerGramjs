
const express = require("express");
const { setReviewers } = require("../../service/system/reviewStore")
const { approveKeyboard,formatWithdrawCard } = require("../../service/system/ui")
const { success, fail } = require('../../utils/responseWrapper');
const merChatService = require("../../service/system/sysMerchantChatService");
const router = express.Router();
/**
 * POST /withdrawals/create
 * body = {
 *   merchant_id: number | string,          // 商户标识（必填）
 *   order_id: string,                      // 订单号（必填）
 *   amount: string | number,               // 金额（必填）
 *   exchange_rate: string | number,        // 汇率（必填）
 *   remark?: string,                       // 备注（可选）
 *   reviewer_ids?: number[],               // 审核人白名单（可选）
 *   chat_id?: number                       // 覆盖群ID（可选；不传则按商户查）
 * }
 */
module.exports = function createWithdrawalsRouter(bot) {
  const router = express.Router();

  router.post("/withdrawals/create", async (req, res) => {
    const { merchant_id, order_id, amount, exchange_rate, remark = "" } = req.body || {};
    try {
      if (!merchant_id || !order_id || amount === undefined || exchange_rate === undefined) {
        return res.json(fail("参数异常"));
      }

      const chatReviewer = await merChatService.getChatIdAndReviewer(merchant_id, "audit");
      if (!chatReviewer || !chatReviewer.chatId) {
        return res.json(fail("chatId不存在或者系统没有这个商户标识！"));
      }

      const { chatId, reviewerIds } = chatReviewer;

      await setReviewers(String(order_id), reviewerIds || []);

      const text = formatWithdrawCard({
        orderId: String(order_id),
        amount: String(amount),
        exchangeRate: String(exchange_rate),
        remark: String(remark || ""),
        merchantId: String(merchant_id),
      });

      await bot.telegram.sendMessage(
        chatId,
        text,
        { parse_mode: "HTML", ...approveKeyboard(String(order_id), String(merchant_id)) }
      );

      return res.json(success("成功"));
    } catch (err) {
      console.error(err);
      return res.json(fail("系统维护中。。"));
    }
  });

  return router;
};




