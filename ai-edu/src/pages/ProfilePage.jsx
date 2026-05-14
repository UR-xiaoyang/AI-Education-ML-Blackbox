import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function ProfilePage({ onClose }) {
  const { user, token, updateProfile, changePassword, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'session'
  const [isEditing, setIsEditing] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle profile update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!displayName.trim() && !email.trim()) {
      setError('请至少填写一个要更新的字段');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateProfile({
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined
      });

      if (result.success) {
        setSuccess('资料更新成功');
        setIsEditing(false);
      } else {
        setError(result.error || '更新失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('请输入当前密码');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少为 6 个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);

      if (result.success) {
        setSuccess('密码修改成功');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || '修改失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm('确定要退出登录吗？')) {
      await logout();
      if (onClose) onClose();
    }
  };

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-user">
          <div className="profile-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="profile-user-info">
            <h2>{user?.displayName || user?.username}</h2>
            <p>@{user?.username}</p>
          </div>
        </div>
        <button className="btn" onClick={onClose}>← 返回</button>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 个人资料
        </button>
        <button
          className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🔐 安全设置
        </button>
        <button
          className={`profile-tab ${activeTab === 'session' ? 'active' : ''}`}
          onClick={() => setActiveTab('session')}
        >
          📊 学习记录
        </button>
      </div>

      {/* Content */}
      <div className="profile-content">
        {error && (
          <div className="profile-alert profile-alert-error">
            <span>⚠️</span> {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {success && (
          <div className="profile-alert profile-alert-success">
            <span>✓</span> {success}
            <button onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="profile-section">
            <h3>基本信息</h3>
            <form onSubmit={handleProfileSubmit}>
              <div className="profile-field">
                <label>用户名</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="profile-input-disabled"
                />
                <span className="profile-hint">用户名不可修改</span>
              </div>

              <div className="profile-field">
                <label>显示名称</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="在系统中显示的名称"
                />
              </div>

              <div className="profile-field">
                <label>邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="用于找回密码和接收通知"
                />
              </div>

              <div className="profile-field">
                <label>角色</label>
                <div className="profile-role-badge">
                  {user?.role === 'admin' ? '👑 系统管理员' :
                   user?.role === 'teacher' ? '👨‍🏫 教师' : '🎓 学生'}
                </div>
              </div>

              <div className="profile-field">
                <label>注册时间</label>
                <input
                  type="text"
                  value={user?.createdAt ? new Date(user.createdAt).toLocaleString() : '未知'}
                  disabled
                  className="profile-input-disabled"
                />
              </div>

              <div className="profile-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? '保存中...' : '保存修改'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setIsEditing(false);
                    setDisplayName(user?.displayName || user?.username || '');
                    setEmail(user?.email || '');
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="profile-section">
            <h3>修改密码</h3>
            <form onSubmit={handlePasswordSubmit}>
              <div className="profile-field">
                <label>当前密码</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="请输入当前密码"
                  autoComplete="current-password"
                />
              </div>

              <div className="profile-field">
                <label>新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  autoComplete="new-password"
                />
              </div>

              <div className="profile-field">
                <label>确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                />
              </div>

              <div className="profile-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? '修改中...' : '修改密码'}
                </button>
              </div>
            </form>

            <div className="profile-divider" />

            <h3>账号安全</h3>
            <div className="profile-security-info">
              <div className="security-item">
                <span className="security-icon">🔒</span>
                <div>
                  <strong>登录令牌</strong>
                  <p>当前登录状态将在 7 天后过期</p>
                </div>
              </div>
              <div className="security-item">
                <span className="security-icon">⚠️</span>
                <div>
                  <strong>退出登录</strong>
                  <p>点击下方按钮退出当前账号</p>
                </div>
              </div>
            </div>
            <button
              className="btn profile-logout-btn"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        )}

        {/* Session Tab */}
        {activeTab === 'session' && (
          <div className="profile-section">
            <h3>学习统计</h3>
            <div className="profile-stats">
              <div className="stat-card">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <strong>完成实验</strong>
                  <span className="stat-value">-</span>
                  <small>累计完成</small>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <strong>学习时长</strong>
                  <span className="stat-value">-</span>
                  <small>本周学习</small>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <strong>平均分数</strong>
                  <span className="stat-value">-</span>
                  <small>答题正确率</small>
                </div>
              </div>
            </div>

            <div className="profile-recent">
              <h4>最近活动</h4>
              <div className="recent-empty">
                <span>📭</span>
                <p>暂无学习记录</p>
                <small>开始实验后将显示您的学习历史</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .profile-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-color);
          z-index: 10000;
          overflow-y: auto;
          padding: 20px;
        }

        .profile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 20px;
        }

        .profile-user {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .profile-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          font-weight: bold;
          color: white;
        }

        .profile-user-info h2 {
          margin: 0 0 4px 0;
          font-size: 1.4rem;
        }

        .profile-user-info p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .profile-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 16px;
        }

        .profile-tab {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .profile-tab:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .profile-tab.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
          color: var(--accent-blue);
        }

        .profile-content {
          max-width: 600px;
        }

        .profile-alert {
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .profile-alert button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
        }

        .profile-alert-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .profile-alert-success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .profile-section {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 24px;
        }

        .profile-section h3 {
          margin: 0 0 20px 0;
          font-size: 1.1rem;
          color: #fff;
        }

        .profile-section h4 {
          margin: 20px 0 12px 0;
          font-size: 1rem;
          color: rgba(226, 232, 240, 0.9);
        }

        .profile-field {
          margin-bottom: 20px;
        }

        .profile-field label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .profile-field input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        .profile-field input:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .profile-field input.profile-input-disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .profile-hint {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 4px;
          opacity: 0.7;
        }

        .profile-role-badge {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          color: var(--accent-blue);
          font-weight: 500;
        }

        .profile-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .profile-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 24px 0;
        }

        .profile-security-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .security-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .security-icon {
          font-size: 1.2rem;
        }

        .security-item strong {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 4px;
        }

        .security-item p {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .profile-logout-btn {
          margin-top: 16px;
          background: rgba(239, 68, 68, 0.15) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5 !important;
        }

        .profile-logout-btn:hover {
          background: rgba(239, 68, 68, 0.25) !important;
        }

        .profile-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
        }

        .stat-icon {
          font-size: 1.5rem;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-info strong {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .stat-info .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #fff;
        }

        .stat-info small {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .recent-empty {
          text-align: center;
          padding: 30px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          color: var(--text-secondary);
        }

        .recent-empty span {
          font-size: 2rem;
          display: block;
          margin-bottom: 8px;
          opacity: 0.5;
        }

        .recent-empty p {
          margin: 0 0 4px 0;
        }

        .recent-empty small {
          font-size: 0.8rem;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}