const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/responseWrapper');
// 查询所有账户（支持关键词模糊查询）
router.get('/open/test', async (req, res) => {
  try {
    res.json(success("test"));
  } catch (err) {
    res.json(fail(err.message));
  }
});
