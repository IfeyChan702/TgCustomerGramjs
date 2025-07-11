const express = require('express');
const router = express.Router();
const { success, fail } = require('../utils/responseWrapper');

/**
 * @swagger
 * /open/test:
 *   get:
 *     summary: 测试接口
 *     tags:
 *       - Open
 *     description: 返回 test 测试字符串，校验 API 通畅。
 *     responses:
 *       200:
 *         description: 返回成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: string
 *                   example: "test"
 *                 errorMessage:
 *                   type: string
 *                   nullable: true
 *                   example: null
 */
router.get('/open/test', async (req, res) => {
  try {
    res.json(success("test"));
  } catch (err) {
    res.json(fail(err.message));
  }
});

module.exports = router;
