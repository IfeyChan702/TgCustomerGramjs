const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const ACCESS_EXP = '20m';
const REFRESH_EXP = '14d';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');

const signAccess = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXP });
const signRefresh = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXP });

const verify = (token) => { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } };

const hashPwd = (pwd) => bcrypt.hash(pwd, 12);
const checkPwd = (pwd, hash) => bcrypt.compare(pwd, hash);

module.exports = { signAccess, signRefresh, verify, hashPwd, checkPwd };
