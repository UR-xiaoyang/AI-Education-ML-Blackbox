import React, { useState, useEffect, useRef } from 'react';
import useAchievementStore from '../store/achievementStore';

/**
 * 成就系统 - 游戏化学习体验
 *
 * 特性：
 * - 积分系统 (XP)
 * - 等级系统
 * - 徽章收集
 * - 成就解锁动画（仅在获得经验时出现）
 * - 响应式设计
 */
export default function AchievementSystem({
  xp: xpProp,
  achievements: achievementsProp,
  onAchievementClick,
  onStatsClick,
  currentLab = 'LINEAR'
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [newAchievement, setNewAchievement] = useState(null);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showXpBar, setShowXpBar] = useState(false);
  const [xpGainAmount, setXpGainAmount] = useState(0);
  const prevXpRef = useRef(0);

  // 直接从 store 获取最新数据，而非依赖 props
  const xp = useAchievementStore((state) => state.xp);
  const achievements = useAchievementStore((state) => state.achievements);
  const latestUnlock = useAchievementStore((state) => state.latestUnlock);

  // 监听 XP 变化，显示通知和状态栏
  useEffect(() => {
    if (xp > prevXpRef.current) {
      const gained = xp - prevXpRef.current;
      setXpGainAmount(gained);
      setShowNotification(true);
      setShowXpBar(true);
      // 5秒后自动隐藏通知和状态栏
      const timer = setTimeout(() => {
        setShowNotification(false);
        setShowXpBar(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    prevXpRef.current = xp;
  }, [xp]);

  // 监听新成就解锁
  useEffect(() => {
    if (latestUnlock) {
      setShowNotification(true);
      setShowXpBar(true);
    }
  }, [latestUnlock]);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 等级计算 (每100 XP升一级)
  const level = Math.floor(xp / 100) + 1;
  const xpInCurrentLevel = xp % 100;
  const xpNeededForNextLevel = 100;

  // 等级名称
  const levelNames = [
    '机器学习小白',    // 1
    '初露头角',        // 2
    '渐入佳境',        // 3
    '小有成就',        // 4
    '熟能生巧',        // 5
    '胸有成竹',        // 6
    '融会贯通',        // 7
    '炉火纯青',        // 8
    '大师风范',        // 9
    'AI 大师'          // 10
  ];
  const levelName = levelNames[Math.min(level - 1, levelNames.length - 1)];

  return (
    <>
      <style>{`
        @keyframes xpGain {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes achievementUnlock {
          0% { transform: translateY(100px) scale(0.5); opacity: 0; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 1; }
          70% { transform: translateY(10px) scale(0.95); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes notificationSlideIn {
          0% { transform: translateX(-50%) translateY(-100px); opacity: 0; }
          15% { transform: translateX(-50%) translateY(0); opacity: 1; }
          85% { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-100px); opacity: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>

      {/* XP/成就通知 - 仅在获得经验时显示 */}
      {showNotification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10006,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(20, 20, 40, 0.95)',
            padding: '12px 24px',
            borderRadius: '20px',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            animation: 'notificationSlideIn 5s ease-in-out forwards',
            cursor: 'pointer'
          }}
          onClick={() => {
            setShowNotification(false);
            setShowPanel(true);
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>✨</span>
          <span style={{ fontSize: '0.9rem', color: '#fff' }}>
            获得 <strong style={{ color: '#fbbf24' }}>+{xpGainAmount} XP</strong>
          </span>
          {latestUnlock && (
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              解锁成就：{latestUnlock.icon} {latestUnlock.name}
            </span>
          )}
        </div>
      )}

      {/* 成就状态栏 - 仅在获得经验时显示，数秒后消失 */}
      {showXpBar && (
        <div
          style={{
            position: 'fixed',
            top: isMobile ? '70px' : '80px',
            left: isMobile ? '10px' : '50%',
            right: isMobile ? '10px' : 'auto',
            transform: isMobile ? 'none' : 'translateX(-50%)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'center',
            gap: isMobile ? '8px' : '16px',
            background: 'rgba(20, 20, 40, 0.95)',
            padding: isMobile ? '8px 12px' : '10px 20px',
            borderRadius: isMobile ? '16px' : '30px',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            cursor: 'pointer',
            flexWrap: 'wrap',
            maxWidth: isMobile ? '100%' : '400px'
          }}
          onClick={() => setShowPanel(true)}
        >
          {/* 等级徽章 */}
          <div style={{
            width: isMobile ? '32px' : '40px',
            height: isMobile ? '32px' : '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '1rem' : '1.2rem',
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: '0 0 15px rgba(251, 191, 36, 0.5)',
            flexShrink: 0
          }}>
            {level}
          </div>

          {/* XP 进度条 - 移动端隐藏文字 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: isMobile ? '80px' : '120px',
            flex: isMobile ? '1' : 'none'
          }}>
            <div style={{
              fontSize: isMobile ? '0.65rem' : '0.75rem',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ display: isMobile ? 'none' : 'inline' }}>{levelName}</span>
              <span>{xp} XP</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(xpInCurrentLevel / xpNeededForNextLevel) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                borderRadius: '3px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>

          {/* 徽章数量 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '4px' : '6px',
            padding: isMobile ? '4px 8px' : '6px 12px',
            background: 'rgba(251, 191, 36, 0.15)',
            borderRadius: isMobile ? '10px' : '15px',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            flexShrink: 0
          }}>
            <span style={{ fontSize: isMobile ? '0.9rem' : '1.1rem' }}>🏆</span>
            <span style={{
              fontSize: isMobile ? '0.75rem' : '0.85rem',
              fontWeight: 'bold',
              color: '#fbbf24'
            }}>
              {achievements.length}
            </span>
          </div>
        </div>
      )}

      {/* 成就面板 */}
      {showPanel && (
        <>
          {/* 背景遮罩 */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 10004
            }}
            onClick={() => setShowPanel(false)}
          />

          {/* 面板 - 响应式 */}
          <div style={{
            position: 'fixed',
            top: isMobile ? '10%' : '50%',
            left: '50%',
            transform: isMobile ? 'translateX(-50%)' : 'translate(-50%, -50%)',
            width: isMobile ? '95%' : '90%',
            maxWidth: '600px',
            maxHeight: isMobile ? '85vh' : '80vh',
            background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '16px' : '24px',
            zIndex: 10005,
            overflow: 'auto'
          }}>
            {/* 头部 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobile ? '12px' : '20px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.5rem', color: '#fff' }}>📊 学习成就</h2>
                <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
                  等级 {level} · {levelName} · {xp} XP
                </p>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
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

            {/* 学习数据中心入口 */}
            {onStatsClick && (
              <button
                onClick={() => {
                  setShowPanel(false);
                  onStatsClick();
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                📊 查看学习数据中心
              </button>
            )}

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                <span>等级 {level}</span>
                <span>距离等级 {level + 1}：{xpNeededForNextLevel - xpInCurrentLevel} XP</span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(xpInCurrentLevel / xpNeededForNextLevel) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease-out',
                  boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
                }} />
              </div>
            </div>

            {/* 徽章网格 */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: isMobile ? '0.9rem' : '1rem', color: '#fff' }}>
                🏆 我的徽章 ({achievements.length}/{getTotalAchievements().length})
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile 
                  ? 'repeat(2, 1fr)' 
                  : 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: isMobile ? '8px' : '12px'
              }}>
                {getTotalAchievements().map(achievement => {
                  const isUnlocked = achievements.includes(achievement.id);
                  return (
                    <div
                      key={achievement.id}
                      style={{
                        background: isUnlocked 
                          ? 'rgba(251, 191, 36, 0.1)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${isUnlocked 
                          ? 'rgba(251, 191, 36, 0.4)' 
                          : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: isMobile ? '8px' : '12px',
                        padding: isMobile ? '10px' : '16px',
                        textAlign: 'center',
                        opacity: isUnlocked ? 1 : 0.5,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        fontSize: '2.5rem',
                        marginBottom: '8px',
                        animation: isUnlocked ? 'float 2s ease-in-out infinite' : 'none'
                      }}>
                        {isUnlocked ? achievement.icon : '🔒'}
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: isUnlocked ? '#fbbf24' : 'rgba(255, 255, 255, 0.5)',
                        marginBottom: '4px'
                      }}>
                        {achievement.name}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'rgba(255, 255, 255, 0.5)'
                      }}>
                        +{achievement.xp} XP
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * 获取所有成就定义
 */
export function getTotalAchievements() {
  return [
    // 入门成就
    {
      id: 'FIRST_POINT',
      name: '初试锋芒',
      icon: '🎯',
      xp: 10,
      description: '添加第一个数据点',
      lab: 'LINEAR'
    },
    {
      id: 'FIRST_TRAIN',
      name: '开始学习',
      icon: '🚀',
      xp: 10,
      description: '开始第一次训练',
      lab: 'LINEAR'
    },
    {
      id: 'FIRST_LOSS_DROP',
      name: '渐入佳境',
      icon: '📉',
      xp: 20,
      description: 'Loss 首次下降超过 50%',
      lab: 'LINEAR'
    },
    {
      id: 'FIRST_QUIZ',
      name: '学而不厌',
      icon: '📝',
      xp: 15,
      description: '完成第一个小测验',
      lab: 'ALL'
    },
    {
      id: 'CORRECT_QUIZ',
      name: '答如泉涌',
      icon: '🧠',
      xp: 25,
      description: '答对一道测验题',
      lab: 'ALL'
    },
    
    // 线性回归成就
    {
      id: 'LINEAR_MASTER',
      name: '线性大师',
      icon: '📈',
      xp: 50,
      description: '完成线性回归实验',
      lab: 'LINEAR'
    },
    {
      id: 'LOW_LOSS',
      name: '精益求精',
      icon: '🎯',
      xp: 30,
      description: '将 Loss 降到 0.1 以下',
      lab: 'LINEAR'
    },
    {
      id: 'INFERENCE_MODE',
      name: '学以致用',
      icon: '🧪',
      xp: 20,
      description: '首次进入推理模式',
      lab: 'LINEAR'
    },
    
    // 神经网络成就
    {
      id: 'NN_EXPLORER',
      name: '神经网络探索者',
      icon: '🧠',
      xp: 30,
      description: '进入神经网络实验室',
      lab: 'NN'
    },
    {
      id: 'CIRCLE_DATA',
      name: '同心圆专家',
      icon: '⭕',
      xp: 20,
      description: '生成同心圆数据集',
      lab: 'NN'
    },
    {
      id: 'XOR_CHALLENGE',
      name: '异或挑战者',
      icon: '❌',
      xp: 40,
      description: '尝试 XOR 数据集',
      lab: 'NN'
    },
    {
      id: 'DEEP_LEARNING',
      name: '深度学习入门',
      icon: '🔥',
      xp: 30,
      description: '开始深度学习训练',
      lab: 'NN'
    },
    {
      id: 'NN_LOW_LOSS',
      name: '神经网络大师',
      icon: '🏆',
      xp: 50,
      description: '将 NN Loss 降到 0.15 以下',
      lab: 'NN'
    },
    {
      id: '3D_VIEW',
      name: '立体思维',
      icon: '🔮',
      xp: 25,
      description: '首次打开 3D 视角',
      lab: 'NN'
    },
    
    // 逻辑回归成就
    {
      id: 'LOGISTIC_EXPLORER',
      name: '分类探索者',
      icon: '🟠🔵',
      xp: 30,
      description: '进入逻辑回归实验室',
      lab: 'LOGISTIC'
    },
    {
      id: 'CLASSIFIER',
      name: '二分高手',
      icon: '⚖️',
      xp: 40,
      description: '完成逻辑回归分类',
      lab: 'LOGISTIC'
    },
    {
      id: 'LOGISTIC_FIRST_POINT',
      name: '分类初体验',
      icon: '📍',
      xp: 10,
      description: '逻辑回归添加第一个点',
      lab: 'LOGISTIC'
    },
    {
      id: 'LOGISTIC_FIRST_TRAIN',
      name: '分类训练',
      icon: '⚙️',
      xp: 10,
      description: '逻辑回归开始训练',
      lab: 'LOGISTIC'
    },
    {
      id: 'LOGISTIC_INFERENCE',
      name: '分类预测',
      icon: '🔍',
      xp: 20,
      description: '逻辑回归进入推理模式',
      lab: 'LOGISTIC'
    },
    
    // 决策树成就
    {
      id: 'TREE_EXPLORER',
      name: '决策树探索者',
      icon: '🌲',
      xp: 30,
      description: '进入决策树实验室',
      lab: 'TREE'
    },
    {
      id: 'TREE_FIRST_POINT',
      name: '决策初体验',
      icon: '🌱',
      xp: 10,
      description: '决策树添加第一个点',
      lab: 'TREE'
    },
    {
      id: 'TREE_FIRST_SPLIT',
      name: '空间切割',
      icon: '✂️',
      xp: 20,
      description: '完成第一次空间切分',
      lab: 'TREE'
    },
    {
      id: 'TREE_DEPTH_3',
      name: '深度探索',
      icon: '📊',
      xp: 30,
      description: '决策树深度达到3',
      lab: 'TREE'
    },
    
    // 综合成就
    {
      id: 'FIRST_LAB',
      name: '初识 AI',
      icon: '🌟',
      xp: 20,
      description: '完成第一个实验室',
      lab: 'ALL'
    },
    {
      id: 'THREE_LABS',
      name: 'AI 学习者',
      icon: '🎓',
      xp: 100,
      description: '完成三个实验室',
      lab: 'ALL'
    },
    {
      id: 'FIVE_LABS',
      name: 'AI 进阶者',
      icon: '📚',
      xp: 200,
      description: '完成五个实验室',
      lab: 'ALL'
    },
    {
      id: 'XP_100',
      name: '百炼成钢',
      icon: '💯',
      xp: 50,
      description: '累计获得 100 XP',
      lab: 'ALL'
    },
    {
      id: 'XP_500',
      name: '五百里程',
      icon: '🛤️',
      xp: 100,
      description: '累计获得 500 XP',
      lab: 'ALL'
    },
    {
      id: 'LEVEL_5',
      name: '五级高手',
      icon: '⭐',
      xp: 150,
      description: '达到等级 5',
      lab: 'ALL'
    }
  ];
}

/**
 * 根据 ID 获取成就
 */
export function getAchievementById(id) {
  return getTotalAchievements().find(a => a.id === id);
}
