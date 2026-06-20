const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('已创建 data 目录:', dataDir);
}

// CORS 配置
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'],
  credentials: true
}));

// 请求解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 引入数据库（初始化 SQLite）
require('./db');

// 路由
const { router: authRoutes } = require('./routes/auth');
const pedagogyRoutes = require('./routes/pedagogy');
const organizationRoutes = require('./routes/organizations');

app.use('/api/auth', authRoutes);
app.use('/api/pedagogy', pedagogyRoutes);
app.use('/api/organizations', organizationRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由（用于教学实验的数据存储）
app.post('/api/experiment/save', (req, res) => {
  const { type, data, userId } = req.body;
  // 简化的实验数据存储
  const filename = path.join(dataDir, `experiment_${type}_${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify({ type, data, userId, timestamp: new Date().toISOString() }, null, 2));
  res.json({ success: true, filename });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
  console.log('数据库: SQLite (文件存储)');
  console.log('数据库路径:', path.join(__dirname, 'data', 'ai_edu.db'));
});