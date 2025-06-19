const express = require('express');
const router = express.Router();
const tgReplyService = require('../service/tgReplyService');
const { success, fail } = require('../utils/responseWrapper');

// 查询所有语料
router.get('/tg-reply', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgReplyService.getAllReplies(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 新增语料
router.post('/tg-reply', async (req, res) => {
  try {
    const result = await tgReplyService.createReply(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 更新语料
router.put('/tg-reply/:id', async (req, res) => {
  try {
    const result = await tgReplyService.updateReply(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 删除语料
router.delete('/tg-reply/:id', async (req, res) => {
  try {
    const result = await tgReplyService.deleteReply(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
