const express = require('express');
const { initRegister, submitPhone, submitCode, getStatus } = require('../service/tgRegisterService');
const { getGroupsByRegisterId } = require('../service/tgGroupService');
const { success, fail } = require('../utils/responseWrapper');

const router = express.Router();

router.post('/register/init', initRegister);
router.post('/register/phone', submitPhone);
router.post('/register/code', submitCode);
router.get('/register/status', getStatus);

//  测试用：通过 apiId 获取群组
router.get('/groups', async (req, res) => {
  const { registerId } = req.query;
  if (!registerId)
    return res.json(fail(err));

  try {
    const groups = await getGroupsByRegisterId(registerId);
    res.json(success(groups));
  } catch (err) {
    console.error('[ERROR][/groups]', err);
    res.json(fail(err));
  }
});

module.exports = router;
