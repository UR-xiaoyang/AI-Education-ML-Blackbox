import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

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

export function UserManagementPage({ onClose }) {
  const { user, token, isAdmin } = useAuthStore();
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
    fetchUsers();
  }, []);

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

      // Update local state
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

      // Update local state
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

    // 验证表单
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

      // 关闭 Modal 并刷新列表
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

  return (
    <div className="user-management-page">
      {/* Header */}
      <div className="um-header">
        <div className="um-title">
          <h2>👥 用户管理</h2>
          <p>管理系统中的用户账号和权限</p>
        </div>
        <div className="um-header-actions">
          {isAdmin() && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              ➕ 添加用户
            </button>
          )}
          <button className="btn" onClick={onClose}>← 返回</button>
        </div>
      </div>

      {/* Filters */}
      <div className="um-filters">
        <form className="um-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn">🔍 搜索</button>
        </form>

        {isAdmin() && (
          <div className="um-role-filter">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                fetchUsers(1, search, e.target.value);
              }}
            >
              <option value="">全部角色</option>
              <option value="admin">管理员</option>
              <option value="teacher">教师</option>
              <option value="student">学生</option>
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="um-error">
          <span>⚠️</span> {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="um-loading">
          <span>⏳</span> 加载中...
        </div>
      )}

      {/* User Table */}
      {!isLoading && (
        <div className="um-table-container">
          <table className="um-table">
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
                  <td colSpan={isAdmin() ? 9 : 8} className="um-empty">
                    暂无用户数据
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const roleStyle = getRoleBadgeStyle(u.role);
                  return (
                    <tr key={u.id} className={!u.isActive ? 'um-inactive' : ''}>
                      <td>
                        <div className="um-user-info">
                          <span className="um-user-name">{u.username}</span>
                          {u.displayName && u.displayName !== u.username && (
                            <span className="um-user-display">{u.displayName}</span>
                          )}
                        </div>
                      </td>
                      <td className="um-email">{u.email}</td>
                      <td>
                        <span
                          className="um-role-badge"
                          style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}
                        >
                          {u.role === 'admin' ? '管理员' : u.role === 'teacher' ? '教师' : '学生'}
                        </span>
                      </td>
                      <td>
                        <span className={`um-status ${u.isActive ? 'active' : 'inactive'}`}>
                          {u.isActive ? '● 启用' : '○ 禁用'}
                        </span>
                      </td>
                      <td className="um-stat">{formatDuration(u.totalDurationSeconds)}</td>
                      <td className="um-stat">{formatTokens(u.totalTokens)}</td>
                      <td className="um-date">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="um-date">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '从未'}</td>
                      {isAdmin() && (
                        <td>
                          <div className="um-actions">
                            {u.id !== user.userId && (
                              <>
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  disabled={actionLoading === u.id}
                                  className="um-role-select"
                                >
                                  <option value="student">学生</option>
                                  <option value="teacher">教师</option>
                                  <option value="admin">管理员</option>
                                </select>
                                <button
                                  className="btn um-status-btn"
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
        <div className="um-pagination">
          <button
            className="btn"
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            ← 上一页
          </button>
          <span className="um-page-info">
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

      {/* 添加用户 Modal */}
      {showAddModal && (
        <div className="um-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <h3>添加用户</h3>
              <button className="um-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            {addError && (
              <div className="um-modal-error">
                <span>⚠️</span> {addError}
              </div>
            )}

            <form className="um-modal-form" onSubmit={handleAddUser}>
              <div className="um-modal-field">
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

              <div className="um-modal-field">
                <label>邮箱 <span className="required">*</span></label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="用于找回密码和接收通知"
                  required
                />
              </div>

              <div className="um-modal-field">
                <label>显示名称</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="选填，默认为用户名"
                />
              </div>

              <div className="um-modal-field">
                <label>角色 <span className="required">*</span></label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="student">学生</option>
                  <option value="teacher">教师</option>
                  <option value="admin">管理员</option>
                </select>
              </div>

              <div className="um-modal-field">
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

              <div className="um-modal-field">
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

              <div className="um-modal-actions">
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
        .user-management-page {
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

        .um-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          padding: 20px 24px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .um-title h2 {
          margin: 0 0 6px 0;
          font-size: 1.5rem;
        }

        .um-title p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .um-header-actions {
          display: flex;
          gap: 12px;
        }

        .um-filters {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .um-search {
          display: flex;
          gap: 8px;
          flex: 1;
          min-width: 300px;
        }

        .um-search input {
          flex: 1;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
        }

        .um-search input:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .um-role-filter select {
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .um-error {
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

        .um-error button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
        }

        .um-loading {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        .um-table-container {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow-x: auto;
        }

        .um-table {
          width: 100%;
          border-collapse: collapse;
        }

        .um-table th,
        .um-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .um-table th {
          background: rgba(0, 0, 0, 0.2);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .um-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .um-table tbody tr.um-inactive {
          opacity: 0.6;
        }

        .um-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .um-user-name {
          font-weight: 600;
          color: #f8fafc;
        }

        .um-user-display {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .um-email {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .um-role-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 500;
          border: 1px solid;
        }

        .um-status {
          font-size: 0.85rem;
        }

        .um-status.active {
          color: #22c55e;
        }

        .um-status.inactive {
          color: #ef4444;
        }

        .um-stat {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .um-date {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .um-empty {
          text-align: center;
          color: var(--text-secondary);
          padding: 40px !important;
        }

        .um-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .um-role-select {
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #fff;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .um-status-btn {
          padding: 6px 10px;
          font-size: 0.9rem;
        }

        .um-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
        }

        .um-page-info {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* Modal Styles */
        .um-modal-overlay {
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

        .um-modal {
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .um-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .um-modal-header h3 {
          margin: 0;
          font-size: 1.2rem;
        }

        .um-modal-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px;
        }

        .um-modal-close:hover {
          color: #fff;
        }

        .um-modal-error {
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

        .um-modal-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .um-modal-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .um-modal-field label {
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.9);
          font-weight: 500;
        }

        .um-modal-field .required {
          color: var(--accent-red);
        }

        .um-modal-field input,
        .um-modal-field select {
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-size: 0.95rem;
        }

        .um-modal-field input:focus,
        .um-modal-field select:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .um-modal-field input::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }

        .um-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
