const express = require("express");
const { setReviewers, setApprovers } = require("../../service/system/reviewStore");
const { approveKeyboard, formatWithdrawCard, auditKeyboard } = require("../../service/system/ui");
const { success, fail } = require("../../utils/responseWrapper");
const merChatService = require("../../service/system/sysMerchantChatService");
const router = express.Router();
const { redis } = require("../../models/redisModel");
const withdrawContextService = require("../../service/system/sysWithdrawContextService");
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

const formatDate = (date) => {
  let d = new Date(date);

  // 如果解析失败，尝试补 T 或作为时间戳
  if (isNaN(d.getTime())) {
    if (typeof date === "string" && date.includes(" ")) {
      d = new Date(date.replace(" ", "T")); // 补上 T，兼容 "2025-10-16 12:30:00"
    } else if (!isNaN(Number(date))) {
      d = new Date(Number(date)); // 时间戳
    }
  }

  if (isNaN(d.getTime())) {
    console.warn("⚠️ 无法解析时间:", date);
    return "Invalid Date";
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};


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
      exchangeRate,
      usdtFinal,
      applyTime,
      optType,//0-法币提现,1-提U
      isSameAddress = true
    } = req.body || {};
    try {

      const formattedApplyTime = formatDate(applyTime || Date.now());

      const requiredParams = {
        merchantNo,
        merchantName,
        orderId,
        amount,
        currency,
        balanceAvailable,
        exchangeRate,
        applyTime: formattedApplyTime,
        optType
      };

      const missing = Object.entries(requiredParams)
        .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
        .map(([k]) => k);

      if (missing.length > 0) {
        return res.json(fail(`缺少必要参数: ${missing.join(", ")}`));
      }

      const chatReviewer = await merChatService.getChatInfoByMerchant(merchantNo);
      if (!chatReviewer || !chatReviewer.chatId) {
        return res.json(fail("chatId不存在或者系统没有这个商户标识！"));
      }

      const { chatId, reviewerIds, approveIds } = chatReviewer;

      await setReviewers(orderId, reviewerIds, 1);

      await setApprovers(orderId, approveIds, isSameAddress ? 1 : 2);

      const withdrawData = {
        merchantNo,
        merchantName,
        orderId,
        amount,
        currency,
        balanceAvailable,
        usdtAddress,
        addressHint,
        exchangeRate,
        usdtFinal,
        applyTime: formattedApplyTime,
        optType,
        isSameAddress,
      };

      const exist = await withdrawContextService.findByOrderIdAndMerchantNo(orderId, merchantNo);
      if (exist) {
        return res.json(fail("这个商户的这笔订单已经提交过，请勿重复提交"));
      }

      const result = await withdrawContextService.insert(withdrawData);

      if (!result || result.affectedRows <= 0) {
        console.warn("createWithdrawalsRouter 插入/更新失败:", withdrawData);
        return res.json(fail("保存提现记录失败"));
      }

      const text = formatWithdrawCard({
        orderId: esc(orderId),
        merchantName: esc(merchantName),
        currency: esc(currency),
        applyTime: esc(formattedApplyTime),
        amount: esc(amount),
        balanceAvailable: esc(balanceAvailable),
        usdtAddress: esc(usdtAddress),
        addressHint: esc(addressHint || ""),
        exchangeRate: esc(exchangeRate),
        usdtFinal: esc(usdtFinal),
        isSameAddress,
        optType: esc(optType)
      });

      await bot.telegram.sendMessage(
        chatId,
        text,
        {
          parse_mode: "HTML",
          ...auditKeyboard(
            String(orderId),
            String(merchantNo),
            String(merchantName),
            String(currency),
            String(amount),
            String(balanceAvailable),
            String(usdtAddress || ""),
            String(addressHint || ""),
            String(exchangeRate),
            String(usdtFinal),
            isSameAddress,
            String(optType)
          )
        }
      );

      return res.json(success("成功"));
    } catch (err) {
      console.error(err);
      return res.json(fail("系统维护中。。"));
    }
  });

  return router;
};





