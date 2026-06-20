const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'ai-edu-backend'
  });
}

/**
 * 验证 Token 是否在黑名单中 (使用 SQLite)
 */
function isTokenBlacklisted(jti) {
  if (!jti) return false;
  const result = db.prepare('SELECT 1 FROM token_blacklist WHERE token_jti = ?').get(jti);
  return !!result;
}

/**
 * 认证中间件 - 验证 JWT Token
 * 附加 req.user 和 req.tokenInfo
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];

    // 验证 Token 签名和过期时间
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'ai-edu-backend' });

    // 检查 Token 是否在黑名单中
    if (decoded.jti && isTokenBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: '令牌已失效，请重新登录' });
    }

    // 附加用户信息到请求对象
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      email: decoded.email
    };
    req.tokenInfo = {
      jti: decoded.jti,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期，请重新登录' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的令牌' });
    }
    console.error('认证中间件错误:', error);
    return res.status(500).json({ error: '认证检查失败' });
  }
}

/**
 * 角色授权中间件
 * 用法: requireRole('admin', 'teacher')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: '权限不足',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * 检查用户是否已登录中间件
 * 已登录则跳转到首页，未登录继续
 */
function ifAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'ai-edu-backend' });
    // Token 有效，跳过登录页
    return res.status(200).json({
      authenticated: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        email: decoded.email
      }
    });
  } catch (error) {
    // Token 无效，继续到登录页
    return next();
  }
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  generateToken,
  authenticate,
  requireRole,
  ifAuthenticated,
  isTokenBlacklisted
};
