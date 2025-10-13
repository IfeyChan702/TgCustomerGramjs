const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined!');
  process.exit(1);
}

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      msg: '未授权，请提供有效的Token',
      currentAuthority: 'guest',
    });
  }

  const token = authHeader.slice(7);
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        status: 'error',
        msg: 'Token无效或已过期',
        currentAuthority: 'guest',
      });
    }
    req.user = decoded;
    next();
  });
};

// 同时兼容 perms / permissions 两种字段
exports.checkPermission = (permissionKey) => {
  return (req, res, next) => {
    const list = req.user?.permissions || req.user?.perms || [];
    if (!Array.isArray(list) || !list.includes(permissionKey)) {
      return res.status(403).json({
        status: 'error',
        msg: '无权访问',
        currentAuthority: 'guest',
      });
    }
    next();
  };
};
