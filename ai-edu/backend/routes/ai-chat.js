const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');

// 系统提示词 - 定义 AI 学习伴侣的角色
const SYSTEM_PROMPT = `你是"AI 黑盒实验室"的学习伴侣，名字叫小智。你的任务是帮助学生理解机器学习概念。

## 基本信息
- 你在一个交互式 ML 教育平台上工作
- 学生正在学习：线性回归、逻辑回归、决策树、神经网络等主题
- 用户界面包含画布（用于可视化）和各种 ML 实验

## 回答原则
1. 简洁明了：用通俗易懂的语言解释概念，避免过于技术化
2. 引导式回答：当学生提问时，先引导他们思考，再给出答案
3. 鼓励探索：多使用"试试看"、"观察一下"等引导性语言
4. 结合实际：在解释概念时，可以结合界面中的可视化元素

## 界面上下文
- 左侧是交互式画布，用于放置数据点或观察模型行为
- 右侧有控制面板，可以调整学习率、开始训练等
- Loss（损失）值越小，说明模型越好
- 紫色线在画布上表示决策边界

## 回答风格
- 使用中文
- 适当使用 emoji 增加趣味性
- 控制在 100-200 字以内
- 如果问题超出 ML 范畴，礼貌地说明你只擅长 ML 领域

## 限制
- 你不会写代码或执行代码
- 你不会访问外部链接
- 你不会帮学生完成作业，但会解释概念帮助他们理解`;

// 聊天历史记录（生产环境应该存储在数据库中）
const chatHistories = new Map();

// POST /api/ai-chat/chat - 发送消息并获取 AI 回复
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, labType } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 获取或创建聊天历史
    if (!chatHistories.has(userId)) {
      chatHistories.set(userId, []);
    }
    const history = chatHistories.get(userId);

    // 构建消息列表
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // 如果有实验室上下文，添加上下文信息
    let contextInfo = '';
    if (labType) {
      const labContext = {
        LINEAR: '当前学生正在学习线性回归实验。这是一个回归问题，目标是找到一条直线来拟合数据点。',
        LOGISTIC: '当前学生正在学习逻辑回归实验。这是一个二分类问题，目标是找到一条决策边界来分开两类数据。',
        TREE: '当前学生正在学习决策树实验。决策树通过不断切分特征空间来进行分类或回归。',
        NN: '当前学生正在学习神经网络实验。神经网络由多层神经元组成，可以通过学习自动发现数据中的复杂模式。'
      };
      contextInfo = labContext[labType] || '';
      if (contextInfo) {
        messages[0].content += `\n\n## 当前实验上下文\n${contextInfo}`;
      }
    }

    // 调用 OpenRouter API (OpenAI 兼容格式)
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI 服务未配置，请联系管理员设置 OPENROUTER_API_KEY' });
    }

    // OpenRouter 使用 OpenAI 兼容的 API
    // 使用百度 cobuddy 免费模型（更稳定）
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI-EDU Lab'
      },
      body: JSON.stringify({
        model: 'baidu/cobuddy:free',
        max_tokens: 800,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    console.log('OpenRouter response:', JSON.stringify(data).substring(0, 200));
    // OpenRouter 返回格式与 OpenAI 兼容
    // cobuddy 模型返回 content
    let reply = data.choices?.[0]?.message?.content || '';

    // 如果 content 为空，可能是 reasoning 模型，检查 reasoning 部分
    if (!reply && data.choices?.[0]?.message?.reasoning) {
      // 如果只有 reasoning 没有 content，使用 reasoning 内容作为回复
      reply = data.choices[0].message.reasoning;
    }

    // 最终兜底
    if (!reply) {
      reply = '抱歉，我没有收到有效的回复。';
    }

    // 保存聊天历史
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });

    // 限制历史记录长度（保留最近 20 条）
    if (history.length > 40) {
      history.splice(0, history.length - 40);
    }

    res.json({ reply, history: history.slice(-4) });
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/ai-chat/generate-report - AI 生成实验报告
router.post('/generate-report', authenticate, async (req, res) => {
  const { studentAnswers, completedLabs, labDataSummary } = req.body;
  const userId = req.user.id;

  if (!studentAnswers || !Array.isArray(studentAnswers) || studentAnswers.length === 0) {
    return res.status(400).json({ error: '没有学生回答记录，无法生成报告' });
  }

  // 构建报告生成提示词
  const labTitles = {
    'LINEAR': '线性回归',
    'LOGISTIC': '逻辑回归',
    'TREE': '决策树',
    'NN': '神经网络',
    'FAULT': '故障实验台',
    'DT': '决策树'  // 兼容旧数据
  };

  // 按实验分组答案
  const answersByLab = {};
  studentAnswers.forEach(answer => {
    const labId = answer.labId || 'NN';
    if (!answersByLab[labId]) {
      answersByLab[labId] = [];
    }
    answersByLab[labId].push(answer);
  });

  // 构建实验摘要
  let experimentSummary = '';
  if (labDataSummary) {
    const summaryParts = [];
    if (labDataSummary.lrPoints > 0) summaryParts.push(`线性回归实验添加了 ${labDataSummary.lrPoints} 个数据点`);
    if (labDataSummary.lgPoints > 0) summaryParts.push(`逻辑回归实验添加了 ${labDataSummary.lgPoints} 个数据点`);
    if (labDataSummary.dtPoints > 0) summaryParts.push(`决策树实验使用了 ${labDataSummary.dtPoints} 个数据点`);
    if (summaryParts.length > 0) {
      experimentSummary = '## 实验操作摘要\n' + summaryParts.join('\n') + '\n';
    }
  }

  // 构建反思回答摘要
  let reflectionSummary = '';
  Object.keys(answersByLab).forEach(labId => {
    const labAnswers = answersByLab[labId];
    reflectionSummary += `### ${labTitles[labId] || labId}\n`;
    labAnswers.forEach((answer, index) => {
      reflectionSummary += `**问题 ${index + 1}**: ${answer.question || answer.questionText || ''}\n`;
      reflectionSummary += `**回答**: ${answer.answer}\n\n`;
    });
  });

  const systemPrompt = `你是"AI 黑盒实验室"的学习报告生成助手。你的任务是根据学生在一个交互式 ML 教育平台上的实验记录和学习反思，生成一份专业、鼓励性、个性化的学习报告。

## 报告要求
1. **结构清晰**：包含实验概览、学习成果、技能掌握、反思总结、改进建议等部分
2. **内容丰富**：总结学生完成的所有实验和反思回答
3. **鼓励为主**：用积极正面的语言，肯定学生的努力和进步
4. **实用建议**：给出具体、可操作的改进建议
5. **格式规范**：使用 Markdown 格式，层次分明

## 学生实验模块
学生可能完成以下模块的实验：
- 线性回归（LINEAR）：通过梯度下降拟合数据点，理解损失函数和学习率
- 逻辑回归（LOGISTIC）：二分类问题，理解 sigmoid 函数和决策边界
- 决策树（TREE）：理解特征切分和信息增益
- 神经网络（NN）：多层感知机，理解前向传播、反向传播和激活函数

## 输出语言
使用中文输出。`;

  const userPrompt = `请为学生生成一份完整的学习实验报告。

## 实验操作摘要
${experimentSummary || '（无详细操作记录）'}

## 学生反思记录（共 ${studentAnswers.length} 题）
${reflectionSummary}

## 已完成的实验模块
${completedLabs && completedLabs.length > 0 ? completedLabs.map(id => `• ${labTitles[id] || id}`).join('\n') : '暂无'}

请生成一份专业的实验报告，包含：
1. 实验概览（学习时长、完成情况）
2. 学习成果（各模块掌握情况）
3. 反思总结（从学生回答中提炼关键理解）
4. 技能掌握评估（可以按模块评分，用 ★ 或分数表示）
5. 改进建议（针对薄弱环节的具体建议）

请使用温暖鼓励的语气，让学生感受到学习的成就感和继续前进的动力。`;

  // 调用 OpenRouter API
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI 服务未配置，请联系管理员设置 OPENROUTER_API_KEY' });
  }

  // 设置60秒超时
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'AI-EDU Lab'
      },
      body: JSON.stringify({
        model: 'baidu/cobuddy:free',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    let reportContent = data.choices?.[0]?.message?.content || '';

    // 兜底
    if (!reportContent) {
      reportContent = '抱歉，无法生成报告，请稍后再试。';
    }

    // 保存报告到历史记录
    if (!chatHistories.has(userId)) {
      chatHistories.set(userId, []);
    }

    res.json({
      success: true,
      report: reportContent,
      summary: {
        totalAnswers: studentAnswers.length,
        labs: Object.keys(answersByLab),
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      console.error('Generate Report error: API 请求超时');
      return res.status(504).json({ error: 'AI 服务响应超时，请稍后再试' });
    }
    console.error('Generate Report error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/ai-chat/history - 清除聊天历史
router.delete('/history', authenticate, (req, res) => {
  const userId = req.user.id;
  chatHistories.delete(userId);
  res.json({ success: true });
});

// GET /api/ai-chat/system-prompt - 获取系统提示词（管理员用）
router.get('/system-prompt', authenticate, (req, res) => {
  // 只允许管理员查看系统提示词
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以查看系统提示词' });
  }
  res.json({ systemPrompt: SYSTEM_PROMPT });
});

// PUT /api/ai-chat/system-prompt - 更新系统提示词（管理员用）
router.put('/system-prompt', authenticate, (req, res) => {
  // 只允许管理员修改系统提示词
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以修改系统提示词' });
  }

  const { systemPrompt } = req.body;
  if (!systemPrompt || typeof systemPrompt !== 'string') {
    return res.status(400).json({ error: '系统提示词不能为空' });
  }

  // 注意：在实际生产环境中，应该将系统提示词存储在数据库中
  // 这里只是一个占位实现
  console.log('System prompt update requested (not persisted in this demo):', systemPrompt.substring(0, 100) + '...');

  res.json({ success: true, message: '系统提示词已更新' });
});

module.exports = { router, SYSTEM_PROMPT };