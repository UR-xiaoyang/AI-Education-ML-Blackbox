const Database = require('better-sqlite3');
const path = require('path');

const DB_MODE = process.env.DB_MODE || 'sqlite'; // 'sqlite' or 'postgres'
const DB_PATH = path.join(__dirname, 'data', 'ai_edu.db');

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- 1. 用户表 (扩展支持登录)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
    display_name VARCHAR(100),
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT,
    is_active INTEGER DEFAULT 1
  );

  -- 2. 学习周期记录表
  CREATE TABLE IF NOT EXISTS learning_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    final_hyperparameters TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    total_epochs_simulated INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 3. 学生简答题作答记录表
  CREATE TABLE IF NOT EXISTS student_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tutorial_stage VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    student_answer TEXT NOT NULL,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
  );

  -- 4. 概念掌握度自评表
  CREATE TABLE IF NOT EXISTS concept_confidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    concept_name VARCHAR(100) NOT NULL,
    confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('understood', 'doubtful', 'confused')),
    recorded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
  );

  -- 5. Token 黑名单表
  CREATE TABLE IF NOT EXISTS token_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    blacklisted_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  -- 索引
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON learning_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_responses_session ON student_responses(session_id);
  CREATE INDEX IF NOT EXISTS idx_confidence_session ON concept_confidence(session_id);
  CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);

  -- 6. 用户使用时长统计表
  CREATE TABLE IF NOT EXISTS usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_type VARCHAR(50) NOT NULL DEFAULT 'learning',
    duration_seconds INTEGER DEFAULT 0,
    recorded_date DATE DEFAULT (date('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 7. AI Token 使用记录表
  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    recorded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 统计表索引
  CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
  CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(recorded_date);
  CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);

  -- 8. 组织/班级表
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'class' CHECK (type IN ('class', 'organization', 'group')),
    owner_id INTEGER NOT NULL,
    invite_code VARCHAR(20) UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 9. 组织成员表
  CREATE TABLE IF NOT EXISTS organization_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
  );

  -- 组织表索引
  CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
  CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
  CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code);
`);

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

module.exports = { db, DB_MODE };