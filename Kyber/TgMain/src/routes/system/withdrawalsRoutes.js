const express = require("express");
const { setReviewers, setApprovers } = require("../../service/system/reviewStore");
const {
  approveKeyboard,
  formatWithdrawCard,
  auditKeyboard,
  formatOrderCard,
  formatInternalRequestCard,
  formatBatchTransferCard
} = require("../../service/system/ui");
const { success, fail } = require("../../utils/responseWrapper");
const merChatService = require("../../service/system/sysMerchantChatService");
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

const CHAT_ID = -1003256208710;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSendAt = 0;

async function safeSend(bot, chatId, text, extra = {}, minIntervalMs = 300) {
  // 简单节流：同一进程内两次发送至少间隔 minIntervalMs
  const now = Date.now();
  const gap = now - lastSendAt;
  if (gap < minIntervalMs) await sleep(minIntervalMs - gap);

  try {
    const ret = await bot.telegram.sendMessage(chatId, text, extra);
    lastSendAt = Date.now();
    return ret;
  } catch (err) {
    const code = err?.response?.error_code;
    const retryAfter = err?.response?.parameters?.retry_after;

    if (code === 429 && retryAfter) {
      await sleep((retryAfter + 1) * 1000);
      const ret = await bot.telegram.sendMessage(chatId, text, extra);
      lastSendAt = Date.now();
      return ret;
    }
    throw err;
  }
}


module.exports = function createWithdrawalsRouter(bot) {
  const router = express.Router();

  const esc = (s = "") => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  /**
   * 提现接口
   */
  router.post("/withdrawals/create", async (req, res) => {
    const {
      merchantNo,//商户号
      merchantName,//商户名
      orderId,//订单id
      amount,//金额
      currency,//货币
      balanceAvailable,//可用余额
      usdtAddress,//回u地址
      addressHint,//地址提示
      exchangeRate,//汇率
      usdtFinal,//最终u价
      applyTime,//申请时间
      optType,//0-法币提现,1-提U
      isSameAddress = true//是否是相同的地址
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
        applyTime: formattedApplyTime,
        optType
      };

      const missing = Object.entries(requiredParams)
        .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
        .map(([k]) => k);

      if (missing.length > 0) {
        return res.json(fail(`缺少必要参数: ${missing.join(", ")}`));
      }

      const hintText = (addressHint ?? "").toString();
      const finalIsSameAddress = hintText.includes("首次提现") ? true : Boolean(isSameAddress);

      const chatReviewer = await merChatService.getChatInfoByMerchant(merchantNo);
      if (!chatReviewer || !chatReviewer.chatId) {
        return res.json(fail("chatId不存在或者系统没有这个商户标识！"));
      }

      const { chatId, reviewerIds, approveIds } = chatReviewer;

      await setReviewers(orderId, reviewerIds, 1);

      await setApprovers(orderId, approveIds, 1);

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
        finalIsSameAddress
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
        finalIsSameAddress,
        optType: esc(optType),
        isConfirmInfo: true
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
            finalIsSameAddress,
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

  /**
   * 内部请款接口
   */
  router.post("/order/create", async (req, res) => {
    try {
      // 1) 解构 & 规范化
      const {
        merchantNo,
        merchantName,
        accountNo,
        orderId,
        optType,//6是转账
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        remark = "",
        applyTime,
        operator,
        channelName,
        detailItemCount,
        detailInfo //批量转账的相信信息
      } = req.body || {};

      const optTypeNum = Number(optType);

      if (![1, 2, 3, 5, 6].includes(optTypeNum)) {
        return res.json(fail("optType 必须是: 1,2,3,5,6"));
      }

      if (optTypeNum === 5) {
        const required5 = { orderId, optType: optTypeNum, amount, currency, operator };
        const missing5 = Object.entries(required5)
          .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
          .map(([k]) => k);
        if (missing5.length > 0) {
          return res.json(fail(`缺少必填参数: ${missing5.join(", ")}`));
        }

        const chatInfo = await merChatService.getChatInfoByMerchant("M20251111111111112233");
        if (!chatInfo?.chatId) {
          return res.json(fail("商户未配置 TG 群聊"));
        }
        const { chatId, reviewerIds, approveIds } = chatInfo;

        const applyTimeStr = formatDate(applyTime || Date.now());

        if (approveIds?.length) {
          console.log("/order/create,setApprovers{}", approveIds);
          await setApprovers(orderId, approveIds, 1);
        }

        const text = formatInternalRequestCard({
          orderId,
          amount,
          currency,
          applyTime: applyTimeStr,
          operator,
          remark // 可省略
        });

        await bot.telegram.sendMessage(chatId, text, {
          parse_mode: "HTML",
          ...approveKeyboard(orderId, "M20251111111111112233", 5)
        });

        return res.json(success("提交成功"));
      }
      // ===== 这里是原有 6 的处理 =====
      if (optTypeNum === 6) {
        const required6 = {
          merchantNo,
          merchantName,
          accountNo,
          orderId,
          amount,
          currency,
          balanceBefore,
          balanceAfter,
          detailItemCount,
          operator
          //detailInfo
        };

        const missing6 = Object.entries(required6)
          .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
          .map(([k]) => k);

        if (missing6.length > 0){
          return res.json(fail(`缺少必填参数: ${missing6.join(", ")}`));
        }

        let detailList = [];
        if(detailInfo){
          try {
            detailList = JSON.parse(detailInfo);
            if (!Array.isArray(detailList) || detailList.length === 0){
              return res.json(fail("detailInfo 必须是非空数组"))
            }

            const totalAmount = detailList.reduce((sum, item) => sum + Number(item.transferAmount || 0), 0);
            if (totalAmount !== Number(amount)) {
              return res.json(fail(`子订单金额总和(${totalAmount})与订单总金额(${amount})不一致`));
            }
          }catch (e) {
            return res.json(fail("detailInfo 格式错误，必须是有效的JSON数组"));
          }
        }

        const chatInfo = await merChatService.getChatInfoByMerchant(merchantNo);
        const { chatId,approveIds } = chatInfo
        if (!chatInfo?.chatId) {
          return res.json(fail("商户未配置 TG 群聊"));
        }
        const  applyTimeStr = formatDate(applyTime || Date.now())
        if (approveIds?.length) {
          console.log("/order/create [批量转账] setApprovers:", approveIds);
          await setApprovers(orderId, approveIds, 1);
        }

        const text = formatBatchTransferCard({
          orderId,
          merchantName,
          accountNo,
          amount,
          currency,
          balanceBefore,
          balanceAfter,
          applyTime: applyTimeStr,
          operator,
          remark,
          detailList,
          detailItemCount
        });

        await bot.telegram.sendMessage(chatId,text,{
          parse_mode:"HTML",
          ...approveKeyboard(orderId,merchantNo,6)
        })
        return res.json(success("批量转账订单提交成功"));
      }

      // ===== 这里是原有 1/2/3 的处理 =====
      const required = {
        merchantNo,
        merchantName,
        orderId,
        optType: optTypeNum,
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        operator,
        accountNo
      };
      const missing = Object.entries(required)
        .filter(([_, v]) => v === undefined || v === null || String(v).trim() === "")
        .map(([k]) => k);

      if (missing.length > 0) {
        return res.json(fail(`缺少必填参数: ${missing.join(", ")}`));
      }

      const chatInfo = await merChatService.getChatInfoByMerchant("M20251111111111112233");
      if (!chatInfo?.chatId) {
        return res.json(fail("商户未配置 TG 群聊"));
      }
      const { chatId, reviewerIds, approveIds } = chatInfo;

      const applyTimeStr = formatDate(applyTime || Date.now());
      await setApprovers(orderId, approveIds, 1);

      const text = formatOrderCard({
        orderId,
        merchantName,
        optType: optTypeNum,
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        remark,
        applyTime: applyTimeStr,
        operator,
        accountNo,
        channelName
      });

      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: "HTML",
        ...approveKeyboard(orderId, merchantNo, optTypeNum)
      });

      return res.json(success("提交成功"));
    } catch (err) {
      console.error("[/order/create] error:", err);
      return res.json(fail("系统异常"));
    }
  });


  /**
   * 报警接口
   */
  router.post("/message/alarm", async (req, res) => {
    const { alarmMessage } = req.body || {};

    // 1) 防止空消息导致 sendMessage 报错
    if (!alarmMessage || String(alarmMessage).trim() === "") {
      return res.json(fail("alarmMessage 不能为空"));
    }

    try {
      await safeSend(bot, CHAT_ID, alarmMessage, { parse_mode: "HTML" });
      return res.json(success("传送成功"));
    } catch (err) {
      // 2) 如果还是 429，把 retry_after 打出来方便你确认
      const retryAfter = err?.response?.parameters?.retry_after;
      const code = err?.response?.error_code;
      console.error("[/message/alarm] error:", { code, retryAfter }, err);

      return res.json(fail("系统异常"));
    }
  });

  return router;
};





