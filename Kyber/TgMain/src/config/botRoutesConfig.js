const createWithdrawalsRouter = require("../routes/system/withdrawalsRoutes");


const BOT_ROUTES = {

  customerBot: [createWithdrawalsRouter],
  alarmBotToken: []
};


module.exports = { BOT_ROUTES };
