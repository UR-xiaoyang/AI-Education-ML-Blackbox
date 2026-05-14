-- 1. 用户表 (扩展支持登录)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
    display_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. 学习周期记录表 (一次完整的通关记录)
CREATE TABLE learning_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 存储学生通关时最终探索出的模型参数（如 {lr: 0.01, layers: [16, 8]}）
    final_hyperparameters JSONB NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    -- 记录完成本次实验总共花费的时间或轮数
    total_epochs_simulated INTEGER DEFAULT 0
);

-- 3. 学生简答题作答记录表 (核心教学数据)
CREATE TABLE student_responses (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    tutorial_stage VARCHAR(50) NOT NULL,  -- 关联的教学阶段枚举
    question_text TEXT NOT NULL,          -- 当时的提问内容
    student_answer TEXT NOT NULL,         -- 学生的反思长文本 (NLP 分析的核心字段)
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 概念掌握度自评表 (用于生成教师后台的"认知痛点热力图")
CREATE TABLE concept_confidence (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    concept_name VARCHAR(100) NOT NULL,   -- 例如：'Learning Rate', 'Overfitting'
    confidence_level VARCHAR(20) NOT NULL CHECK (confidence_level IN ('understood', 'doubtful', 'confused')),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 会话/Token 黑名单表 (用于登出功能)
CREATE TABLE token_blacklist (
    id SERIAL PRIMARY KEY,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 6. 组织/班级表
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'class' CHECK (type IN ('class', 'organization', 'group')),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. 组织成员表
CREATE TABLE organization_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

-- 索引优化
CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_sessions_completed ON learning_sessions(completed_at);
CREATE INDEX idx_responses_session ON student_responses(session_id);
CREATE INDEX idx_confidence_session ON concept_confidence(session_id);
CREATE INDEX idx_token_blacklist_jti ON token_blacklist(token_jti);
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON organization_members(user_id);
CREATE INDEX idx_organizations_invite_code ON organizations(invite_code);

-- 触发器：自动更新 last_login
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_login = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_login
AFTER UPDATE ON users
FOR EACH ROW
WHEN (OLD.last_login IS DISTINCT FROM NEW.last_login)
EXECUTE FUNCTION update_last_login();
