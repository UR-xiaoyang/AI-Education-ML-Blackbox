const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('./auth');

const router = express.Router();

/**
 * POST /api/pedagogy/session
 * 创建新的学习会话
 */
router.post('/session', authenticate, async (req, res) => {
  try {
    const { hyperparameters } = req.body;
    const userId = req.user.userId;

    const result = db.prepare(
      `INSERT INTO learning_sessions (user_id, final_hyperparameters, started_at) VALUES (?, ?, datetime('now'))`
    ).run(userId, JSON.stringify(hyperparameters || {}));

    res.status(201).json({
      message: '学习会话已创建',
      sessionId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('创建学习会话错误:', error);
    res.status(500).json({ error: '创建学习会话失败' });
  }
});

/**
 * PUT /api/pedagogy/session/:id/complete
 * 完成学习会话
 */
router.put('/session/:id/complete', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { hyperparameters, totalEpochsSimulated } = req.body;
    const userId = req.user.userId;

    const session = db.prepare(
      'SELECT id FROM learning_sessions WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!session) {
      return res.status(404).json({ error: '学习会话不存在' });
    }

    db.prepare(
      `UPDATE learning_sessions SET final_hyperparameters = ?, completed_at = datetime('now'), total_epochs_simulated = ? WHERE id = ?`
    ).run(JSON.stringify(hyperparameters || {}), totalEpochsSimulated || 0, id);

    res.json({ message: '学习会话已完成' });
  } catch (error) {
    console.error('完成学习会话错误:', error);
    res.status(500).json({ error: '完成学习会话失败' });
  }
});

/**
 * GET /api/pedagogy/sessions
 * 获取用户的学习会话历史
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const sessions = db.prepare(
      `SELECT * FROM learning_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?`
    ).all(userId, parseInt(limit), parseInt(offset));

    const countResult = db.prepare(
      'SELECT COUNT(*) FROM learning_sessions WHERE user_id = ?'
    ).get(userId);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        hyperparameters: JSON.parse(s.final_hyperparameters),
        startedAt: s.started_at,
        completedAt: s.completed_at,
        totalEpochsSimulated: s.total_epochs_simulated
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult['COUNT(*)']
      }
    });
  } catch (error) {
    console.error('获取学习会话历史错误:', error);
    res.status(500).json({ error: '获取学习会话历史失败' });
  }
});

/**
 * POST /api/pedagogy/session-summary
 * 保存学习会话总结（简答题答案 + 概念自评）
 */
router.post('/session-summary', authenticate, async (req, res) => {
  try {
    const { sessionId, tutorialStage, questionText, studentAnswer, concepts } = req.body;
    const userId = req.user.userId;

    // 验证会话归属
    const session = db.prepare(
      'SELECT id FROM learning_sessions WHERE id = ? AND user_id = ?'
    ).get(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: '学习会话不存在' });
    }

    // 保存简答题答案
    if (questionText && studentAnswer) {
      db.prepare(
        `INSERT INTO student_responses (session_id, tutorial_stage, question_text, student_answer, submitted_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(sessionId, tutorialStage, questionText, studentAnswer);
    }

    // 保存概念自评
    if (concepts && Array.isArray(concepts)) {
      const insertConcept = db.prepare(
        `INSERT INTO concept_confidence (session_id, concept_name, confidence_level, recorded_at)
         VALUES (?, ?, ?, datetime('now'))`
      );
      for (const concept of concepts) {
        insertConcept.run(sessionId, concept.name, concept.level);
      }
    }

    res.json({ message: '学习总结已保存' });
  } catch (error) {
    console.error('保存学习总结错误:', error);
    res.status(500).json({ error: '保存学习总结失败' });
  }
});

/**
 * GET /api/pedagogy/responses/:sessionId
 * 获取学习会话的所有响应
 */
router.get('/responses/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = db.prepare(
      'SELECT id FROM learning_sessions WHERE id = ? AND user_id = ?'
    ).get(sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: '学习会话不存在' });
    }

    const responses = db.prepare(
      'SELECT * FROM student_responses WHERE session_id = ? ORDER BY submitted_at'
    ).all(sessionId);

    const concepts = db.prepare(
      'SELECT * FROM concept_confidence WHERE session_id = ? ORDER BY recorded_at'
    ).all(sessionId);

    res.json({
      responses: responses.map(r => ({
        id: r.id,
        tutorialStage: r.tutorial_stage,
        questionText: r.question_text,
        studentAnswer: r.student_answer,
        submittedAt: r.submitted_at
      })),
      concepts: concepts.map(c => ({
        id: c.id,
        conceptName: c.concept_name,
        confidenceLevel: c.confidence_level,
        recordedAt: c.recorded_at
      }))
    });
  } catch (error) {
    console.error('获取响应错误:', error);
    res.status(500).json({ error: '获取响应失败' });
  }
});

/**
 * GET /api/pedagogy/analytics/overview (教师/管理员)
 * 获取学习数据概览
 */
router.get('/analytics/overview', authenticate, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const totalSessions = db.prepare('SELECT COUNT(*) FROM learning_sessions').get()['COUNT(*)'];
    const completedSessions = db.prepare('SELECT COUNT(*) FROM learning_sessions WHERE completed_at IS NOT NULL').get()['COUNT(*)'];
    const totalResponses = db.prepare('SELECT COUNT(*) FROM student_responses').get()['COUNT(*)'];

    // 获取概念困惑度统计
    const conceptStats = db.prepare(
      `SELECT concept_name, confidence_level, COUNT(*) as count
       FROM concept_confidence GROUP BY concept_name, confidence_level`
    ).all();

    const concepts = {};
    for (const stat of conceptStats) {
      if (!concepts[stat.concept_name]) {
        concepts[stat.concept_name] = { understood: 0, doubtful: 0, confused: 0 };
      }
      concepts[stat.concept_name][stat.confidence_level] = stat.count;
    }

    res.json({
      totalSessions,
      completedSessions,
      totalResponses,
      concepts
    });
  } catch (error) {
    console.error('获取分析概览错误:', error);
    res.status(500).json({ error: '获取分析概览失败' });
  }
});

module.exports = router;