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
    const {
      merchantNo,
      merchantName,
      orderId,
      amount,
      currency,
      balanceAvailable,
      usdtAddress,
      addressHint,
      amountRaw,
      exchangeRate,
      usdtFinal,
      applyTime,
      isSameAddress = true
    } = req.body || {};
    try {
      const requiredParams = {
        merchantNo,
        merchantName,
        orderId,
        amount,
        currency,
        balanceAvailable,
        usdtAddress,
        amountRaw,
        exchangeRate,
        usdtFinal,
        applyTime,
      };

      const missing = Object.entries(requiredParams)
        .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
        .map(([k]) => k);

      if (missing.length > 0) {
        return res.json(fail(`缺少必要参数: ${missing.join(", ")}`));
      }

      const chatReviewer = await merChatService.getChatIdAndReviewer(merchantNo, "audit");
      if (!chatReviewer || !chatReviewer.chatId) {
        return res.json(fail("chatId不存在或者系统没有这个商户标识！"));
      }

      const { chatId, reviewerIds } = chatReviewer;

      await setReviewers(orderId, reviewerIds, isSameAddress ? 1 : 2);

      const text = formatWithdrawCard({
        orderId: esc(orderId),
        merchantName: esc(merchantName),
        currency: esc(currency),
        applyTime: esc(applyTime),
        amount: esc(amount),
        balanceAvailable: esc(balanceAvailable),
        usdtAddress: esc(usdtAddress),
        addressHint: esc(addressHint || ""),
        amountRaw: esc(amountRaw),
        exchangeRate: esc(exchangeRate),
        usdtFinal: esc(usdtFinal),
        isSameAddress,
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




