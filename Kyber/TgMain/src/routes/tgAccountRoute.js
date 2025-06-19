const express = require('express');
const router = express.Router();
const tgAccountService = require('../service/tgAccountService');
const { success, fail } = require('../utils/responseWrapper');

// 查询所有账户（支持关键词模糊查询）
router.get('/tg-accounts', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgAccountService.getAllAccounts(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 新增账户
router.post('/tg-accounts', async (req, res) => {
  try {
    const result = await tgAccountService.createAccount(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 更新账户（通过 registerId）
router.put('/tg-accounts/:registerId', async (req, res) => {
  try {
    const result = await tgAccountService.updateAccount(req.params.registerId, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 删除账户（通过 registerId）
router.delete('/tg-accounts/:registerId', async (req, res) => {
  try {
    const result = await tgAccountService.deleteAccount(req.params.registerId);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
