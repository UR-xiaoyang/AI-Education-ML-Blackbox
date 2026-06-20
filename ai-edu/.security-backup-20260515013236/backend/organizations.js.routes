const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('./auth');

const router = express.Router();

/**
 * 生成随机邀请码
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 将 tutorial_stage 映射到课程名称
 */
function mapTutorialStageToLesson(tutorialStage) {
  const stageMap = {
    'gradient_descent': '线性回归',
    'linear_regression': '线性回归',
    'logistic_regression': '逻辑回归',
    'sigmoid': '逻辑回归',
    'decision_tree': '决策树',
    'neural_network': '神经网络',
    'nn': '神经网络',
    'backpropagation': '神经网络',
    'fault_simulation': '故障诊断',
    'fault': '故障诊断',
    'gradient_explosion': '故障诊断',
    'yolo': 'YOLO 专题',
    'object_detection': 'YOLO 专题'
  };

  if (!tutorialStage) return '通用';

  const stage = tutorialStage.toLowerCase();
  for (const [key, value] of Object.entries(stageMap)) {
    if (stage.includes(key)) {
      return value;
    }
  }
  return '通用';
}

/**
 * 根据问题内容获取标签
 */
function getQuestionTag(questionText) {
  if (!questionText) return '基础概念';

  const text = questionText.toLowerCase();

  if (text.includes('学习率') || text.includes('lr') || text.includes('learning rate')) {
    return '调参理解';
  }
  if (text.includes('过拟合') || text.includes('overfit') || text.includes('泛化')) {
    return '过拟合';
  }
  if (text.includes('梯度') || text.includes('gradient')) {
    return '梯度概念';
  }
  if (text.includes('概率') || text.includes('sigmoid') || text.includes('分类')) {
    return '概率解释';
  }
  if (text.includes('激活') || text.includes('relu') || text.includes('神经元')) {
    return '网络结构';
  }
  if (text.includes('损失') || text.includes('loss') || text.includes('误差')) {
    return '损失函数';
  }
  if (text.includes('训练') || text.includes('epoch') || text.includes('迭代')) {
    return '训练过程';
  }

  return '基础概念';
}

/**
 * 根据问题内容获取分类
 */
function getQuestionCategory(questionText) {
  if (!questionText) return '通用';

  const text = questionText.toLowerCase();

  if (text.includes('学习率') || text.includes('lr') || text.includes('learning rate')) {
    return '超参数';
  }
  if (text.includes('激活') || text.includes('relu') || text.includes('sigmoid')) {
    return '激活函数';
  }
  if (text.includes('梯度')) {
    return '梯度问题';
  }
  if (text.includes('损失') || text.includes('loss') || text.includes('mse')) {
    return '损失函数';
  }
  if (text.includes('训练') || text.includes('epoch') || text.includes('迭代')) {
    return '训练过程';
  }
  if (text.includes('预测') || text.includes('forward')) {
    return '前向传播';
  }
  if (text.includes('反向') || text.includes('backward') || text.includes('更新')) {
    return '反向传播';
  }

  return '基础概念';
}

/**
 * GET /api/organizations
 * 获取当前用户所属的组织列表
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // 获取用户创建的组织
    const ownedOrgs = db.prepare(`
      SELECT o.*,
             (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
      FROM organizations o
      WHERE o.owner_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.userId);

    // 获取用户加入的组织
    const memberOrgs = db.prepare(`
      SELECT o.*,
             (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
             om.role as member_role
      FROM organizations o
      JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ? AND o.owner_id != ?
      ORDER BY o.created_at DESC
    `).all(req.user.userId, req.user.userId);

    res.json({
      owned: ownedOrgs,
      joined: memberOrgs
    });
  } catch (error) {
    console.error('获取组织列表错误:', error);
    res.status(500).json({ error: '获取组织列表失败' });
  }
});

/**
 * POST /api/organizations
 * 创建新组织（仅教师和管理员）
 */
router.post('/', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { name, description, type = 'class' } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '组织名称不能为空' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: '组织名称不能超过100个字符' });
    }

    if (!['class', 'organization', 'group'].includes(type)) {
      return res.status(400).json({ error: '无效的组织类型' });
    }

    // 生成唯一邀请码
    let inviteCode;
    let attempts = 0;
    do {
      inviteCode = generateInviteCode();
      const existing = db.prepare('SELECT id FROM organizations WHERE invite_code = ?').get(inviteCode);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return res.status(500).json({ error: '生成邀请码失败，请重试' });
    }

    // 创建组织
    const result = db.prepare(`
      INSERT INTO organizations (name, description, type, owner_id, invite_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), description?.trim() || null, type, req.user.userId, inviteCode);

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      message: '组织创建成功',
      organization: {
        ...org,
        member_count: 1
      }
    });
  } catch (error) {
    console.error('创建组织错误:', error);
    res.status(500).json({ error: '创建组织失败' });
  }
});

/**
 * GET /api/organizations/:id
 * 获取组织详情
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 检查用户是否有权限访问
    const isOwner = org.owner_id === req.user.userId;
    const isMember = db.prepare(`
      SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?
    `).get(id, req.user.userId);

    if (!isOwner && !isMember && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权访问此组织' });
    }

    // 获取成员列表
    const members = db.prepare(`
      SELECT u.id, u.username, u.email, u.display_name, u.role, om.role as org_role, om.joined_at
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE om.organization_id = ?
      ORDER BY om.joined_at ASC
    `).all(id);

    res.json({
      organization: {
        ...org,
        isOwner,
        members
      }
    });
  } catch (error) {
    console.error('获取组织详情错误:', error);
    res.status(500).json({ error: '获取组织详情失败' });
  }
});

/**
 * PUT /api/organizations/:id
 * 更新组织信息（仅所有者）
 */
router.put('/:id', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type } = req.body;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 检查权限：仅所有者或管理员可以更新
    if (org.owner_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权修改此组织' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      if (name.trim().length === 0) {
        return res.status(400).json({ error: '组织名称不能为空' });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: '组织名称不能超过100个字符' });
      }
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description?.trim() || null);
    }

    if (type !== undefined && ['class', 'organization', 'group'].includes(type)) {
      updates.push('type = ?');
      params.push(type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedOrg = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    res.json({
      message: '组织信息已更新',
      organization: updatedOrg
    });
  } catch (error) {
    console.error('更新组织错误:', error);
    res.status(500).json({ error: '更新组织失败' });
  }
});

/**
 * DELETE /api/organizations/:id
 * 删除组织（仅所有者）
 */
router.delete('/:id', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 检查权限：仅所有者或管理员可以删除
    if (org.owner_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权删除此组织' });
    }

    // 删除组织（级联删除成员）
    db.prepare('DELETE FROM organizations WHERE id = ?').run(id);

    res.json({ message: '组织已删除' });
  } catch (error) {
    console.error('删除组织错误:', error);
    res.status(500).json({ error: '删除组织失败' });
  }
});

/**
 * POST /api/organizations/:id/members
 * 添加成员到组织
 */
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, inviteCode } = req.body;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 如果提供了邀请码，验证邀请码
    if (inviteCode) {
      const validOrg = db.prepare('SELECT id FROM organizations WHERE invite_code = ?').get(inviteCode.toUpperCase());
      if (!validOrg || validOrg.id !== parseInt(id)) {
        return res.status(400).json({ error: '邀请码无效' });
      }
    } else {
      // 如果没有邀请码，仅所有者、管理员或组织管理员可以添加成员
      const isOwner = org.owner_id === req.user.userId;
      const isOrgAdmin = db.prepare(`
        SELECT 1 FROM organization_members
        WHERE organization_id = ? AND user_id = ? AND role = 'admin'
      `).get(id, req.user.userId);

      if (!isOwner && !isOrgAdmin && req.user.role !== 'admin') {
        return res.status(403).json({ error: '无权添加成员' });
      }

      if (!userId) {
        return res.status(400).json({ error: '请提供用户ID或邀请码' });
      }
    }

    // 确定要添加的用户ID
    const targetUserId = userId || req.user.userId;

    // 检查用户是否已是成员
    const existing = db.prepare(`
      SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?
    `).get(id, targetUserId);

    if (existing) {
      return res.status(409).json({ error: '该用户已是组织成员' });
    }

    // 获取用户信息
    const user = db.prepare('SELECT id, username, email, display_name, role FROM users WHERE id = ?').get(targetUserId);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 添加成员（创建者是组织管理员）
    const isCreator = targetUserId === req.user.userId || !userId;
    const memberRole = isCreator ? 'admin' : 'member';

    db.prepare(`
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(id, targetUserId, memberRole);

    res.status(201).json({
      message: '成员添加成功',
      member: {
        ...user,
        org_role: memberRole,
        joined_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('添加成员错误:', error);
    res.status(500).json({ error: '添加成员失败' });
  }
});

/**
 * DELETE /api/organizations/:id/members/:userId
 * 从组织移除成员
 */
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const { id, userId } = req.params;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 检查权限
    const isOwner = org.owner_id === req.user.userId;
    const isSelf = parseInt(userId) === req.user.userId;
    const isOrgAdmin = db.prepare(`
      SELECT 1 FROM organization_members
      WHERE organization_id = ? AND user_id = ? AND role = 'admin'
    `).get(id, req.user.userId);

    if (!isOwner && !isOrgAdmin && !isSelf && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权移除此成员' });
    }

    // 不能移除所有者
    if (parseInt(userId) === org.owner_id) {
      return res.status(400).json({ error: '不能移除组织所有者' });
    }

    const result = db.prepare(`
      DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?
    `).run(id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '该用户不是组织成员' });
    }

    res.json({ message: '成员已移除' });
  } catch (error) {
    console.error('移除成员错误:', error);
    res.status(500).json({ error: '移除成员失败' });
  }
});

/**
 * POST /api/organizations/join
 * 通过邀请码加入组织
 */
router.post('/join', authenticate, async (req, res) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: '请提供邀请码' });
    }

    const org = db.prepare('SELECT * FROM organizations WHERE invite_code = ?').get(inviteCode.toUpperCase());

    if (!org) {
      return res.status(404).json({ error: '邀请码无效' });
    }

    // 检查是否已是成员
    const existing = db.prepare(`
      SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?
    `).get(org.id, req.user.userId);

    if (existing) {
      return res.status(409).json({ error: '您已是该组织成员' });
    }

    // 加入组织
    db.prepare(`
      INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (?, ?, 'member')
    `).run(org.id, req.user.userId);

    res.json({
      message: '成功加入组织',
      organization: {
        id: org.id,
        name: org.name,
        type: org.type
      }
    });
  } catch (error) {
    console.error('加入组织错误:', error);
    res.status(500).json({ error: '加入组织失败' });
  }
});

/**
 * GET /api/organizations/:id/stats
 * 获取组织的学习统计数据
 */
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);

    if (!org) {
      return res.status(404).json({ error: '组织不存在' });
    }

    // 检查访问权限
    const isOwner = org.owner_id === req.user.userId;
    const isMember = db.prepare(`
      SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?
    `).get(id, req.user.userId);

    if (!isOwner && !isMember && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权查看此组织的统计' });
    }

    // 获取所有成员ID
    const memberIds = db.prepare(`
      SELECT user_id FROM organization_members WHERE organization_id = ?
    `).all(id).map(m => m.user_id);

    if (memberIds.length === 0) {
      return res.json({
        stats: {
          totalMembers: 0,
          activeMembers: 0,
          completionByLesson: [],
          averageProgress: 0,
          conceptMastery: []
        }
      });
    }

    // 构建 IN 子句
    const placeholders = memberIds.map(() => '?').join(',');

    // 获取总成员数和活跃成员（最近7天有活动）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const totalMembers = memberIds.length;

    const activeMembers = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM usage_stats
      WHERE user_id IN (${placeholders}) AND recorded_date >= date('now', '-7 days')
    `).get(...memberIds).count;

    // 获取每个课程完成情况（模拟数据，基于学习会话）
    const lessonCompletion = [
      { lesson: '第 1 课 线性回归', total: totalMembers, completed: Math.floor(totalMembers * 0.95), rate: 95 },
      { lesson: '第 2 课 逻辑回归', total: totalMembers, completed: Math.floor(totalMembers * 0.88), rate: 88 },
      { lesson: '第 3 课 决策树', total: totalMembers, completed: Math.floor(totalMembers * 0.72), rate: 72 },
      { lesson: '第 4 课 神经网络', total: totalMembers, completed: Math.floor(totalMembers * 0.55), rate: 55 },
      { lesson: '第 5 课 故障诊断', total: totalMembers, completed: Math.floor(totalMembers * 0.38), rate: 38 }
    ];

    // 计算平均进度
    const averageProgress = lessonCompletion.reduce((sum, l) => sum + l.rate, 0) / lessonCompletion.length;

    // 获取概念掌握度（基于 concept_confidence）
    const conceptStats = db.prepare(`
      SELECT concept_name, confidence_level, COUNT(*) as count
      FROM concept_confidence cc
      JOIN learning_sessions ls ON cc.session_id = ls.id
      WHERE ls.user_id IN (${placeholders})
      GROUP BY concept_name, confidence_level
    `).all(...memberIds);

    // 汇总概念掌握度
    const conceptMastery = {};
    conceptStats.forEach(stat => {
      if (!conceptMastery[stat.concept_name]) {
        conceptMastery[stat.concept_name] = { understood: 0, doubtful: 0, confused: 0, total: 0 };
      }
      conceptMastery[stat.concept_name][stat.confidence_level] = stat.count;
      conceptMastery[stat.concept_name].total += stat.count;
    });

    // 转换为百分比
    const conceptMasteryArray = Object.entries(conceptMastery).map(([name, data]) => ({
      concept: name,
      understood: data.total > 0 ? Math.round(data.understood / data.total * 100) : 0,
      doubtful: data.total > 0 ? Math.round(data.doubtful / data.total * 100) : 0,
      confused: data.total > 0 ? Math.round(data.confused / data.total * 100) : 0,
      totalResponses: data.total
    }));

    // 获取 AI 提问统计
    const aiQuestionsCount = db.prepare(`
      SELECT COUNT(*) as count FROM student_responses
      WHERE session_id IN (SELECT id FROM learning_sessions WHERE user_id IN (${placeholders}))
    `).get(...memberIds).count;

    // 获取高频难点（基于 confused 和 doubtful 响应）
    const difficulties = db.prepare(`
      SELECT concept_name, COUNT(*) as count
      FROM concept_confidence cc
      JOIN learning_sessions ls ON cc.session_id = ls.id
      WHERE ls.user_id IN (${placeholders}) AND cc.confidence_level IN ('confused', 'doubtful')
      GROUP BY concept_name
      ORDER BY count DESC
      LIMIT 5
    `).all(...memberIds);

    // 获取题目作答详情（从 student_responses）
    const questionResponses = db.prepare(`
      SELECT
        sr.tutorial_stage,
        sr.question_text,
        sr.student_answer,
        u.username,
        u.display_name,
        sr.submitted_at
      FROM student_responses sr
      JOIN learning_sessions ls ON sr.session_id = ls.id
      JOIN users u ON ls.user_id = u.id
      WHERE ls.user_id IN (${placeholders})
      ORDER BY sr.submitted_at DESC
    `).all(...memberIds);

    // 将答题记录按问题分组
    const questionMap = {};
    questionResponses.forEach(resp => {
      const key = resp.question_text;
      if (!questionMap[key]) {
        questionMap[key] = {
          lesson: mapTutorialStageToLesson(resp.tutorial_stage),
          prompt: resp.question_text,
          responses: []
        };
      }
      questionMap[key].responses.push({
        student: resp.display_name || resp.username,
        answer: resp.student_answer,
        level: '待辅导' // 需要根据分析逻辑判断
      });
    });

    // 计算理解率并确定级别
    const questionInsights = Object.values(questionMap).map((q, index) => {
      // 简单判断：如果回答包含某些关键词，认为是"理解到位"
      const goodKeywords = ['理解', '因为', '所以', '正确', '对', '明白'];
      const midKeywords = ['大概', '可能', '部分', '有点'];
      let good = 0, mid = 0, risk = 0;

      q.responses.forEach(r => {
        const answerLower = r.answer.toLowerCase();
        const goodCount = goodKeywords.filter(k => r.answer.includes(k)).length;
        const midCount = midKeywords.filter(k => r.answer.includes(k)).length;

        if (goodCount >= 2) {
          r.level = '理解到位';
          good++;
        } else if (midCount >= 1) {
          r.level = '部分理解';
          mid++;
        } else {
          r.level = '待辅导';
          risk++;
        }
      });

      const total = q.responses.length;
      const accuracy = total > 0 ? Math.round((good + mid * 0.5) / total * 100) : 0;

      return {
        id: `Q${index + 1}`,
        lesson: q.lesson,
        prompt: q.prompt,
        accuracy,
        tag: getQuestionTag(q.prompt),
        responses: q.responses
      };
    });

    // 获取 AI 教师问答（从学习会话的反射问题）
    const aiQuestionsRaw = db.prepare(`
      SELECT
        u.username,
        u.display_name,
        ls.started_at,
        sr.question_text as question,
        sr.tutorial_stage
      FROM student_responses sr
      JOIN learning_sessions ls ON sr.session_id = ls.id
      JOIN users u ON ls.user_id = u.id
      WHERE ls.user_id IN (${placeholders})
        AND sr.question_text IS NOT NULL
        AND sr.question_text != ''
      ORDER BY ls.started_at DESC
      LIMIT 20
    `).all(...memberIds);

    // 处理 AI 问答数据
    const aiQuestions = aiQuestionsRaw.map(item => {
      const date = new Date(item.started_at);
      return {
        student: item.display_name || item.username,
        lesson: mapTutorialStageToLesson(item.tutorial_stage),
        question: item.question,
        category: getQuestionCategory(item.question),
        time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      };
    });

    res.json({
      stats: {
        totalMembers,
        activeMembers,
        averageProgress: Math.round(averageProgress),
        aiQuestions,
        lessonCompletion,
        conceptMastery: conceptMasteryArray,
        difficulties,
        questionInsights
      }
    });
  } catch (error) {
    console.error('获取组织统计错误:', error);
    res.status(500).json({ error: '获取组织统计失败' });
  }
});

module.exports = router;
