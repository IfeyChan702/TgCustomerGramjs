// routes/createCard.js
const express = require("express");
const { setReviewers } = require("../../service/system/reviewStore");
const { approveKeyboard, formatCard } = require("../../service/system/ui");

function createCardRouter(bot) {
  const router = express.Router();

  router.post("/create_card", async (req, res) => {
    const { chat_id, merchant_id, order_id, amount, user_display, reviewer_ids = [] } = req.body;

    try {
      await setReviewers(order_id, reviewer_ids);

      const msg = await bot.telegram.sendMessage(
        chat_id,
        formatCard(order_id, amount, user_display),
        { parse_mode: "HTML", ...approveKeyboard(order_id, merchant_id) }
      );

      res.json({ ok: true, chat_id, message_id: msg.message_id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createCardRouter };
