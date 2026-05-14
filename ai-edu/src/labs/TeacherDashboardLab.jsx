import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 默认静态数据（当无动态数据时使用）
const defaultOverviewStats = [
  { label: '累计学习学生', value: '128', note: '本周进入平台并开始学习', delta: '+16', color: '#60a5fa' },
  { label: '平均完成率', value: '74%', note: '基础课程 5 节平均完成进度', delta: '+8%', color: '#22c55e' },
  { label: 'AI 提问总数', value: '356', note: '学生在学习中向 AI 教师发起的问题', delta: '+42', color: '#f59e0b' },
  { label: '高频难点数', value: '6', note: '当前班级反复出现的概念堵点', delta: '2 个预警', color: '#a855f7' }
];

const defaultLessonCompletion = [
  { lesson: '第 1 课 线性回归', completed: 126, total: 128, rate: 98, trend: '+12', status: '已基本完成', color: '#22c55e', history: [52, 66, 79, 88, 94, 98] },
  { lesson: '第 2 课 逻辑回归', completed: 119, total: 128, rate: 93, trend: '+18', status: '推进顺利', color: '#38bdf8', history: [35, 49, 63, 76, 86, 93] },
  { lesson: '第 3 课 决策树', completed: 102, total: 128, rate: 80, trend: '+21', status: '出现分层', color: '#f59e0b', history: [22, 35, 48, 61, 72, 80] },
  { lesson: '第 4 课 神经网络', completed: 78, total: 128, rate: 61, trend: '+26', status: '学习阻力明显', color: '#fb7185', history: [10, 18, 27, 39, 51, 61] },
  { lesson: '第 5 课 故障诊断', completed: 49, total: 128, rate: 38, trend: '+14', status: '需重点跟进', color: '#8b5cf6', history: [4, 8, 15, 22, 30, 38] }
];

const defaultCommonDifficulties = [
  { topic: '过拟合与泛化的区别', heat: 92, lesson: '神经网络', advice: '建议教师结合训练集/测试集曲线进行对比讲解。' },
  { topic: '学习率过大导致震荡', heat: 86, lesson: '线性回归', advice: '建议演示不同学习率下损失曲线变化。' },
  { topic: '概率输出与分类结果的关系', heat: 74, lesson: '逻辑回归', advice: '建议强化阈值和 Sigmoid 输出解释。' },
  { topic: '树深增加为什么会更容易过拟合', heat: 68, lesson: '决策树', advice: '建议用训练区域切分动画辅助说明。' },
  { topic: '梯度爆炸与梯度消失的区别', heat: 64, lesson: '故障诊断', advice: '建议用参数更新幅度做对比展示。' },
  { topic: 'NMS 的作用与 IoU 阈值含义', heat: 53, lesson: 'YOLO 专题', advice: '建议结合重复框抑制前后效果讲解。' }
];

const defaultUnderstandingMatrix = [
  { lesson: '线性回归', strong: 81, medium: 32, weak: 15 },
  { lesson: '逻辑回归', strong: 66, medium: 39, weak: 23 },
  { lesson: '决策树', strong: 58, medium: 41, weak: 29 },
  { lesson: '神经网络', strong: 33, medium: 52, weak: 43 },
  { lesson: '故障诊断', strong: 21, medium: 46, weak: 61 }
];

function buildSparklinePoints(values) {
  const width = 140;
  const height = 44;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
}

function getQuestionBreakdown(responses) {
  return responses.reduce((acc, item) => {
    if (item.level === '理解到位') acc.good += 1;
    else if (item.level === '部分理解') acc.mid += 1;
    else acc.risk += 1;
    return acc;
  }, { good: 0, mid: 0, risk: 0 });
}

function getHeatOpacity(value, max) {
  return 0.18 + (value / max) * 0.72;
}

// 获取组织类型的中文标签
function getOrgTypeLabel(type) {
  const labels = { class: '班级', organization: '组织', group: '小组' };
  return labels[type] || type;
}

function TeacherDashboardLab() {
  const { token, isAuthenticated } = useAuthStore();

  // 如果未登录，显示提示
  if (!isAuthenticated || typeof isAuthenticated === 'function') {
    return (
      <div className="teacher-dashboard">
        <div className="glass-panel teacher-hero" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <div className="teacher-kicker">Teacher Analytics</div>
            <h2>教师学习情况可视化大屏</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              请先登录后再访问教师大屏
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 组织选择状态
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null); // null 表示全部
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  // 计算动态理解度矩阵
  const calculateUnderstandingMatrix = useCallback((conceptMastery) => {
    if (!conceptMastery || conceptMastery.length === 0) {
      return defaultUnderstandingMatrix;
    }
    // 将概念掌握度数据转换为理解度矩阵格式
    const lessonMap = {
      '线性回归': 'LinearRegressionLab',
      '线性回归 梯度下降': 'LinearRegressionLab',
      '逻辑回归': 'LogisticRegressionLab',
      '逻辑回归 分类': 'LogisticRegressionLab',
      '决策树': 'DecisionTreeLab',
      '神经网络': 'NeuralNetworkLab',
      '神经网络 MLP': 'NeuralNetworkLab',
      '故障诊断': 'FaultSimulatorLab',
      '过拟合': 'NeuralNetworkLab',
      '欠拟合': 'NeuralNetworkLab',
      '梯度爆炸': 'FaultSimulatorLab',
      '梯度消失': 'FaultSimulatorLab'
    };

    const matrix = [
      { lesson: '线性回归', strong: 0, medium: 0, weak: 0 },
      { lesson: '逻辑回归', strong: 0, medium: 0, weak: 0 },
      { lesson: '决策树', strong: 0, medium: 0, weak: 0 },
      { lesson: '神经网络', strong: 0, medium: 0, weak: 0 },
      { lesson: '故障诊断', strong: 0, medium: 0, weak: 0 }
    ];

    conceptMastery.forEach(item => {
      const lessonName = Object.keys(lessonMap).find(key =>
        item.concept?.includes(key) || key.includes(item.concept || '')
      );
      if (lessonName) {
        const lesson = matrix.find(m => m.lesson.includes(lessonName.split(' ')[0]));
        if (lesson) {
          lesson.strong += item.understood || 0;
          lesson.medium += item.doubtful || 0;
          lesson.weak += item.confused || 0;
        }
      }
    });

    // 归一化为百分比
    matrix.forEach(item => {
      const total = item.strong + item.medium + item.weak;
      if (total > 0) {
        const scale = 100 / total;
        item.strong = Math.round(item.strong * scale);
        item.medium = Math.round(item.medium * scale);
        item.weak = Math.round(item.weak * scale);
      } else {
        // 使用默认值
        const defaults = defaultUnderstandingMatrix.find(d => d.lesson === item.lesson);
        if (defaults) {
          item.strong = defaults.strong;
          item.medium = defaults.medium;
          item.weak = defaults.weak;
        }
      }
    });

    return matrix;
  }, []);

  // 初始加载组织列表
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const loadOrgs = async () => {
      try {
        const response = await fetch(`${API_URL}/api/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const text = await response.text();
        if (cancelled) return;

        try {
          const data = JSON.parse(text);
          if (response.ok) {
            setOrganizations([...data.owned, ...data.joined]);
          } else {
            console.error('获取组织列表失败:', data.error || text);
          }
        } catch (parseError) {
          // 非 JSON 响应（通常是 HTML 错误页面），不显示错误，静默处理
          if (!text.includes('<!DOCTYPE')) {
            console.error('解析响应失败:', parseError, '原始响应:', text);
          }
        }
      } catch (error) {
        console.error('获取组织列表失败:', error);
      }
    };
    loadOrgs();
    return () => { cancelled = true; };
  }, [token]);

  // 当选择组织变化时获取统计
  useEffect(() => {
    if (!token || !selectedOrgId) return;

    let cancelled = false;
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError('');

      try {
        const url = `${API_URL}/api/organizations/${selectedOrgId}/stats`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const text = await response.text();
        if (cancelled) return;

        try {
          const data = JSON.parse(text);
          if (response.ok) {
            setStats(data.stats);
          } else {
            setStatsError(data.error || '获取统计数据失败');
            setStats(null);
          }
        } catch (parseError) {
          console.error('解析响应失败:', parseError, '原始响应:', text);
          setStatsError('数据解析失败，请稍后重试');
          setStats(null);
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
        if (!cancelled) {
          setStatsError('网络错误，请稍后重试');
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    loadStats();
    return () => { cancelled = true; };
  }, [selectedOrgId, token]);

  // 计算统计数据
  const overviewStats = React.useMemo(() => {
    if (!stats) return defaultOverviewStats;

    return [
      { label: '累计学习学生', value: String(stats.totalMembers || 0), note: '班级学生总数', delta: stats.activeMembers ? `${stats.activeMembers}人活跃` : '', color: '#60a5fa' },
      { label: '平均完成率', value: `${stats.averageProgress || 0}%`, note: '基础课程平均完成进度', delta: '', color: '#22c55e' },
      { label: 'AI 提问总数', value: String(stats.aiQuestions?.length || 0), note: '学生在学习中向 AI 教师发起的问题', delta: '', color: '#f59e0b' },
      { label: '高频难点数', value: String(stats.difficulties?.length || 0), note: '班级反复出现的概念堵点', delta: '', color: '#a855f7' }
    ];
  }, [stats]);

  const lessonCompletion = React.useMemo(() => {
    if (!stats || !stats.lessonCompletion || stats.lessonCompletion.length === 0) {
      return defaultLessonCompletion;
    }

    return stats.lessonCompletion.map((item) => ({
      lesson: item.lesson,
      completed: item.completed,
      total: item.total,
      rate: item.rate,
      trend: '',
      status: item.rate > 80 ? '推进顺利' : item.rate > 50 ? '进行中' : '需关注',
      color: item.rate > 80 ? '#22c55e' : item.rate > 50 ? '#f59e0b' : '#fb7185',
      history: [40, 55, 65, 75, 85, item.rate]
    }));
  }, [stats]);

  const understandingMatrix = React.useMemo(() => {
    if (!stats) return defaultUnderstandingMatrix;
    return calculateUnderstandingMatrix(stats.conceptMastery);
  }, [stats, calculateUnderstandingMatrix]);

  const commonDifficulties = React.useMemo(() => {
    if (!stats || !stats.difficulties || stats.difficulties.length === 0) {
      return defaultCommonDifficulties;
    }

    return stats.difficulties.map(item => ({
      topic: item.question_text || item.topic,
      heat: Math.min(100, item.count * 10),
      lesson: item.tutorial_stage || '通用',
      advice: '建议结合实例进行讲解'
    }));
  }, [stats]);

  const heatMax = Math.max(...understandingMatrix.flatMap((item) => [item.strong, item.medium, item.weak]));

  // 获取当前选中的组织名称
  const selectedOrgName = selectedOrgId
    ? organizations.find(o => o.id === selectedOrgId)?.name
    : null;

  // 问题洞察数据（从 stats 获取真实数据）
  const questionInsights = React.useMemo(() => {
    if (!stats || !stats.questionInsights || stats.questionInsights.length === 0) {
      return []; // 无数据时返回空数组，显示空状态
    }
    return stats.questionInsights;
  }, [stats]);

  // AI提问数据（从 stats 获取真实数据）
  const aiQuestions = React.useMemo(() => {
    if (!stats || !stats.aiQuestions || stats.aiQuestions.length === 0) {
      return []; // 无数据时返回空数组，显示空状态
    }
    return stats.aiQuestions;
  }, [stats]);

  return (
    <div className="teacher-dashboard">
      {/* 组织选择器 */}
      <section className="glass-panel teacher-hero">
        <div style={{ flex: 1 }}>
          <div className="teacher-kicker">Teacher Analytics</div>
          <h2>教师学习情况可视化大屏</h2>
          <p>
            {selectedOrgId
              ? `班级「${selectedOrgName}」学生学习数据`
              : '展示所有学生的学习情况，或选择特定班级查看定向统计'}
          </p>
        </div>

        {/* 班级选择下拉框 */}
        <div className="org-selector">
          <label>选择班级：</label>
          <select
            value={selectedOrgId || ''}
            onChange={(e) => setSelectedOrgId(e.target.value ? parseInt(e.target.value) : null)}
            className="org-select"
          >
            <option value="">全部学生</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {getOrgTypeLabel(org.type)} - {org.name} ({org.member_count || 1}人)
              </option>
            ))}
          </select>
          {organizations.length === 0 && (
            <span className="org-hint">暂无管理的班级</span>
          )}
        </div>
      </section>

      {/* 加载状态 */}
      {statsLoading && (
        <div className="teacher-loading">
          <span>⏳</span> 加载数据中...
        </div>
      )}

      {/* 错误提示 */}
      {statsError && (
        <div className="teacher-error">
          <span>⚠️</span> {statsError}
        </div>
      )}

      {/* 统计数据 */}
      {!statsLoading && !statsError && (
        <>
      <section className="teacher-stat-grid">
        {overviewStats.map((item) => (
          <article key={item.label} className="glass-panel teacher-stat-card">
            <div className="teacher-stat-top">
              <span>{item.label}</span>
              <em style={{ color: item.color }}>{item.delta}</em>
            </div>
            <div className="teacher-stat-main">
              <strong>{item.value}</strong>
              <div className="teacher-stat-orb" style={{ background: `radial-gradient(circle, ${item.color}66 0%, ${item.color}00 72%)` }} />
            </div>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="teacher-main-grid">
        <article className="glass-panel teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <div className="teacher-panel-kicker">课程完成情况</div>
              <h3>每节课完成人数</h3>
            </div>
            <span className="teacher-panel-tip">用于快速发现掉队章节</span>
          </div>

          <div className="teacher-completion-card-grid">
            {lessonCompletion.map((item) => (
              <div key={item.lesson} className="teacher-completion-card">
                <div className="teacher-completion-card-head">
                  <strong>{item.lesson}</strong>
                  <span style={{ color: item.color }}>较昨日 {item.trend}</span>
                </div>
                <div className="teacher-completion-visual">
                  <div
                    className="teacher-ring"
                    style={{
                      background: `conic-gradient(${item.color} 0 ${item.rate}%, rgba(148, 163, 184, 0.14) ${item.rate}% 100%)`
                    }}
                  >
                    <div className="teacher-ring-inner">
                      <strong>{item.rate}%</strong>
                      <span>完成率</span>
                    </div>
                  </div>

                  <div className="teacher-completion-metrics">
                    <div className="teacher-mini-stat">
                      <span>完成人数</span>
                      <strong>{item.completed} / {item.total}</strong>
                    </div>
                    <div className="teacher-mini-stat">
                      <span>当前状态</span>
                      <strong>{item.status}</strong>
                    </div>
                  </div>
                </div>

                <div className="teacher-sparkline-card">
                  <div className="teacher-sparkline-meta">
                    <span>近 6 个时段推进趋势</span>
                    <span>{item.history[item.history.length - 1]}%</span>
                  </div>
                  <svg viewBox="0 0 140 44" className="teacher-sparkline" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke={item.color}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={buildSparklinePoints(item.history)}
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <div className="teacher-panel-kicker">理解分层</div>
              <h3>各课程学习状态分布</h3>
            </div>
            <span className="teacher-panel-tip">强 / 中 / 弱 三层观察</span>
          </div>

          <div className="teacher-heat-legend">
            <span><i className="is-strong" />理解到位</span>
            <span><i className="is-medium" />部分理解</span>
            <span><i className="is-weak" />薄弱待跟进</span>
          </div>

          <div className="teacher-heatmap">
            <div className="teacher-heatmap-head">
              <span>课程</span>
              <span>强</span>
              <span>中</span>
              <span>弱</span>
            </div>
            {understandingMatrix.map((item) => (
              <div key={item.lesson} className="teacher-heatmap-row">
                <span className="teacher-heatmap-label">{item.lesson}</span>
                <div
                  className="teacher-heat-cell is-strong"
                  style={{ opacity: getHeatOpacity(item.strong, heatMax) }}
                >
                  {item.strong}
                </div>
                <div
                  className="teacher-heat-cell is-medium"
                  style={{ opacity: getHeatOpacity(item.medium, heatMax) }}
                >
                  {item.medium}
                </div>
                <div
                  className="teacher-heat-cell is-weak"
                  style={{ opacity: getHeatOpacity(item.weak, heatMax) }}
                >
                  {item.weak}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="teacher-bottom-grid">
        <article className="glass-panel teacher-panel teacher-panel-wide">
          <div className="teacher-panel-header">
            <div>
              <div className="teacher-panel-kicker">题目作答详情</div>
              <h3>每个问题各学生回答情况</h3>
            </div>
            <span className="teacher-panel-tip">可直接据此进行课堂点拨</span>
          </div>

          <div className="teacher-question-list">
            {questionInsights.length === 0 ? (
              <div className="teacher-empty-state">
                <span>📝</span>
                <p>暂无学生答题记录</p>
                <span>学生完成学习实验后将显示答题数据</span>
              </div>
            ) : (
              questionInsights.map((item) => (
                <section key={item.id} className="teacher-question-card">
                <div className="teacher-question-visual">
                  <div
                    className="teacher-accuracy-ring"
                    style={{
                      background: `conic-gradient(#38bdf8 0 ${item.accuracy}%, rgba(148, 163, 184, 0.14) ${item.accuracy}% 100%)`
                    }}
                  >
                    <div className="teacher-accuracy-ring-inner">
                      <strong>{item.accuracy}%</strong>
                      <span>理解率</span>
                    </div>
                  </div>
                  {(() => {
                    const breakdown = getQuestionBreakdown(item.responses);
                    return (
                      <div className="teacher-breakdown">
                        <div className="teacher-breakdown-row">
                          <span>理解到位</span>
                          <strong>{breakdown.good}</strong>
                        </div>
                        <div className="teacher-breakdown-row">
                          <span>部分理解</span>
                          <strong>{breakdown.mid}</strong>
                        </div>
                        <div className="teacher-breakdown-row">
                          <span>待辅导</span>
                          <strong>{breakdown.risk}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="teacher-question-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="teacher-question-header">
                    <div>
                      <div className="teacher-question-meta">{item.lesson} · {item.id} · 正确理解率 {item.accuracy}%</div>
                      <h4>{item.prompt}</h4>
                    </div>
                    <span className="teacher-tag">{item.tag}</span>
                  </div>

                  <div className="teacher-response-table">
                    {item.responses.map((response) => (
                      <div key={`${item.id}-${response.student}`} className="teacher-response-row">
                        <span className="teacher-response-student">{response.student}</span>
                        <span className="teacher-response-answer">{response.answer}</span>
                        <span className={`teacher-response-level ${response.level === '理解到位' ? 'is-good' : response.level === '部分理解' ? 'is-mid' : 'is-risk'}`}>
                          {response.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))
            )}
          </div>
        </article>

        <article className="glass-panel teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <div className="teacher-panel-kicker">AI 教师问答</div>
              <h3>学生向 AI 教师提出的问题</h3>
            </div>
            <span className="teacher-panel-tip">可回看实时困惑点</span>
          </div>

          <div className="teacher-ai-list teacher-ai-timeline">
            {aiQuestions.length === 0 ? (
              <div className="teacher-empty-state">
                <span>🤖</span>
                <p>暂无 AI 提问记录</p>
                <span>学生在学习过程中向 AI 教师提问后将显示记录</span>
              </div>
            ) : (
              aiQuestions.map((item) => (
                <div key={`${item.student}-${item.time}`} className="teacher-ai-item">
                <div className="teacher-ai-node" />
                <div className="teacher-ai-top">
                  <strong>{item.student}</strong>
                  <span>{item.time}</span>
                </div>
                <div className="teacher-ai-lesson">{item.lesson} · {item.category}</div>
                <p>{item.question}</p>
              </div>
            ))
            )}
          </div>
        </article>

        <article className="glass-panel teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <div className="teacher-panel-kicker">共性难点</div>
              <h3>大家都在疑惑的知识堵点</h3>
            </div>
            <span className="teacher-panel-tip">适合教师集中讲解</span>
          </div>

          <div className="teacher-cloud">
            {commonDifficulties.map((item) => (
              <div
                key={`${item.topic}-cloud`}
                className="teacher-cloud-item"
                style={{
                  fontSize: `${0.85 + (item.heat - 50) / 80}rem`,
                  borderColor: `${item.heat > 80 ? 'rgba(239,68,68,0.32)' : item.heat > 65 ? 'rgba(251,191,36,0.28)' : 'rgba(96,165,250,0.28)'}`,
                  background: item.heat > 80
                    ? 'rgba(239,68,68,0.12)'
                    : item.heat > 65
                      ? 'rgba(251,191,36,0.12)'
                      : 'rgba(96,165,250,0.12)'
                }}
              >
                <span>{item.topic}</span>
                <strong>{item.heat}</strong>
              </div>
            ))}
          </div>

          <div className="teacher-difficulty-list">
            {commonDifficulties.map((item) => (
              <div key={item.topic} className="teacher-difficulty-item">
                <div className="teacher-difficulty-top">
                  <strong>{item.topic}</strong>
                  <span>热度 {item.heat}</span>
                </div>
                <div className="teacher-difficulty-track">
                  <div className="teacher-difficulty-fill" style={{ width: `${item.heat}%` }} />
                </div>
                <div className="teacher-difficulty-lesson">{item.lesson}</div>
                <p>{item.advice}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
        </>
      )}

      {/* 样式 */}
      <style>{`
        /* 组织选择器样式 */
        .teacher-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
        }

        .org-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .org-selector label {
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.8);
          white-space: nowrap;
        }

        .org-select {
          padding: 8px 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #f8fafc;
          font-size: 0.9rem;
          cursor: pointer;
          min-width: 180px;
          outline: none;
        }

        .org-select:hover {
          border-color: rgba(99, 102, 241, 0.5);
        }

        .org-select:focus {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .org-select option {
          background: rgba(15, 23, 42, 0.98);
          color: #f8fafc;
          padding: 8px;
        }

        .org-hint {
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.6);
          font-style: italic;
        }

        /* 加载状态 */
        .teacher-loading {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .teacher-loading span {
          font-size: 2rem;
          display: block;
          margin-bottom: 12px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }

        /* 错误提示 */
        .teacher-error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          padding: 16px 20px;
          border-radius: 12px;
          margin: 20px 0;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .teacher-error span {
          font-size: 1.2rem;
        }

        /* 空状态 */
        .teacher-empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .teacher-empty-state span {
          font-size: 2.5rem;
          display: block;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .teacher-empty-state p {
          margin: 0 0 6px 0;
          font-size: 1rem;
          color: rgba(226, 232, 240, 0.7);
        }

        .teacher-empty-state span:last-child {
          font-size: 0.85rem;
          opacity: 0.6;
        }

        /* 响应式调整 */
        @media (max-width: 900px) {
          .teacher-hero {
            flex-direction: column;
          }

          .org-selector {
            width: 100%;
            justify-content: space-between;
          }

          .org-select {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default TeacherDashboardLab;
