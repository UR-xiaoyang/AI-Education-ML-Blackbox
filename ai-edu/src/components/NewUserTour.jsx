import React, { useState, useEffect } from 'react';

/**
 * 新手引导 Tour
 * 第一次使用时引导用户了解界面
 */
export default function NewUserTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // 检测是否是第一次使用
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('ai-edu-tour-seen');
    if (!hasSeenTour) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const steps = [
    {
      target: null,
      title: '👋 欢迎来到 AI 黑盒实验室！',
      content: '这是一个交互式机器学习教育平台，让你亲手体验 AI 是如何学习的。',
      position: 'center'
    },
    {
      target: '[data-tour="labs"]',
      title: '🧪 选择实验室',
      content: '这里有多个实验室，每个实验室有不同的机器学习主题。线性回归、神经网络、决策树...',
      position: 'bottom'
    },
    {
      target: '[data-tour="achievement"]',
      title: '🏆 成就系统',
      content: '完成学习和实验可以获得 XP 和徽章，解锁更高等级！',
      position: 'bottom'
    },
    {
      target: '[data-tour="companion"]',
      title: '🐰 学习伴侣',
      content: '遇到困难时，点击右下角的兔子可以获得提示和帮助。',
      position: 'right'
    },
    {
      target: null,
      title: '🚀 开始学习！',
      content: '准备好了！点击"开始自习模式"，选择一个实验室开始你的 AI 学习之旅吧！',
      position: 'center'
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // 完成引导
      localStorage.setItem('ai-edu-tour-seen', 'true');
      setIsVisible(false);
      if (onComplete) onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('ai-edu-tour-seen', 'true');
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const currentStep = steps[step];

  return (
    <>
      <style>{`
        @keyframes tourFadeIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* 遮罩层 */}
      {currentStep.target && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 10008
        }} />
      )}

      {/* 引导内容 */}
      <div style={{
        position: 'fixed',
        ...(currentStep.position === 'center' ? {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        } : currentStep.position === 'bottom' ? {
          bottom: '120px',
          left: '50%',
          transform: 'translateX(-50%)'
        } : currentStep.position === 'right' ? {
          bottom: '100px',
          right: '24px'
        } : {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }),
        width: '90%',
        maxWidth: '400px',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        border: '2px solid rgba(99, 102, 241, 0.6)',
        borderRadius: '20px',
        padding: '24px',
        zIndex: 10009,
        animation: 'tourFadeIn 0.3s ease-out',
        boxShadow: '0 10px 40px rgba(99, 102, 241, 0.3)'
      }}>
        {/* 步骤指示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === step 
                  ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                  : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        {/* 标题 */}
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '1.2rem',
          color: '#fff'
        }}>
          {currentStep.title}
        </h3>

        {/* 内容 */}
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.8)',
          lineHeight: 1.6
        }}>
          {currentStep.content}
        </p>

        {/* 按钮 */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={handleSkip}
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            跳过
          </button>
          <button
            onClick={handleNext}
            style={{
              flex: 2,
              padding: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            {step === steps.length - 1 ? '开始学习！' : '下一步 →'}
          </button>
        </div>
      </div>

      {/* 装饰性箭头 (如果需要指向某个元素) */}
      {currentStep.target && (
        <div style={{
          position: 'fixed',
          top: '50%',
          right: '24px',
          transform: 'translateY(-50%)',
          zIndex: 10009
        }}>
          <div style={{
            fontSize: '2rem',
            animation: 'bounce 1s ease-in-out infinite'
          }}>
            👆
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </>
  );
}
