import React, { useState, useEffect } from 'react';

/**
 * 学习伴侣组件 - 为小白提供上下文相关的智能提示
 * 
 * 特性：
 * - 根据当前状态自动推荐下一步操作
 * - 可爱的动画效果吸引注意力
 * - 可折叠/展开
 * - 智能检测用户是否卡住
 * - 响应式设计
 */
export default function LearningCompanion({ 
  pointsCount = 0, 
  lossHistoryLength = 0, 
  currentLoss = null,
  isTraining = false,
  mode = 'TRAIN', // 'TRAIN' | 'INFERENCE'
  labType = 'LINEAR' // 'LINEAR' | 'LOGISTIC' | 'NN'
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [currentHint, setCurrentHint] = useState(0);
  const [showNewHint, setShowNewHint] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // 卡住检测：超过 10 秒没有操作
  const [stuckTime, setStuckTime] = useState(0);
  
  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // 根据场景生成提示
  const getHints = () => {
    const hints = [];
    
    if (labType === 'LINEAR') {
      if (pointsCount === 0) {
        hints.push({
          icon: '👆',
          text: '点击左边的画板，添加一些数据点吧！',
          action: '添加数据'
        });
        hints.push({
          icon: '💡',
          text: '试着在画布上随意点击，添加不同位置的数据点',
          action: '添加数据'
        });
      } else if (pointsCount < 3) {
        hints.push({
          icon: '👍',
          text: '不错！再添加几个点，训练效果会更好',
          action: '继续添加'
        });
      } else if (lossHistoryLength === 0 && !isTraining) {
        hints.push({
          icon: '🚀',
          text: '数据准备好了！点击"自动训练"开始学习',
          action: '开始训练'
        });
        hints.push({
          icon: '✨',
          text: '试试点击"自动训练"按钮，让 AI 开始学习！',
          action: '开始训练'
        });
      } else if (isTraining) {
        hints.push({
          icon: '🔥',
          text: '训练中...观察 Loss 值是否在下降！',
          action: '观察中'
        });
      } else if (currentLoss !== null && currentLoss < 0.1) {
        hints.push({
          icon: '🎉',
          text: 'Loss 已经很低了！试试切换到"预测推理"模式',
          action: '推理测试'
        });
      } else if (currentLoss !== null && currentLoss > 0.5) {
        hints.push({
          icon: '🤔',
          text: 'Loss 有点高，试试调大一点学习率',
          action: '调整参数'
        });
      }
    } else if (labType === 'NN') {
      if (pointsCount === 0) {
        hints.push({
          icon: '🧠',
          text: '点击"同心圆"或"异或"按钮生成数据集',
          action: '生成数据'
        });
      } else if (lossHistoryLength === 0 && !isTraining) {
        hints.push({
          icon: '⚡',
          text: '点击"深度学习"按钮，让神经元开始学习！',
          action: '开始训练'
        });
      }
    }
    
    // 默认提示
    if (hints.length === 0) {
      hints.push({
        icon: '🤖',
        text: '继续探索，尝试不同的操作！',
        action: '探索中'
      });
    }
    
    return hints;
  };
  
  const hints = getHints();
  
  // 自动轮换提示
  useEffect(() => {
    if (hints.length > 1) {
      const interval = setInterval(() => {
        setCurrentHint(prev => (prev + 1) % hints.length);
        setShowNewHint(true);
        setTimeout(() => setShowNewHint(false), 300);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [hints.length]);
  
  // 状态变化时重置提示索引
  useEffect(() => {
    setCurrentHint(0);
  }, [pointsCount, lossHistoryLength, isTraining, currentLoss]);
  
  // 3 秒后自动显示
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  
  // 键盘快捷键切换
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'h' && e.altKey) {
        setIsExpanded(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  if (!isVisible) return null;
  
  const currentHintData = hints[currentHint % hints.length];
  
  return (
    <>
      <style>{`
        @keyframes companionBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes companionFloat {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-5px) rotate(3deg); }
        }
        @keyframes hintSlideIn {
          0% { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 4px 30px rgba(99, 102, 241, 0.6); }
        }
      `}</style>
      
      {/* 悬浮助手主体 */}
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '80px' : '24px',
        right: '24px',
        zIndex: 10004,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: isMobile ? '8px' : '12px',
        maxWidth: '100%'
      }}>
        {/* 提示气泡 */}
        {isExpanded && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(45, 45, 70, 0.98))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '12px 14px' : '16px 20px',
            maxWidth: isMobile ? '250px' : '300px',
            animation: 'hintSlideIn 0.3s ease-out',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            {/* 头部 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                fontSize: '1.5rem',
                animation: 'companionFloat 2s ease-in-out infinite'
              }}>
                🐰
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>
                  学习伴侣
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  随时为你提供帮助
                </div>
              </div>
            </div>
            
            {/* 提示内容 */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              animation: showNewHint ? 'hintSlideIn 0.3s ease-out' : 'none'
            }}>
              <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>{currentHintData.icon}</div>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '0.85rem', 
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: 1.5
                }}>
                  {currentHintData.text}
                </p>
                <div style={{
                  marginTop: '8px',
                  fontSize: '0.7rem',
                  color: 'var(--accent-blue)',
                  fontWeight: 'bold'
                }}>
                  {currentHintData.action && `💡 建议: ${currentHintData.action}`}
                </div>
              </div>
            </div>
            
            {/* 底部导航 */}
            {hints.length > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {hints.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setCurrentHint(i)}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: i === (currentHint % hints.length) 
                        ? 'var(--accent-blue)' 
                        : 'rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* 悬浮按钮 */}
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          style={{
            width: isExpanded ? '56px' : '48px',
            height: isExpanded ? '56px' : '48px',
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isExpanded ? '1.3rem' : '1.2rem',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)',
            animation: 'pulseGlow 2s ease-in-out infinite',
            transition: 'all 0.3s ease',
            transform: isExpanded ? 'scale(1)' : 'scale(1)'
          }}
          title={isExpanded ? '收起学习伴侣' : '展开学习伴侣 (Alt+H)'}
        >
          {isExpanded ? '✕' : '🐰'}
        </button>
      </div>
    </>
  );
}
