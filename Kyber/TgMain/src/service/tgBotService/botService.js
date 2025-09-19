const { Markup } = require('telegraf');

const mainReplyKeyboard = () =>
  Markup.keyboard([['📋 菜单', 'ℹ️ 关于'], ['🧹 隐藏按钮']]).resize().oneTime();

const mainInlineKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('👋 打个招呼', 'HELLO'), Markup.button.callback('🧮 做个计算', 'CALC')],
    [Markup.button.url('🔗 打开官网', 'https://core.telegram.org/bots')],
    [Markup.button.callback('❓ 二次确认示例', 'CONFIRM_PROMPT')]
  ]);

const calcInlineKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('再来一个 🧮', 'CALC'), Markup.button.callback('回主菜单 📋', 'BACK_TO_MENU')]
  ]);

const confirmInlineKeyboard = () =>
  Markup.inlineKeyboard([[Markup.button.callback('✅ 确认执行', 'CONFIRM_YES'), Markup.button.callback('❌ 取消', 'CONFIRM_NO')]]);

function registerCommandHandlers(bot) {
  bot.start((ctx) =>
    ctx.reply(
      `嗨，${ctx.from.first_name || '朋友'}！\n这是一个模块化的按钮机器人示例：`,
      mainReplyKeyboard()
    )
  );

  bot.help((ctx) => ctx.reply('发送 /start 试试，或点“📋 菜单”。'));
}
