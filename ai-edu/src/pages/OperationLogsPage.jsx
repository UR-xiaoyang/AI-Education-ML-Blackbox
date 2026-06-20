import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 操作日志页面 - 管理员查看系统操作记录
 */
export default function OperationLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'stats'

  // 筛选条件
  const [filter, setFilter] = useState({
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
    days: 7
  });

  // 获取日志列表
  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      // 从 Zustand 持久化存储获取 token
      const authState = localStorage.getItem('ai-edu-auth');
      const token = authState ? JSON.parse(authState)?.state?.token : null;

      if (!token) {
        console.error('未登录或 token 已过期');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(filter.action && { action: filter.action }),
        ...(filter.userId && { userId: filter.userId }),
        ...(filter.startDate && { startDate: filter.startDate }),
        ...(filter.endDate && { endDate: filter.endDate })
      });

      const response = await fetch(`${API_URL}/api/logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      // 从 Zustand 持久化存储获取 token
      const authState = localStorage.getItem('ai-edu-auth');
      const token = authState ? JSON.parse(authState)?.state?.token : null;

      if (!token) {
        console.error('未登录或 token 已过期');
        return;
      }

      const response = await fetch(`${API_URL}/api/logs/stats?days=${filter.days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(pagination.page);
    } else {
      fetchStats();
    }
  }, [activeTab]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLogs(1);
  };

  const handlePageChange = (newPage) => {
    fetchLogs(newPage);
  };

  const handleCleanup = async () => {
    if (!confirm('确定要清理旧日志吗？这将删除所有超过90天的日志。')) return;

    try {
      // 从 Zustand 持久化存储获取 token
      const authState = localStorage.getItem('ai-edu-auth');
      const token = authState ? JSON.parse(authState)?.state?.token : null;

      if (!token) {
        console.error('未登录或 token 已过期');
        return;
      }

      const response = await fetch(`${API_URL}/api/logs/cleanup?days=90`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`已清理 ${data.deletedCount} 条日志`);
        fetchLogs(1);
      }
    } catch (error) {
      console.error('清理日志失败:', error);
    }
  };

  // 操作类型映射
  const actionLabels = {
    'LOGIN': '登录',
    'LOGOUT': '登出',
    'REGISTER': '注册',
    'UPDATE_ROLE': '修改角色',
    'ENABLE_USER': '启用用户',
    'DISABLE_USER': '禁用用户',
    'ADMIN_CREATE_USER': '管理员创建用户',
    'UPDATE_ORG': '更新组织',
    'DELETE_ORG': '删除组织',
    'JOIN_ORG': '加入组织',
    'LEAVE_ORG': '离开组织'
  };

  const getActionLabel = (action) => actionLabels[action] || action;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0, color: '#fff', fontSize: '1.5rem' }}>📋 操作日志</h1>
        <button
          onClick={handleCleanup}
          style={{
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '8px',
            color: '#fca5a5',
            cursor: 'pointer'
          }}
        >
          🗑️ 清理90天前日志
        </button>
      </div>

      {/* 标签页 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '10px'
      }}>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'logs' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          📋 日志列表
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'stats' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          📊 统计报表
        </button>
      </div>

      {activeTab === 'logs' && (
        <>
          {/* 筛选器 */}
          <div style={{
            background: 'rgba(30, 30, 50, 0.8)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              alignItems: 'end'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                  操作类型
                </label>
                <select
                  value={filter.action}
                  onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                >
                  <option value="">全部操作</option>
                  <option value="LOGIN">登录</option>
                  <option value="LOGOUT">登出</option>
                  <option value="REGISTER">注册</option>
                  <option value="UPDATE_ROLE">修改角色</option>
                  <option value="ENABLE_USER">启用用户</option>
                  <option value="DISABLE_USER">禁用用户</option>
                  <option value="ADMIN_CREATE_USER">管理员创建用户</option>
                  <option value="UPDATE_ORG">更新组织</option>
                  <option value="DELETE_ORG">删除组织</option>
                  <option value="JOIN_ORG">加入组织</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                  用户ID
                </label>
                <input
                  type="number"
                  value={filter.userId}
                  onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                  placeholder="输入用户ID"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                  开始日期
                </label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                  结束日期
                </label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
              </div>

              <button
                onClick={handleSearch}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔍 搜索
              </button>
            </div>
          </div>

          {/* 日志列表 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
              加载中...
            </div>
          ) : logs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px',
              background: 'rgba(30, 30, 50, 0.8)',
              borderRadius: '12px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              暂无日志记录
            </div>
          ) : (
            <>
              <div style={{
                background: 'rgba(30, 30, 50, 0.8)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.9rem'
                }}>
                  <thead>
                    <tr style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>时间</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>用户</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>操作</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>详情</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#fff' }}>IP地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: index < logs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.7)' }}>
                          {formatDate(log.created_at)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: '#fff' }}>{log.username}</span>
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            background: log.role === 'admin' ? 'rgba(239,68,68,0.3)' :
                                       log.role === 'teacher' ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)',
                            borderRadius: '4px',
                            color: '#fff'
                          }}>
                            {log.role === 'admin' ? '管理员' : log.role === 'teacher' ? '教师' : '学生'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: '4px',
                            color: '#a5b4fc'
                          }}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)', maxWidth: '300px' }}>
                          {log.details ? (
                            <pre style={{
                              margin: 0,
                              fontSize: '0.75rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all'
                            }}>
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                marginTop: '20px'
              }}>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: pagination.page <= 1 ? 0.5 : 1
                  }}
                >
                  上一页
                </button>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                  第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    opacity: pagination.page >= pagination.totalPages ? 0.5 : 1
                  }}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'stats' && stats && (
        <div>
          {/* 统计概览 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'rgba(30, 30, 50, 0.8)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', color: '#6366f1' }}>{stats.totalCount}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>总操作数</div>
            </div>
            <div style={{
              background: 'rgba(30, 30, 50, 0.8)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', color: '#8b5cf6' }}>{stats.days}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>统计天数</div>
            </div>
          </div>

          {/* 操作统计 */}
          <div style={{
            background: 'rgba(30, 30, 50, 0.8)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>📊 操作类型统计</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px'
            }}>
              {stats.actionStats.map((stat, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', color: '#a5b4fc', fontWeight: 'bold' }}>
                    {stat.count}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                    {getActionLabel(stat.action)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 用户统计 */}
          <div style={{
            background: 'rgba(30, 30, 50, 0.8)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>👥 用户操作排行</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>排名</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>用户</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>操作次数</th>
                </tr>
              </thead>
              <tbody>
                {stats.userStats.map((stat, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px', color: index < 3 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '8px', color: '#fff' }}>
                      {stat.display_name || stat.username}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#a5b4fc' }}>
                      {stat.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
