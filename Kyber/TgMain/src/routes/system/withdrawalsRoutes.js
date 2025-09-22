const express = require("express");
const { setReviewers } = require("../../service/system/reviewStore");
const { approveKeyboard, formatWithdrawCard } = require("../../service/system/ui");
const { success, fail } = require("../../utils/responseWrapper");
const merChatService = require("../../service/system/sysMerchantChatService");
const router = express.Router();
/**
 * POST /withdrawals/create
 * body = {
 *   merchantNo: number | string,          // 商户标识（必填）
 *   orderId: string,                      // 订单号（必填）
 *   amount: string | number,               // 金额（必填）
 *   exchangeRate: string | number,        // 汇率（必填）
 *   remark?: string,                       // 备注（可选）
 *   currency?: number                       // 覆盖群ID（可选；不传则按商户查）
 * }
 */
module.exports = function createWithdrawalsRouter(bot) {
  const router = express.Router();

  const esc = (s = "") => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  router.post("/withdrawals/create", async (req, res) => {
    const { merchantNo, orderId, amount, exchangeRate, remark = "", currency } = req.body || {};
    try {
      if (!merchantNo || !orderId || amount === undefined || exchangeRate === undefined || !currency) {
        return res.json(fail("参数异常"));
      }

      const chatReviewer = await merChatService.getChatIdAndReviewer(merchantNo, "audit");
      if (!chatReviewer || !chatReviewer.chatId) {
        return res.json(fail("chatId不存在或者系统没有这个商户标识！"));
      }

      const { chatId, reviewerIds } = chatReviewer;

      await setReviewers(String(orderId), reviewerIds || []);

      const text = formatWithdrawCard({
        orderId: esc(String(orderId)),
        amount: esc(String(amount)),
        exchangeRate: esc(String(exchangeRate)),
        remark: esc(String(remark || "")),
        merchantId: esc(String(merchantNo)),
        currency: esc(String(currency)),
      });

      await bot.telegram.sendMessage(
        chatId,
        text,
        { parse_mode: "HTML", ...approveKeyboard(String(orderId), String(merchantNo)) }
      );

      return res.json(success("成功"));
    } catch (err) {
      console.error(err);
      return res.json(fail("系统维护中。。"));
    }
  });

  return router;
};




