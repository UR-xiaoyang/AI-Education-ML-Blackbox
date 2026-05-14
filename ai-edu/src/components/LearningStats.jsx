import React, { useState, useEffect } from 'react';
import useAchievementStore from '../store/achievementStore';

/**
 * 学习数据统计面板
 * 追踪学习时长、进度、成就完成率等
 */
export default function LearningStats({ isVisible = false, onClose }) {
  const [isMobile, setIsMobile] = useState(false);
  const { xp, achievements } = useAchievementStore();
  
  // 本地统计数据
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('ai-edu-stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      // 如果是同一天，更新；否则重置
      const today = new Date().toDateString();
      if (parsed.lastDate === today) {
        return parsed;
      }
    }
    return {
      totalTime: 0,
      todayTime: 0,
      sessionsCount: 0,
      labsCompleted: 0,
      quizAnswered: 0,
      quizCorrect: 0,
      lastDate: new Date().toDateString(),
      dailyGoal: 30, // 分钟
      streakDays: 1
    };
  });

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 定时保存学习时长
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setStats(prev => {
        const updated = {
          ...prev,
          totalTime: prev.totalTime + 1,
          todayTime: prev.todayTime + 1
        };
        localStorage.setItem('ai-edu-stats', JSON.stringify(updated));
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 格式化时间
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分`;
    }
    return `${mins}分钟`;
  };

  // 计算成就完成率
  const totalAchievements = 30;
  const achievementRate = Math.round((achievements.length / totalAchievements) * 100);

  // 计算今日目标完成度
  const dailyProgress = Math.min(100, Math.round((stats.todayTime / 60 / stats.dailyGoal) * 100));

  // 等级进度
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const levelProgress = xpInLevel;

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes slideInStats {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* 背景遮罩 */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10004
        }}
        onClick={onClose}
      />

      {/* 面板 */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: isMobile ? '95%' : '90%',
        maxWidth: '500px',
        maxHeight: isMobile ? '90vh' : '85vh',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: isMobile ? '20px' : '24px',
        padding: isMobile ? '20px' : '28px',
        zIndex: 10005,
        animation: 'slideInStats 0.3s ease-out',
        overflow: 'auto'
      }}>
        {/* 头部 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1.3rem' : '1.5rem', color: '#fff' }}>
              📊 学习数据中心
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
              记录你的每一步成长
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: isMobile ? '32px' : '36px',
              height: isMobile ? '32px' : '36px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* 今日目标 */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>
              🎯 今日目标
            </span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              {Math.floor(stats.todayTime / 60)} / {stats.dailyGoal} 分钟
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '12px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${dailyProgress}%`,
              height: '100%',
              background: dailyProgress >= 100 
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: '6px',
              transition: 'width 0.5s ease',
              animation: dailyProgress < 100 ? 'progressPulse 2s ease-in-out infinite' : 'none'
            }} />
          </div>
          {dailyProgress >= 100 && (
            <div style={{
              marginTop: '8px',
              fontSize: '0.85rem',
              color: '#22c55e',
              fontWeight: 'bold'
            }}>
              ✅ 今日目标已达成！
            </div>
          )}
        </div>

        {/* 统计卡片网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {/* 总学习时长 */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>⏱️</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#fff' }}>
              {formatTime(stats.totalTime)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              总学习时长
            </div>
          </div>

          {/* 成就数 */}
          <div style={{
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🏆</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>
              {achievements.length}/{totalAchievements}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              成就徽章
            </div>
          </div>

          {/* XP */}
          <div style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>⭐</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {xp}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              经验值 XP
            </div>
          </div>

          {/* 等级 */}
          <div style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎖️</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#fbbf24' }}>
              Lv.{level}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              当前等级
            </div>
          </div>

          {/* 成就完成率 */}
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📈</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#22c55e' }}>
              {achievementRate}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              成就完成率
            </div>
          </div>

          {/* 学习天数 */}
          <div style={{
            background: 'rgba(168,85,247,0.1)',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📅</div>
            <div style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: 'bold', color: '#a855f7' }}>
              {stats.streakDays}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              连续学习
            </div>
          </div>
        </div>

        {/* 等级进度详情 */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              距离下一级
            </span>
            <span style={{ fontSize: '0.85rem', color: '#8b5cf6' }}>
              {levelProgress}/100 XP
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${levelProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: '4px'
            }} />
          </div>
        </div>

        {/* 提示文字 */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(99,102,241,0.1)',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center'
        }}>
          💡 统计数据保存在本地，每天坚持学习可以解锁更多成就！
        </div>
      </div>
    </>
  );
}
