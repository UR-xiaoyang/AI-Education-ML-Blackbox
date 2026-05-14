const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS 配置 - 支持环境变量配置允许的源
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175'
    ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    // In development, also allow any localhost
    if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    callback(new Error('不允许的 CORS origin: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求解析 - 限制 JSON body 大小防止 DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 引入数据库（初始化 SQLite）
require('./db');

// 路由
const { router: authRoutes } = require('./routes/auth');
const pedagogyRoutes = require('./routes/pedagogy');
const organizationRoutes = require('./routes/organizations');

app.use('/api/auth', authRoutes);
app.use('/api/pedagogy', pedagogyRoutes);
app.use('/api/organizations', organizationRoutes);

// 健康检查（不暴露敏感信息）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由（用于教学实验的数据存储）
app.post('/api/experiment/save', (req, res) => {
  const { type, data, userId } = req.body;

  // 输入验证
  if (!type || typeof type !== 'string' || type.length > 50) {
    return res.status(400).json({ error: '无效的实验类型' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '无效的实验数据' });
  }
  // 防止 path traversal - 只允许字母数字和下划线
  if (!/^[a-zA-Z0-9_]+$/.test(type)) {
    return res.status(400).json({ error: '实验类型格式无效' });
  }
  // 限制数据大小（JSON 序列化后不超过 100KB）
  const serialized = JSON.stringify(data);
  if (serialized.length > 100 * 1024) {
    return res.status(400).json({ error: '实验数据过大' });
  }

  const filename = path.join(dataDir, `experiment_${type}_${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify({ type, data, userId, timestamp: new Date().toISOString() }, null, 2));
  res.json({ success: true, filename });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  // 区分 CORS 错误和其他错误
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'CORS 拒绝访问' });
  }
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
  console.log('数据库: SQLite (文件存储)');
  console.log('数据库路径:', path.join(__dirname, 'data', 'ai_edu.db'));
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set. Using insecure default in development only.');
  }
});
