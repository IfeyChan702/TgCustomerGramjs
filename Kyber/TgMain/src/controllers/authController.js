exports.login = async (req, res) => {
  const { username, password } = req.body;

  // 账号校验
  if (username === 'admin' && password === 'ant.design') {
    // 返回 Ant Design Pro 兼容格式
    return res.json({
      status: 'ok',
      type: 'account',
      currentAuthority: 'admin',
    });
  }

  // 校验失败
  return res.json({
    status: 'error',
    type: 'account',
    currentAuthority: 'guest',
    msg: '账号或密码错误'
  });
};


exports.logout = (req, res) => {
  res.json({ data: {}, success: true });
};