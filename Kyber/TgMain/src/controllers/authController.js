const db = require('../models/mysqlModel');
const svgCaptcha = require('svg-captcha');

exports.login = (req, res) => {
  const { username, password, captcha } = req.body;

  const sessionCaptcha = req.session?.captcha;

  if (!captcha || captcha.toLowerCase() !== sessionCaptcha) {
    return res.status(400).json({
      status: 'error',
      type: 'account',
      currentAuthority: 'guest',
      msg: '验证码错误',
    });
  }

  // 清除验证码（防止复用）
  req.session.captcha = null;

  const sql = 'SELECT * FROM login_users WHERE username = ? AND password = ? LIMIT 1';
  db.query(sql, [username, password], (err, results) => {
    if (err) {
      console.error('Login DB error:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (results.length === 1) {
      const user = results[0];
      return res.json({
        status: 'ok',
        type: 'account',
        currentAuthority: user.access,
      });
    }

    return res.json({
      status: 'error',
      type: 'account',
      currentAuthority: 'guest',
      msg: '账号或密码错误',
    });
  });
};

exports.getCurrentUser = (req, res) => {
  const userId = req.query.userId || 1; // 从 token/session 取更好

  const sql = 'SELECT nickname AS name, avatar, email, access FROM login_users WHERE id = ?';
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('GetCurrentUser DB error:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (results.length === 1) {
      return res.json({ data: results[0] });
    }

    res.status(404).json({ error: '用户未找到' });
  });
};

exports.getRules = (req, res) => {
  res.json({
    data: [
      {
        key: 99,
        disabled: false,
        href: 'https://ant.design',
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/udxAbMEhpwthVVcjLXik.png',
        name: 'TradeCode 99',
        owner: '曲丽丽',
        desc: '这是一段描述',
        callNo: 503,
        status: '0',
        updatedAt: '2022-12-06T05:00:57.040Z',
        createdAt: '2022-12-06T05:00:57.040Z',
        progress: 81,
      },
    ],
    total: 100,
    success: true,
    pageSize: 20,
    current: 1,
  });
};

exports.logout = (req, res) => {
  res.json({ data: {}, success: true });
};

exports.getCaptcha = (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#cc9966',
    ignoreChars: '0o1ilI', // 避免容易混淆的字符
    width: 100,
    height: 40,
  });

  // 保存验证码到 session（或者 Redis），这里用内存存储演示
  req.session = req.session || {};
  req.session.captcha = captcha.text.toLowerCase();

  res.type('svg');
  res.status(200).send(captcha.data);
};
