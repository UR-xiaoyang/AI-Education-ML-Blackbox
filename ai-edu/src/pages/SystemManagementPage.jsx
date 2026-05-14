import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { OrganizationManagement } from './OrganizationManagement';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 格式化时长（秒 -> 人类可读格式）
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

// 格式化 Token 数量
function formatTokens(tokens) {
  if (!tokens || tokens === 0) return '-';
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

// 格式化数字
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return num.toLocaleString();
}

export function SystemManagementPage({ onClose }) {
  const { user, token, isAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'organizations' | 'settings' | 'stats' | 'logs'

  // 用户管理相关状态
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  // 添加用户 Modal 状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'student'
  });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // 系统统计状态
  const [systemStats, setSystemStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch users
  const fetchUsers = async (page = 1, searchTerm = search, role = roleFilter) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      if (searchTerm) params.append('search', searchTerm);
      if (role && isAdmin()) params.append('role', role);

      const response = await fetch(`${API_URL}/api/auth/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取用户列表失败');
      }

      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  // Fetch system stats
  const fetchSystemStats = async () => {
    setStatsLoading(true);
    try {
      // 获取总用户数
      const totalUsers = users.length || pagination.total || 0;

      // 计算各角色数量
      const roleCounts = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, { admin: 0, teacher: 0, student: 0 });

      // 计算总使用时长和 Token
      const totalDuration = users.reduce((acc, u) => acc + (u.totalDurationSeconds || 0), 0);
      const totalTokens = users.reduce((acc, u) => acc + (u.totalTokens || 0), 0);

      // 活跃用户（最近7天有登录）
      const activeUsers = users.filter(u => {
        if (!u.lastLogin) return false;
        const lastLogin = new Date(u.lastLogin);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastLogin >= sevenDaysAgo;
      }).length;

      setSystemStats({
        totalUsers,
        activeUsers,
        adminCount: roleCounts.admin,
        teacherCount: roleCounts.teacher,
        studentCount: roleCounts.student,
        totalDuration,
        totalTokens,
        averageUsageTime: totalUsers > 0 ? Math.round(totalDuration / totalUsers) : 0
      });
    } catch (err) {
      console.error('获取系统统计失败:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchSystemStats();
    }
  }, [activeTab, users]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1, search, roleFilter);
  };

  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    if (!isAdmin()) return;
    setActionLoading(userId);
    try {
      const response = await fetch(`${API_URL}/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新角色失败');
      }

      setUsers(users.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle status toggle
  const handleStatusToggle = async (userId, currentStatus) => {
    if (!isAdmin()) return;
    setActionLoading(userId);
    try {
      const response = await fetch(`${API_URL}/api/auth/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新状态失败');
      }

      setUsers(users.map(u =>
        u.id === userId ? { ...u, isActive: !currentStatus } : u
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 添加用户
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!newUser.username || !newUser.email || !newUser.password) {
      setAddError('请填写所有必填项');
      return;
    }
    if (newUser.username.length < 3 || newUser.username.length > 50) {
      setAddError('用户名长度应在 3-50 个字符之间');
      return;
    }
    if (newUser.password.length < 6) {
      setAddError('密码长度至少为 6 个字符');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      setAddError('两次输入的密码不一致');
      return;
    }

    setAddLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUser.username.trim(),
          email: newUser.email.trim(),
          password: newUser.password,
          displayName: newUser.displayName.trim() || newUser.username.trim(),
          role: newUser.role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建用户失败');
      }

      setShowAddModal(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        role: 'student'
      });
      fetchUsers(1, search, roleFilter);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Pagination
  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchUsers(page, search, roleFilter);
    }
  };

  // Get role badge color
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' };
      case 'teacher':
        return { bg: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', border: 'rgba(139, 92, 246, 0.3)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  const tabs = [
    { id: 'users', name: '用户管理', icon: '👥' },
    { id: 'organizations', name: '组织管理', icon: '🏫' },
    { id: 'stats', name: '使用统计', icon: '📊' },
    { id: 'settings', name: '系统设置', icon: '⚙️' },
    { id: 'logs', name: '操作日志', icon: '📋' }
  ];

  return (
    <div className="system-management-page">
      {/* Header */}
      <div className="sm-header">
        <div className="sm-title">
          <h2>⚙️ 系统管理</h2>
          <p>管理系统用户、查看系统统计和配置系统设置</p>
        </div>
        <button className="btn" onClick={onClose}>← 返回</button>
      </div>

      {/* Tabs */}
      <div className="sm-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sm-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="sm-content">
        {/* 用户管理 */}
        {activeTab === 'users' && (
          <>
            <div className="sm-section-header">
              <h3>用户列表</h3>
              {isAdmin() && (
                <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                  ➕ 添加用户
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="sm-filters">
              <form className="sm-search" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="搜索用户名或邮箱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="btn">🔍 搜索</button>
              </form>

              {isAdmin() && (
                <div className="sm-role-filter">
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      fetchUsers(1, search, e.target.value);
                    }}
                  >
                    <option value="">全部角色</option>
                    <option value="admin">系统管理员</option>
                    <option value="teacher">教师</option>
                    <option value="student">学生</option>
                  </select>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="sm-error">
                <span>⚠️</span> {error}
                <button onClick={() => setError('')}>✕</button>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="sm-loading">
                <span>⏳</span> 加载中...
              </div>
            )}

            {/* User Table */}
            {!isLoading && (
              <div className="sm-table-container">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>邮箱</th>
                      <th>角色</th>
                      <th>状态</th>
                      <th>使用时长</th>
                      <th>AI Token</th>
                      <th>注册时间</th>
                      <th>最后登录</th>
                      {isAdmin() && <th>操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin() ? 9 : 8} className="sm-empty">
                          暂无用户数据
                        </td>
                      </tr>
                    ) : (
                      users.map(u => {
                        const roleStyle = getRoleBadgeStyle(u.role);
                        return (
                          <tr key={u.id} className={!u.isActive ? 'sm-inactive' : ''}>
                            <td>
                              <div className="sm-user-info">
                                <span className="sm-user-name">{u.username}</span>
                                {u.displayName && u.displayName !== u.username && (
                                  <span className="sm-user-display">{u.displayName}</span>
                                )}
                              </div>
                            </td>
                            <td className="sm-email">{u.email}</td>
                            <td>
                              <span
                                className="sm-role-badge"
                                style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}
                              >
                                {u.role === 'admin' ? '系统管理员' : u.role === 'teacher' ? '教师' : '学生'}
                              </span>
                            </td>
                            <td>
                              <span className={`sm-status ${u.isActive ? 'active' : 'inactive'}`}>
                                {u.isActive ? '● 启用' : '○ 禁用'}
                              </span>
                            </td>
                            <td className="sm-stat">{formatDuration(u.totalDurationSeconds)}</td>
                            <td className="sm-stat">{formatTokens(u.totalTokens)}</td>
                            <td className="sm-date">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="sm-date">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '从未'}</td>
                            {isAdmin() && (
                              <td>
                                <div className="sm-actions">
                                  {u.id !== user.userId && (
                                    <>
                                      <select
                                        value={u.role}
                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        disabled={actionLoading === u.id}
                                        className="sm-role-select"
                                      >
                                        <option value="student">学生</option>
                                        <option value="teacher">教师</option>
                                        <option value="admin">系统管理员</option>
                                      </select>
                                      <button
                                        className="btn sm-status-btn"
                                        onClick={() => handleStatusToggle(u.id, u.isActive)}
                                        disabled={actionLoading === u.id}
                                        title={u.isActive ? '禁用账号' : '启用账号'}
                                      >
                                        {u.isActive ? '🚫' : '✅'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="sm-pagination">
                <button
                  className="btn"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  ← 上一页
                </button>
                <span className="sm-page-info">
                  第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </span>
                <button
                  className="btn"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  下一页 →
                </button>
              </div>
            )}
          </>
        )}

        {/* 使用统计 */}
        {activeTab === 'stats' && (
          <>
            <div className="sm-section-header">
              <h3>系统使用统计</h3>
              <button className="btn" onClick={fetchSystemStats}>🔄 刷新</button>
            </div>

            {statsLoading ? (
              <div className="sm-loading">
                <span>⏳</span> 加载中...
              </div>
            ) : systemStats && (
              <div className="sm-stats-grid">
                <div className="sm-stat-card">
                  <div className="sm-stat-icon">👥</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{formatNumber(systemStats.totalUsers)}</div>
                    <div className="sm-stat-label">总用户数</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">✅</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{formatNumber(systemStats.activeUsers)}</div>
                    <div className="sm-stat-label">近7天活跃用户</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">⏱️</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{formatDuration(systemStats.totalDuration)}</div>
                    <div className="sm-stat-label">总使用时长</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">💬</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{formatTokens(systemStats.totalTokens)}</div>
                    <div className="sm-stat-label">总 AI Token</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">👑</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{systemStats.adminCount}</div>
                    <div className="sm-stat-label">系统管理员</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">👨‍🏫</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{systemStats.teacherCount}</div>
                    <div className="sm-stat-label">教师</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">🎓</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{systemStats.studentCount}</div>
                    <div className="sm-stat-label">学生</div>
                  </div>
                </div>

                <div className="sm-stat-card">
                  <div className="sm-stat-icon">📈</div>
                  <div className="sm-stat-content">
                    <div className="sm-stat-value">{formatDuration(systemStats.averageUsageTime)}</div>
                    <div className="sm-stat-label">人均使用时长</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 系统设置 */}
        {activeTab === 'settings' && (
          <>
            <div className="sm-section-header">
              <h3>系统设置</h3>
            </div>

            <div className="sm-settings-container">
              <div className="sm-settings-group">
                <h4>基础设置</h4>
                <div className="sm-setting-item">
                  <div className="sm-setting-info">
                    <span className="sm-setting-name">网站名称</span>
                    <span className="sm-setting-desc">显示在页面标题中的名称</span>
                  </div>
                  <input
                    type="text"
                    className="sm-setting-input"
                    defaultValue="综合 AI 实验室"
                    disabled={!isAdmin()}
                  />
                </div>
                <div className="sm-setting-item">
                  <div className="sm-setting-info">
                    <span className="sm-setting-name">允许新用户注册</span>
                    <span className="sm-setting-desc">是否允许用户自行注册账号</span>
                  </div>
                  <label className="sm-toggle">
                    <input type="checkbox" defaultChecked disabled={!isAdmin()} />
                    <span className="sm-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="sm-settings-group">
                <h4>安全设置</h4>
                <div className="sm-setting-item">
                  <div className="sm-setting-info">
                    <span className="sm-setting-name">会话有效期</span>
                    <span className="sm-setting-desc">用户登录后会话的有效时长</span>
                  </div>
                  <select className="sm-setting-input" defaultValue="7d" disabled={!isAdmin()}>
                    <option value="1d">1 天</option>
                    <option value="7d">7 天</option>
                    <option value="30d">30 天</option>
                  </select>
                </div>
                <div className="sm-setting-item">
                  <div className="sm-setting-info">
                    <span className="sm-setting-name">启用人机验证</span>
                    <span className="sm-setting-desc">登录和注册时启用 Cloudflare Turnstile 验证</span>
                  </div>
                  <label className="sm-toggle">
                    <input type="checkbox" defaultChecked disabled={!isAdmin()} />
                    <span className="sm-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="sm-settings-group">
                <h4>实验设置</h4>
                <div className="sm-setting-item">
                  <div className="sm-setting-info">
                    <span className="sm-setting-name">默认教学模式</span>
                    <span className="sm-setting-desc">新用户进入时的默认学习模式</span>
                  </div>
                  <select className="sm-setting-input" defaultValue="self" disabled={!isAdmin()}>
                    <option value="self">自习模式</option>
                    <option value="teaching">教学模式</option>
                  </select>
                </div>
              </div>

              {isAdmin() && (
                <div className="sm-settings-actions">
                  <button className="btn btn-primary">保存设置</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* 操作日志 */}
        {activeTab === 'logs' && (
          <>
            <div className="sm-section-header">
              <h3>操作日志</h3>
              <div className="sm-logs-filters">
                <select className="sm-setting-input">
                  <option value="">全部类型</option>
                  <option value="user">用户操作</option>
                  <option value="system">系统操作</option>
                  <option value="auth">认证操作</option>
                </select>
                <button className="btn">导出日志</button>
              </div>
            </div>

            <div className="sm-logs-container">
              <div className="sm-logs-empty">
                <span>📋</span>
                <p>暂无操作日志记录</p>
                <span className="sm-logs-hint">操作日志功能即将上线</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 添加用户 Modal */}
      {showAddModal && (
        <div className="sm-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h3>添加用户</h3>
              <button className="sm-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            {addError && (
              <div className="sm-modal-error">
                <span>⚠️</span> {addError}
              </div>
            )}

            <form className="sm-modal-form" onSubmit={handleAddUser}>
              <div className="sm-modal-field">
                <label>用户名 <span className="required">*</span></label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="用于登录 (3-50字符)"
                  required
                  minLength={3}
                  maxLength={50}
                />
              </div>

              <div className="sm-modal-field">
                <label>邮箱 <span className="required">*</span></label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="用于找回密码和接收通知"
                  required
                />
              </div>

              <div className="sm-modal-field">
                <label>显示名称</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="选填，默认为用户名"
                />
              </div>

              <div className="sm-modal-field">
                <label>角色 <span className="required">*</span></label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="student">学生</option>
                  <option value="teacher">教师</option>
                  <option value="admin">系统管理员</option>
                </select>
              </div>

              <div className="sm-modal-field">
                <label>初始密码 <span className="required">*</span></label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="至少 6 个字符"
                  required
                  minLength={6}
                />
              </div>

              <div className="sm-modal-field">
                <label>确认密码 <span className="required">*</span></label>
                <input
                  type="password"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                  placeholder="再次输入密码"
                  required
                  minLength={6}
                />
              </div>

              <div className="sm-modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAddModal(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addLoading}
                >
                  {addLoading ? '创建中...' : '创建用户'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .system-management-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--bg-color);
          z-index: 10000;
          padding: 20px;
          overflow-y: auto;
        }

        .sm-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding: 20px 24px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sm-title h2 {
          margin: 0 0 6px 0;
          font-size: 1.5rem;
        }

        .sm-title p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .sm-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          padding: 8px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sm-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sm-tab:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .sm-tab.active {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .sm-content {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 24px;
        }

        .sm-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .sm-section-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #f8fafc;
        }

        .sm-filters {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .sm-search {
          display: flex;
          gap: 8px;
          flex: 1;
          min-width: 300px;
        }

        .sm-search input {
          flex: 1;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
        }

        .sm-search input:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .sm-role-filter select {
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .sm-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sm-error button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
        }

        .sm-loading {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        .sm-table-container {
          overflow-x: auto;
        }

        .sm-table {
          width: 100%;
          border-collapse: collapse;
        }

        .sm-table th,
        .sm-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .sm-table th {
          background: rgba(0, 0, 0, 0.2);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sm-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .sm-table tbody tr.sm-inactive {
          opacity: 0.6;
        }

        .sm-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sm-user-name {
          font-weight: 600;
          color: #f8fafc;
        }

        .sm-user-display {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .sm-email {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .sm-role-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 500;
          border: 1px solid;
        }

        .sm-status {
          font-size: 0.85rem;
        }

        .sm-status.active {
          color: #22c55e;
        }

        .sm-status.inactive {
          color: #ef4444;
        }

        .sm-stat {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .sm-date {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .sm-empty {
          text-align: center;
          color: var(--text-secondary);
          padding: 40px !important;
        }

        .sm-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .sm-role-select {
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #fff;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .sm-status-btn {
          padding: 6px 10px;
          font-size: 0.9rem;
        }

        .sm-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
        }

        .sm-page-info {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* Stats Grid */
        .sm-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .sm-stat-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sm-stat-icon {
          font-size: 2rem;
        }

        .sm-stat-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sm-stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .sm-stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        /* Settings */
        .sm-settings-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sm-settings-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sm-settings-group h4 {
          margin: 0;
          font-size: 1rem;
          color: #f8fafc;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sm-setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .sm-setting-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sm-setting-name {
          font-size: 0.95rem;
          color: #f8fafc;
        }

        .sm-setting-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .sm-setting-input {
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #fff;
          font-size: 0.9rem;
          min-width: 150px;
        }

        .sm-setting-input:disabled {
          opacity: 0.6;
        }

        .sm-toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .sm-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .sm-toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(148, 163, 184, 0.3);
          border-radius: 12px;
          transition: 0.3s;
        }

        .sm-toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background: white;
          border-radius: 50%;
          transition: 0.3s;
        }

        .sm-toggle input:checked + .sm-toggle-slider {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        .sm-toggle input:checked + .sm-toggle-slider:before {
          transform: translateX(20px);
        }

        .sm-toggle input:disabled + .sm-toggle-slider {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sm-settings-actions {
          margin-top: 16px;
        }

        /* Logs */
        .sm-logs-filters {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .sm-logs-container {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sm-logs-empty {
          text-align: center;
          color: var(--text-secondary);
        }

        .sm-logs-empty span {
          font-size: 3rem;
          display: block;
          margin-bottom: 16px;
        }

        .sm-logs-empty p {
          margin: 0 0 8px 0;
          font-size: 1rem;
        }

        .sm-logs-hint {
          font-size: 0.85rem;
          opacity: 0.6;
        }

        /* Modal Styles */
        .sm-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          padding: 20px;
        }

        .sm-modal {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .sm-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sm-modal-header h3 {
          margin: 0;
          font-size: 1.2rem;
        }

        .sm-modal-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px;
        }

        .sm-modal-close:hover {
          color: #fff;
        }

        .sm-modal-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 16px;
          margin: 16px 24px 0;
          border-radius: 8px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sm-modal-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sm-modal-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sm-modal-field label {
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.9);
          font-weight: 500;
        }

        .sm-modal-field .required {
          color: var(--accent-red);
        }

        .sm-modal-field input,
        .sm-modal-field select {
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-size: 0.95rem;
        }

        .sm-modal-field input:focus,
        .sm-modal-field select:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .sm-modal-field input::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }

        .sm-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
