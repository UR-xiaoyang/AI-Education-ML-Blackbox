const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const TURNSTILE_CONFIG = require('../config/turnstile');
const { getBooleanSetting, getTurnstileSecretKey } = require('../settings');

// 日志功能（延迟加载以避免循环依赖）
let logOperation = null;
function getLogOperation() {
  if (!logOperation) {
    logOperation = require('./logs').logOperation;
  }
  return logOperation;
}

const router = express.Router();

// SALT_ROUNDS for bcrypt
const SALT_ROUNDS = 12;

// JWT Secret - MUST be set via environment variable in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  console.warn('WARNING: Using insecure default JWT_SECRET. Set JWT_SECRET env var in production!');
}
const effectiveJWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Rate limiters for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limit for localhost in development
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    return host.includes('localhost') || host.includes('127.0.0.1');
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  message: { error: '注册过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    return host.includes('localhost') || host.includes('127.0.0.1');
  }
});

// Check if request is from localhost (skip Turnstile verification)
const isLocalhost = (req) => {
  const localhostIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const ip = req.ip || req.connection.remoteAddress || '';

  return (
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    localhostIps.includes(ip) ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  );
};

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      jti: Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
    },
    effectiveJWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'ai-edu-backend',
      algorithm: 'HS256'
    }
  );
}

/**
 * 检查 Token 是否在黑名单
 */
function isTokenBlacklisted(jti) {
  const result = db.prepare('SELECT 1 FROM token_blacklist WHERE token_jti = ?').get(jti);
  return !!result;
}

/**
 * 验证 Cloudflare Turnstile token
 */
async function verifyTurnstileToken(token, remoteIp = null) {
  // If Turnstile is not configured, skip verification
  const secretKey = getTurnstileSecretKey();
  if (!secretKey) {
    console.warn('Turnstile secret key not configured, skipping verification');
    return true;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await fetch(TURNSTILE_CONFIG.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile 验证错误:', error);
    return false;
  }
}

function shouldVerifyTurnstile(req) {
  return getBooleanSetting('turnstile_enabled') && !isLocalhost(req);
}

async function requireValidTurnstile(req, res, turnstileToken) {
  if (!shouldVerifyTurnstile(req)) {
    return true;
  }

  if (!getTurnstileSecretKey()) {
    res.status(500).json({ error: '人机验证服务未配置，请在系统设置中填写 Turnstile Secret Key' });
    return false;
  }

  if (!turnstileToken) {
    res.status(400).json({ error: '人机验证未通过，请刷新页面重试' });
    return false;
  }

  const isValidToken = await verifyTurnstileToken(turnstileToken, req.ip);
  if (!isValidToken) {
    res.status(400).json({ error: '人机验证失败，请重试' });
    return false;
  }

  return true;
}

/**
 * 认证中间件
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, effectiveJWT_SECRET, { issuer: 'ai-edu-backend', algorithms: ['HS256'] });

    // 检查 Token 是否在黑名单
    if (decoded.jti && isTokenBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: '令牌已失效，请重新登录' });
    }

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
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

/**
 * POST /api/auth/register
 * 注册新用户
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, displayName, turnstileToken } = req.body;
    const role = 'student';

    if (!getBooleanSetting('allow_registration')) {
      return res.status(403).json({ error: '系统暂未开放新用户注册，请联系管理员创建账号' });
    }

    if (!(await requireValidTurnstile(req, res, turnstileToken))) {
      return;
    }

    // 验证必填字段
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码是必填项' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: '用户名长度应在 3-50 个字符之间' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为 6 个字符' });
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      return res.status(409).json({ error: '用户名或邮箱已被注册' });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const result = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)`
    ).run(username, email, passwordHash, role, displayName || username);

    const newUser = {
      id: result.lastInsertRowid,
      username,
      email,
      role,
      display_name: displayName || username
    };

    const token = generateToken(newUser);

    // 记录注册日志
    getLogOperation()(newUser.id, 'REGISTER', 'user', newUser.id, { username, email, role }, req);

    res.status(201).json({
      message: '注册成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        displayName: newUser.display_name
      },
      token
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, turnstileToken } = req.body;

    if (!(await requireValidTurnstile(req, res, turnstileToken))) {
      return;
    }

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码是必填项' });
    }

    // 查找用户
    const user = db.prepare(
      'SELECT id, username, email, password_hash, role, display_name, is_active FROM users WHERE username = ? OR email = ?'
    ).get(username, username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: '账号已被禁用，请联系系统管理员' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新 last_login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const token = generateToken(user);

    // 记录登录日志
    getLogOperation()(user.id, 'LOGIN', 'user', user.id, { username: user.username }, req);

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name
      },
      token
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = db.prepare(
      'SELECT id, username, email, role, display_name, created_at, last_login FROM users WHERE id = ?'
    ).get(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/auth/password
 * 修改密码
 */
router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写所有字段' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少为 6 个字符' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, req.user.userId);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

/**
 * PUT /api/auth/profile
 * 更新个人资料
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { displayName, email } = req.body;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '请输入有效的邮箱地址' });
      }
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.userId);
      if (existingEmail) {
        return res.status(409).json({ error: '邮箱已被其他用户使用' });
      }
    }

    if (displayName) {
      db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, req.user.userId);
    }
    if (email) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, req.user.userId);
    }

    const user = db.prepare('SELECT id, username, email, role, display_name FROM users WHERE id = ?').get(req.user.userId);

    res.json({
      message: '资料更新成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name
      }
    });
  } catch (error) {
    console.error('更新资料错误:', error);
    res.status(500).json({ error: '更新资料失败' });
  }
});

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { jti, exp } = req.tokenInfo;
    const expiresAt = new Date(exp * 1000).toISOString();
    db.prepare('INSERT INTO token_blacklist (token_jti, expires_at) VALUES (?, ?)').run(jti, expiresAt);

    // 记录登出日志
    getLogOperation()(req.user.userId, 'LOGOUT', 'user', req.user.userId, { username: req.user.username }, req);

    res.json({ message: '登出成功' });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

/**
 * GET /api/auth/users
 * 获取用户列表（包含使用统计）
 */
router.get('/users', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, username, email, role, display_name, is_active, created_at, last_login FROM users WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // 获取总数
    const countQuery = query.replace('SELECT id, username, email, role, display_name, is_active, created_at, last_login', 'SELECT COUNT(*)');
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult['COUNT(*)'];

    // 分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = db.prepare(query).all(...params);

    // 获取每个用户的使用统计
    const usersWithStats = users.map(u => {
      const totalDuration = db.prepare(
        `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM usage_stats WHERE user_id = ?`
      ).get(u.id);

      const totalTokens = db.prepare(
        `SELECT COALESCE(SUM(tokens_used), 0) as total FROM token_usage WHERE user_id = ?`
      ).get(u.id);

      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        displayName: u.display_name,
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        totalDurationSeconds: totalDuration.total,
        totalTokens: totalTokens.total
      };
    });

    res.json({
      users: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * PUT /api/auth/users/:id/role
 * 更新用户角色 (仅管理员)
 */
router.put('/users/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 记录角色更新日志
    getLogOperation()(req.user.userId, 'UPDATE_ROLE', 'user', parseInt(id), { newRole: role }, req);

    res.json({ message: '角色更新成功' });
  } catch (error) {
    console.error('更新角色错误:', error);
    res.status(500).json({ error: '更新角色失败' });
  }
});

/**
 * POST /api/auth/admin/users
 * 管理员创建用户账号
 */
router.post('/admin/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { username, email, password, displayName, role = 'student' } = req.body;

    // 验证必填字段
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码是必填项' });
    }
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: '用户名长度应在 3-50 个字符之间' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为 6 个字符' });
    }
    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 检查用户名和邮箱是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      return res.status(409).json({ error: '用户名或邮箱已被注册' });
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const result = db.prepare(
      `INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)`
    ).run(username, email, passwordHash, role, displayName || username);

    // 记录管理员创建用户日志
    getLogOperation()(req.user.userId, 'ADMIN_CREATE_USER', 'user', result.lastInsertRowid, { createdUsername: username, createdRole: role }, req);

    res.status(201).json({
      message: '用户创建成功',
      user: {
        id: result.lastInsertRowid,
        username,
        email,
        role,
        displayName: displayName || username
      }
    });

  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '创建用户失败，请稍后重试' });
  }
});

/**
 * POST /api/auth/usage/record
 * 记录使用时长和 Token 消耗
 */
router.post('/usage/record', authenticate, async (req, res) => {
  try {
    const { durationSeconds, tokensUsed, actionType } = req.body;
    const userId = req.user.userId;

    // 记录使用时长
    if (durationSeconds && durationSeconds > 0) {
      db.prepare(
        `INSERT INTO usage_stats (user_id, session_type, duration_seconds) VALUES (?, ?, ?)`
      ).run(userId, actionType || 'learning', durationSeconds);
    }

    // 记录 Token 消耗
    if (tokensUsed && tokensUsed > 0) {
      db.prepare(
        `INSERT INTO token_usage (user_id, action_type, tokens_used) VALUES (?, ?, ?)`
      ).run(userId, actionType || 'general', tokensUsed);
    }

    res.json({ message: '使用记录已保存' });
  } catch (error) {
    console.error('记录使用错误:', error);
    res.status(500).json({ error: '记录使用失败' });
  }
});

/**
 * GET /api/auth/usage/stats
 * 获取当前用户的使用统计
 */
router.get('/usage/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 获取总使用时长（秒）
    const totalDuration = db.prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM usage_stats WHERE user_id = ?`
    ).get(userId);

    // 获取总 Token 消耗
    const totalTokens = db.prepare(
      `SELECT COALESCE(SUM(tokens_used), 0) as total FROM token_usage WHERE user_id = ?`
    ).get(userId);

    // 获取最近 7 天的使用情况
    const recentUsage = db.prepare(
      `SELECT recorded_date, SUM(duration_seconds) as duration
       FROM usage_stats
       WHERE user_id = ? AND recorded_date >= date('now', '-7 days')
       GROUP BY recorded_date
       ORDER BY recorded_date DESC`
    ).all(userId);

    // 获取 Token 使用按类型统计
    const tokenByType = db.prepare(
      `SELECT action_type, SUM(tokens_used) as total
       FROM token_usage
       WHERE user_id = ?
       GROUP BY action_type`
    ).all(userId);

    res.json({
      totalDurationSeconds: totalDuration.total,
      totalTokens: totalTokens.total,
      recentUsage,
      tokenByType
    });
  } catch (error) {
    console.error('获取使用统计错误:', error);
    res.status(500).json({ error: '获取使用统计失败' });
  }
});

/**
 * PUT /api/auth/users/:id/status
 * 启用/禁用用户 (仅管理员)
 */
router.put('/users/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: '不能修改自己的账号状态' });
    }

    const result = db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 记录账号状态变更日志
    getLogOperation()(req.user.userId, isActive ? 'ENABLE_USER' : 'DISABLE_USER', 'user', parseInt(id), { isActive }, req);

    res.json({ message: isActive ? '账号已启用' : '账号已禁用' });
  } catch (error) {
    console.error('更新账号状态错误:', error);
    res.status(500).json({ error: '更新账号状态失败' });
  }
});

module.exports = { router, authenticate, requireRole };
