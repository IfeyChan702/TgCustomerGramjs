const express = require('express');
const router = express.Router();
const tgChannelService = require('../service/tgChannelService');
const { success, fail } = require('../utils/responseWrapper');

// 查询所有渠道群（支持关键词模糊搜索）
router.get('/tg-channel', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgChannelService.getAllChannels(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 新增渠道群
router.post('/tg-channel', async (req, res) => {
  try {
    const result = await tgChannelService.createChannel(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 更新渠道群
router.put('/tg-channel/:id', async (req, res) => {
  try {
    const result = await tgChannelService.updateChannel(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 删除渠道群
router.delete('/tg-channel/:id', async (req, res) => {
  try {
    const result = await tgChannelService.deleteChannel(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

//查询渠道（id，渠道名称）
router.get('/tg-channel/list',async (req,res) => {
  try {
    const result = await tgChannelService.getAllChannelForSelect();
    res.json(success(result));
  }catch (err){
    res.json(fail(err.message));
  }
})

module.exports = router;
