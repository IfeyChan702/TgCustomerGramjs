const express = require('express');
const router = express.Router();
const tgMerchantService = require('../service/tgMerchantService');
const { success, fail } = require('../utils/responseWrapper');

// 查询所有商户群
router.get('/tg-merchant', async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const data = await tgMerchantService.getAllMerchants(keyword);
    res.json(success(data));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 新增商户群
router.post('/tg-merchant', async (req, res) => {
  try {
    const result = await tgMerchantService.createMerchant(req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 更新商户群
router.put('/tg-merchant/:id', async (req, res) => {
  try {
    const result = await tgMerchantService.updateMerchant(req.params.id, req.body);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

// 删除商户群
router.delete('/tg-merchant/:id', async (req, res) => {
  try {
    const result = await tgMerchantService.deleteMerchant(req.params.id);
    res.json(success(result));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
