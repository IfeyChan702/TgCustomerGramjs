const { Telegraf } = require("telegraf");
const { registerCallbackHandler } = require("../handlers/callbacks");
const { registerPrivateHandler } = require("../handlers/private");
const { registerGroupHandler } = require("../handlers/group");
const { HttpsProxyAgent } = require("https-proxy-agent");

class BotManager {
  constructor() {
    this.bots = new Map();
  }

  async startBot(config) {
    if (this.bots.has(config.id)) {
      console.log(`[BotManager] bot#${config.id}(${config.name}) already running, skip`);
      return this.bots.get(config.id);
    }

    if (!config.token) {
      console.log(`[BotManager] bot#${config.id} token is empty, skip`);
      return null;
    }

    const cleanToken = config.token.trim();
    const bot = new Telegraf(cleanToken);

    bot.catch((err) => {
      console.error(`[BotManager] bot#${config.id} runtime error:`, err.message);
    });

    bot.use(async (ctx, next) => {
      console.log(`[BOT#${config.id}-${config.name}] ${ctx.updateType}:`, ctx.message?.text);
      try {
        return await next();
      } catch (e) {
        console.error(`[BOT#${config.id}] middleware error:`, e);
      }
    });

    this._registerHandlers(bot, config.bot_type);

    try {
      const me = await bot.telegram.getMe();
      console.log(`[BotManager] bot#${config.id} getMe OK: @${me.username}`);

      const info = await bot.telegram.getWebhookInfo();
      if (info.url) {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      }

      // 不 await，让 polling 在后台跑
      bot.launch({ dropPendingUpdates: true });

      // 等一小段时间让 polling 启动
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`[BotManager] bot#${config.id}(${config.name}) started as @${me.username}`);

      const entry = { bot, config, username: me.username };
      this.bots.set(config.id, entry);
      return entry;
    } catch (e) {
      console.error(`[BotManager] bot#${config.id}(${config.name}) start failed:`, e.message);
      throw e;
    }
  }

  _registerHandlers(bot, botType) {
    switch (botType) {
      case "main":
        registerCallbackHandler(bot);
        registerGroupHandler(bot);
        registerPrivateHandler(bot);
        break;
      case "alarm":
        // alarm装用的逻辑，按需扩张
        break;
      case "custom":
        registerCallbackHandler(bot);
        registerGroupHandler(bot);
        registerPrivateHandler(bot);
        break;
      default:
        console.warn(`[BotManager] unknown bot_type: ${botType}, using default handlers`);
        registerCallbackHandler(bot);
        registerGroupHandler(bot);
        registerPrivateHandler(bot);
        break;
    }
  }

  async stopBot(id) {
    const entry = this.bots.get(id);
    if (!entry) {
      console.log(`[BotManager] bot#${id} not running`);
      return;
    }
    entry.bot.stop();
    this.bots.delete(id);
    console.log(`[BotManager] bot#${id}(${entry.config.name}) stopped`);
  }

  async restartBot(config){
    await this.stopBot(config.id);
    return await this.startBot(config);
  }

  async stopAll(){
    for (const [id] of this.bots){
      await this.stopBot(id);
    }
  }

  getBot(id){
    return this.bots.get(id)?.bot;
  }

  getBotByName(name){
    for (const [,entry] of this.bots){
      if (entry.config.name === name) return entry.bot;
    }
    return null;
  }

  getBotByType(type) {
    for (const [, entry] of this.bots) {
      if (entry.config.bot_type === type) return entry.bot;
    }
    return null;
  }

  listRunning() {
    return Array.from(this.bots.entries()).map(([id, entry]) => ({
      id,
      name: entry.config.name,
      username: entry.username,
    }));
  }
}

module.exports = new BotManager();
