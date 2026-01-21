const { getChatAdmins } = require("../../../service/tgGroupService");
const {
  createMerchantChat
} = require("../../../service/system/sysMerchantChatService");
const {
  getWizard,
  setWizard,
  clearWizard
} = require("../../system/merchantWizard");
const {
  sendApproveKeyboard,
  editApproveKeyboard,
  sendApproveSummary
} = require("../../system/ui")

/* ---------- 私聊 message 处理 ---------- */
exports.onMerchantMessage = async (ctx) => {
  const uid = ctx.from.id;
  const state = getWizard(uid);
  if (!state) return false;

  // 1. 输入商户号
  if (state.step === "CREATE_WAIT_MERCHANT_NO") {
    state.merchantNo = ctx.message.text.trim();
    state.step = "CREATE_WAIT_MERCHANT_NAME";
    setWizard(uid, state);
    await ctx.reply("请输入商户名称：");
    return true;
  }

  // 2. 输入商户名
  if (state.step === "CREATE_WAIT_MERCHANT_NAME") {
    state.merchantName = ctx.message.text.trim();
    state.step = "CREATE_WAIT_APPROVE_COUNT";
    setWizard(uid, state);
    await ctx.reply("请输入需要添加的审批人数：");
    return true;
  }

  // 3. 输入期望审批人数
  if (state.step === "CREATE_WAIT_APPROVE_COUNT") {
    const n = Number(ctx.message.text.trim());
    if (!Number.isInteger(n) || n <= 0) {
      await ctx.reply("请输入正确的数字（大于 0）");
      return true;
    }

    state.expectedApproveCount = n;
    state.step = "CREATE_WAIT_APPROVE_JOIN";
    state.approveCandidates = [];
    setWizard(uid, state);

    await ctx.reply(
      `请让审批人在群里输入 /join_approve\n` +
      `当前已加入：0 / ${n}\n\n` +
      `你可以随时输入 /check_approver 查看当前审批人`
    );
    return true;
  }

  // 4. 操作人主动查询
  if (state.step === "CREATE_WAIT_APPROVE_JOIN" && ctx.message.text === "/check_approver") {
    await sendApproveSummary(ctx, state);
    return true;
  }

  return false;
};


/* ========== callback 处理 ========== */
exports.onMerchantCallback = async (ctx) => {

  const uid = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const state = getWizard(uid);

  // 创建入口
  if (data === "merchant:create") {
    setWizard(uid, {
      step: "WAIT_GROUP_BIND",
      ownerId: uid,
      approveCandidates: []
    });
    await ctx.reply("请将机器人加入商户群，并在群里输入 /bind");
    return;
  }

  if (!state) return;

  // 使用当前审批人
  if (data === "approve:use_current") {

    await createMerchantChat({
      merchantNo: state.merchantNo,
      merchantName: state.merchantName,
      chatId: state.chatId,
      approveIds: state.approveCandidates
    });

    const approveList = state.approveCandidates
      .map((id, i) => `${i + 1}. ${id}`)
      .join("\n");

    await ctx.reply(
      `✅ 商户创建成功\n\n` +
      `商户号：${state.merchantNo}\n` +
      `商户名：${state.merchantName}\n` +
      `群ID：${state.chatId}\n\n` +
      `审批人（${state.expectedApproveCount}人）：\n${approveList}`
    );

    clearWizard(uid);
    return;
  }

  // 继续等待
  if (data === "approve:wait_more") {
    await ctx.reply("继续等待审批人加入，输入 /check_approver 查看");
    return;
  }
};

