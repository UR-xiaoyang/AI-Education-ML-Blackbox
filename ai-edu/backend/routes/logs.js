const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('./auth');

const router = express.Router();

/**
 * 记录操作日志
 */
function logOperation(userId, action, targetType, targetId, details, req) {
  const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  db.prepare(`
    INSERT INTO operation_logs (user_id, action, target_type, target_id, details, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress, userAgent);
}

/**
 * GET /api/logs
 * 获取操作日志列表（仅管理员）
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '1=1';
    const params = [];

    if (action) {
      whereClause += ' AND ol.action LIKE ?';
      params.push(`%${action}%`);
    }

    if (userId) {
      whereClause += ' AND ol.user_id = ?';
      params.push(parseInt(userId));
    }

    if (startDate) {
      whereClause += ' AND ol.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND ol.created_at <= ?';
      params.push(endDate);
    }

    // 获取总数
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM operation_logs ol WHERE ${whereClause}
    `).get(...params);

    // 获取日志列表
    const logs = db.prepare(`
      SELECT ol.*, u.username, u.display_name, u.role
      FROM operation_logs ol
      LEFT JOIN users u ON ol.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ol.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // 解析 details JSON
    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取操作日志错误:', error);
    res.status(500).json({ error: '获取操作日志失败' });
  }
});

/**
 * GET /api/logs/user/:userId
 * 获取指定用户的操作日志
 */
router.get('/user/:userId', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 教师只能查看自己班级的学生日志
    if (req.user.role === 'teacher') {
      const studentIds = db.prepare(`
        SELECT DISTINCT om.user_id FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE o.owner_id = ?
      `).all(req.user.userId).map(r => r.user_id);

      if (!studentIds.includes(parseInt(userId))) {
        return res.status(403).json({ error: '无权查看该用户的日志' });
      }
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM operation_logs WHERE user_id = ?
    `).get(parseInt(userId));

    const logs = db.prepare(`
      SELECT * FROM operation_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(userId), parseInt(limit), offset);

    const formattedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }));

    res.json({
      logs: formattedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取用户操作日志错误:', error);
    res.status(500).json({ error: '获取用户操作日志失败' });
  }
});

/**
 * GET /api/logs/stats
 * 获取操作统计
 */
router.get('/stats', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // 近 N 天的操作统计
    const dailyStats = db.prepare(`
      SELECT date(created_at) as date, action, COUNT(*) as count
      FROM operation_logs
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at), action
      ORDER BY date DESC, action
    `).all(parseInt(days));

    // 用户操作排行
    const userStats = db.prepare(`
      SELECT ol.user_id, u.username, u.display_name, COUNT(*) as count
      FROM operation_logs ol
      LEFT JOIN users u ON ol.user_id = u.id
      WHERE ol.created_at >= date('now', '-' || ? || ' days')
      GROUP BY ol.user_id
      ORDER BY count DESC
      LIMIT 10
    `).all(parseInt(days));

    // 热门操作排行
    const actionStats = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM operation_logs
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY action
      ORDER BY count DESC
      LIMIT 20
    `).all(parseInt(days));

    // 总操作数
    const totalCount = db.prepare(`
      SELECT COUNT(*) as total FROM operation_logs
      WHERE created_at >= date('now', '-' || ? || ' days')
    `).get(parseInt(days));

    res.json({
      dailyStats,
      userStats,
      actionStats,
      totalCount: totalCount.total,
      days: parseInt(days)
    });
  } catch (error) {
    console.error('获取操作统计错误:', error);
    res.status(500).json({ error: '获取操作统计失败' });
  }
});

/**
 * GET /api/logs/actions
 * 获取所有操作类型列表
 */
router.get('/actions', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const actions = db.prepare(`
      SELECT DISTINCT action FROM operation_logs ORDER BY action
    `).all().map(r => r.action);

    res.json({ actions });
  } catch (error) {
    console.error('获取操作类型错误:', error);
    res.status(500).json({ error: '获取操作类型失败' });
  }
});

/**
 * DELETE /api/logs/cleanup
 * 清理旧的日志（仅管理员）
 */
router.delete('/cleanup', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const result = db.prepare(`
      DELETE FROM operation_logs
      WHERE created_at < date('now', '-' || ? || ' days')
    `).run(parseInt(days));

    res.json({
      message: `已清理 ${result.changes} 条日志`,
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('清理日志错误:', error);
    res.status(500).json({ error: '清理日志失败' });
  }
});

// 导出 logOperation 函数供其他路由使用
module.exports = { router, logOperation };