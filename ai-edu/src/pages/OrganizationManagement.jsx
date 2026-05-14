import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function OrganizationManagement() {
  const { user, token, isAdmin } = useAuthStore();
  const [activeTab, setActiveTab] = useState('my-orgs'); // 'my-orgs' | 'all-orgs'
  const [organizations, setOrganizations] = useState({ owned: [], joined: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 创建组织 Modal 状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', description: '', type: 'class' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // 加入组织 Modal 状态
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // 组织详情 Modal 状态
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 搜索/过滤状态
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || '获取组织列表失败');
        setOrganizations(data);
      } catch (parseError) {
        console.error('解析响应失败:', text);
        throw new Error('数据格式错误，请刷新页面重试');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!newOrg.name.trim()) {
      setCreateError('请输入组织名称');
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newOrg.name.trim(),
          description: newOrg.description.trim(),
          type: newOrg.type
        })
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('创建组织响应:', text);
        throw new Error('数据格式错误，请稍后重试');
      }
      if (!response.ok) throw new Error(data.error || '创建组织失败');

      setShowCreateModal(false);
      setNewOrg({ name: '', description: '', type: 'class' });
      fetchOrganizations();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinOrg = async (e) => {
    e.preventDefault();
    setJoinError('');

    if (!inviteCode.trim()) {
      setJoinError('请输入邀请码');
      return;
    }

    setJoinLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/organizations/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() })
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('加入组织响应:', text);
        throw new Error('数据格式错误，请稍后重试');
      }
      if (!response.ok) throw new Error(data.error || '加入组织失败');

      setShowJoinModal(false);
      setInviteCode('');
      fetchOrganizations();
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleViewOrg = async (orgId) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || '获取组织详情失败');
        setOrgDetails(data.organization);
        setSelectedOrg(orgId);
      } catch (parseError) {
        console.error('获取组织详情响应:', text);
        throw new Error('数据格式错误，请稍后重试');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDeleteOrg = async (orgId) => {
    if (!window.confirm('确定要删除此组织吗？此操作不可撤销。')) return;

    try {
      const response = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || '删除组织失败');
      } catch (parseError) {
        console.error('删除组织响应:', text);
        throw new Error('数据格式错误，请稍后重试');
      }

      setSelectedOrg(null);
      setOrgDetails(null);
      fetchOrganizations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (orgId, memberId) => {
    if (!window.confirm('确定要移除此成员吗？')) return;

    try {
      const response = await fetch(`${API_URL}/api/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.error || '移除成员失败');
      } catch (parseError) {
        console.error('移除成员响应:', text);
        throw new Error('数据格式错误，请稍后重试');
      }

      // 刷新组织详情
      handleViewOrg(orgId);
    } catch (err) {
      setError(err.message);
    }
  };

  // 过滤组织列表
  const filteredOwned = organizations.owned.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredJoined = organizations.joined.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allOrgs = isAdmin() ? [...organizations.owned, ...organizations.joined] : [...organizations.owned, ...organizations.joined];
  const filteredAll = allOrgs.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (type) => {
    const labels = { class: '班级', organization: '组织', group: '小组' };
    return labels[type] || type;
  };

  return (
    <div className="org-management">
      {/* Header */}
      <div className="org-header">
        <div className="org-title">
          <h3>🏫 组织管理</h3>
          <p>创建班级或组织，管理成员，查看定向学生的统计数据</p>
        </div>
        <div className="org-header-actions">
          <button className="btn" onClick={() => setShowJoinModal(true)}>
            🔗 加入组织
          </button>
          {(user?.role === 'admin' || user?.role === 'teacher') && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ 创建组织
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="org-tabs">
        <button
          className={`org-tab ${activeTab === 'my-orgs' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-orgs')}
        >
          我的组织 ({organizations.owned.length})
        </button>
        <button
          className={`org-tab ${activeTab === 'joined' ? 'active' : ''}`}
          onClick={() => setActiveTab('joined')}
        >
          加入的组织 ({organizations.joined.length})
        </button>
        {isAdmin() && (
          <button
            className={`org-tab ${activeTab === 'all-orgs' ? 'active' : ''}`}
            onClick={() => setActiveTab('all-orgs')}
          >
            全部组织
          </button>
        )}
      </div>

      {/* Search */}
      <div className="org-search">
        <input
          type="text"
          placeholder="搜索组织名称..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="org-error">
          <span>⚠️</span> {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="org-loading">
          <span>⏳</span> 加载中...
        </div>
      )}

      {/* Organization List */}
      {!isLoading && (
        <div className="org-list">
          {activeTab === 'my-orgs' && filteredOwned.length === 0 && (
            <div className="org-empty">
              <span>🏫</span>
              <p>您还没有创建任何组织</p>
              <span className="org-hint">点击"创建组织"开始</span>
            </div>
          )}

          {activeTab === 'joined' && filteredJoined.length === 0 && (
            <div className="org-empty">
              <span>🔗</span>
              <p>您还没有加入任何组织</p>
              <span className="org-hint">使用邀请码加入组织</span>
            </div>
          )}

          {activeTab === 'all-orgs' && filteredAll.length === 0 && (
            <div className="org-empty">
              <span>🏫</span>
              <p>没有找到组织</p>
            </div>
          )}

          {(activeTab === 'my-orgs' ? filteredOwned : activeTab === 'joined' ? filteredJoined : filteredAll).map(org => (
            <div key={org.id} className="org-card">
              <div className="org-card-header">
                <div className="org-card-info">
                  <h4>{org.name}</h4>
                  <span className="org-type-badge">{getTypeLabel(org.type)}</span>
                </div>
                <div className="org-card-actions">
                  <button className="btn" onClick={() => handleViewOrg(org.id)}>
                    查看详情
                  </button>
                  {org.owner_id === user?.userId && (
                    <button
                      className="btn"
                      style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)' }}
                      onClick={() => handleDeleteOrg(org.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              {org.description && (
                <p className="org-card-desc">{org.description}</p>
              )}
              <div className="org-card-meta">
                <span>👥 {org.member_count || 1} 名成员</span>
                <span>📅 创建于 {new Date(org.created_at).toLocaleDateString()}</span>
                {org.invite_code && (
                  <span className="org-invite-code">🔑 {org.invite_code}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Organization Details Modal */}
      {selectedOrg && orgDetails && (
        <div className="org-modal-overlay" onClick={() => setSelectedOrg(null)}>
          <div className="org-modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <div>
                <h3>{orgDetails.name}</h3>
                <span className="org-type-badge">{getTypeLabel(orgDetails.type)}</span>
              </div>
              <button className="org-modal-close" onClick={() => setSelectedOrg(null)}>✕</button>
            </div>

            {orgDetails.description && (
              <p className="org-modal-desc">{orgDetails.description}</p>
            )}

            {orgDetails.invite_code && (
              <div className="org-invite-display">
                <span>邀请码：</span>
                <code>{orgDetails.invite_code}</code>
                <span className="org-invite-hint">分享此邀请码给学生加入</span>
              </div>
            )}

            <div className="org-members-section">
              <h4>成员列表 ({orgDetails.members?.length || 0})</h4>
              <div className="org-members-list">
                {orgDetails.members?.map(member => (
                  <div key={member.id} className="org-member-item">
                    <div className="org-member-info">
                      <span className="org-member-name">
                        {member.display_name || member.username}
                        {member.id === orgDetails.owner_id && <span className="org-owner-badge">👑</span>}
                      </span>
                      <span className="org-member-email">{member.email}</span>
                    </div>
                    <div className="org-member-actions">
                      <span className={`org-member-role ${member.org_role}`}>
                        {member.org_role === 'admin' ? '管理员' : '成员'}
                      </span>
                      {orgDetails.isOwner && member.id !== orgDetails.owner_id && (
                        <button
                          className="btn"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => handleRemoveMember(orgDetails.id, member.id)}
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="org-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="org-modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>创建组织</h3>
              <button className="org-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            {createError && (
              <div className="org-modal-error">
                <span>⚠️</span> {createError}
              </div>
            )}

            <form className="org-modal-form" onSubmit={handleCreateOrg}>
              <div className="org-modal-field">
                <label>组织名称 <span className="required">*</span></label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  placeholder="例如：2024级机器学习班"
                  required
                  maxLength={100}
                />
              </div>

              <div className="org-modal-field">
                <label>组织类型</label>
                <select
                  value={newOrg.type}
                  onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}
                >
                  <option value="class">班级</option>
                  <option value="organization">组织</option>
                  <option value="group">小组</option>
                </select>
              </div>

              <div className="org-modal-field">
                <label>描述（选填）</label>
                <textarea
                  value={newOrg.description}
                  onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                  placeholder="简要描述这个组织"
                  rows={3}
                />
              </div>

              <div className="org-modal-actions">
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? '创建中...' : '创建组织'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Organization Modal */}
      {showJoinModal && (
        <div className="org-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="org-modal" onClick={(e) => e.stopPropagation()}>
            <div className="org-modal-header">
              <h3>加入组织</h3>
              <button className="org-modal-close" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>

            {joinError && (
              <div className="org-modal-error">
                <span>⚠️</span> {joinError}
              </div>
            )}

            <form className="org-modal-form" onSubmit={handleJoinOrg}>
              <div className="org-modal-field">
                <label>邀请码 <span className="required">*</span></label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="输入8位邀请码"
                  required
                  maxLength={20}
                  style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                />
              </div>

              <div className="org-modal-actions">
                <button type="button" className="btn" onClick={() => setShowJoinModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={joinLoading}>
                  {joinLoading ? '加入中...' : '加入组织'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .org-management {
          padding: 0;
        }

        .org-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding: 16px 20px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
        }

        .org-title h3 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
        }

        .org-title p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .org-header-actions {
          display: flex;
          gap: 8px;
        }

        .org-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
        }

        .org-tab {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .org-tab:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }

        .org-tab.active {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }

        .org-search {
          margin-bottom: 16px;
        }

        .org-search input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 0.9rem;
        }

        .org-search input:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .org-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .org-error button {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
        }

        .org-loading {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
        }

        .org-empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-secondary);
        }

        .org-empty span:first-child {
          font-size: 3rem;
          display: block;
          margin-bottom: 16px;
        }

        .org-empty p {
          margin: 0 0 8px 0;
          font-size: 1rem;
        }

        .org-hint {
          font-size: 0.85rem;
          opacity: 0.6;
        }

        .org-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .org-card {
          padding: 16px 20px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .org-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .org-card-info h4 {
          margin: 0 0 6px 0;
          font-size: 1rem;
        }

        .org-type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }

        .org-card-actions {
          display: flex;
          gap: 8px;
        }

        .org-card-desc {
          margin: 0 0 12px 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .org-card-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.8);
        }

        .org-invite-code {
          font-family: monospace;
          color: #fbbf24;
        }

        /* Modal Styles */
        .org-modal-overlay {
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
          z-index: 10002;
          padding: 20px;
        }

        .org-modal {
          background: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 85vh;
          overflow-y: auto;
        }

        .org-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .org-modal-header h3 {
          margin: 0;
        }

        .org-modal-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px;
        }

        .org-modal-close:hover {
          color: #fff;
        }

        .org-modal-desc {
          padding: 16px 24px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .org-invite-display {
          margin: 0 24px 16px;
          padding: 12px 16px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .org-invite-display code {
          font-size: 1.4rem;
          font-weight: bold;
          color: #fbbf24;
          letter-spacing: 4px;
        }

        .org-invite-hint {
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.7);
        }

        .org-members-section {
          padding: 16px 24px 24px;
        }

        .org-members-section h4 {
          margin: 0 0 12px 0;
          font-size: 0.95rem;
        }

        .org-members-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .org-member-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .org-member-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .org-member-name {
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .org-owner-badge {
          font-size: 0.9rem;
        }

        .org-member-email {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .org-member-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .org-member-role {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .org-member-role.admin {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .org-member-role.member {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
        }

        .org-modal-error {
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

        .org-modal-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .org-modal-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .org-modal-field label {
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.9);
          font-weight: 500;
        }

        .org-modal-field .required {
          color: var(--accent-red);
        }

        .org-modal-field input,
        .org-modal-field select,
        .org-modal-field textarea {
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-size: 0.95rem;
          font-family: inherit;
        }

        .org-modal-field input:focus,
        .org-modal-field select:focus,
        .org-modal-field textarea:focus {
          outline: none;
          border-color: var(--accent-blue);
        }

        .org-modal-field textarea {
          resize: vertical;
        }

        .org-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
