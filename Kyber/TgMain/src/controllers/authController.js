const db = require('../models/mysqlModel');
const svgCaptcha = require('svg-captcha');
const jwt = require('jsonwebtoken');

// 从环境变量中读取 JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined in the environment variables!');
  // 在生产环境中，应该抛出错误或终止进程
  // process.exit(1);
}

/**
 * 用户登录，生成并返回JWT
 */
exports.login = (req, res) => {
  const { username, password, captcha } = req.body;

  // 1. 验证码校验
  const sessionCaptcha = req.session?.captcha;
  if (!captcha || captcha.toLowerCase() !== sessionCaptcha) {
    return res.status(400).json({
      status: 'error',
      type: 'account',
      currentAuthority: 'guest',
      msg: '验证码错误',
    });
  }
  req.session.captcha = null;

  // 2. 查询用户，验证账号密码
  const userSql = 'SELECT * FROM login_users WHERE username = ? AND password = ? LIMIT 1';
  db.query(userSql, [username, password], (err, userResults) => {
    if (err) {
      console.error('Login DB error:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (userResults.length === 0) {
      return res.json({
        status: 'error',
        type: 'account',
        currentAuthority: 'guest',
        msg: '账号或密码错误',
      });
    }

    const user = userResults[0];

    // 3. 获取用户角色和权限列表
    const roleSql = 'SELECT * FROM login_roles WHERE role_key = ? LIMIT 1';
    db.query(roleSql, [user.access], (err, roleResults) => {
      if (err || roleResults.length === 0) {
        console.error('Role DB error:', err);
        return res.status(500).json({ error: '无法获取用户角色' });
      }

      const role = roleResults[0];
      const permissionsSql = `
        SELECT T2.perm_key FROM login_role_permissions AS T1
        JOIN login_permissions AS T2 ON T1.permission_id = T2.id
        WHERE T1.role_id = ?
      `;

      db.query(permissionsSql, [role.id], (err, permissions) => {
        if (err) {
          console.error('Permissions DB error:', err);
          return res.status(500).json({ error: '无法获取用户权限' });
        }

        const permissionList = permissions.map(p => p.perm_key);

        // 4. 生成JWT，包含用户ID、角色和权限列表
        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            access: user.access,
            permissions: permissionList
          },
          JWT_SECRET,
          { expiresIn: '1h' } // 设置Token过期时间
        );

        // 5. 返回JWT给前端
        res.json({
          status: 'ok',
          type: 'account',
          currentAuthority: user.access,
          token: token,
          data: {
            name: user.nickname,
            avatar: user.avatar,
            access: user.access,
            email: user.email,
          }
        });
      });
    });
  });
};

/**
 * 获取当前用户信息（从JWT中解析，前提是中间件已验证）
 */
exports.getCurrentUser = (req, res) => {
  if (req.user) {
    const { id, nickname, avatar, email, access } = req.user;
    return res.json({
      data: {
        id,
        name: nickname,
        avatar,
        email,
        access
      }
    });
  }
  res.status(404).json({ error: '用户未找到或未登录' });
};

/**
 * 获取当前用户的权限规则列表（从JWT中解析）
 */
exports.getRules = (req, res) => {
  if (req.user && req.user.permissions) {
    const rules = req.user.permissions.map(perm => ({
      key: perm,
      name: perm
    }));
    return res.json({ data: rules, success: true });
  }
  res.json({ data: [], success: true });
};

/**
 * 登出（前端删除JWT即可）
 */
exports.logout = (req, res) => {
  res.json({ data: {}, success: true });
};

/**
 * 生成验证码
 */
exports.getCaptcha = (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    color: true,
    background: '#cc9966',
    ignoreChars: '0o1ilI',
    width: 100,
    height: 40,
  });

  req.session = req.session || {};
  req.session.captcha = captcha.text.toLowerCase();

  res.type('svg');
  res.status(200).send(captcha.data);
};
