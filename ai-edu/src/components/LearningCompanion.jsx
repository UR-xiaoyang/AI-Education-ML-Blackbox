import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const LIVE2D_MODEL_URL = import.meta.env.VITE_LIVE2D_MODEL_URL || '/live2d/companion/model.model3.json';
const LIVE2D_ENABLED = import.meta.env.VITE_LIVE2D_ENABLED === 'true';
const CARTOON_COMPANION_URL = '/live2d/companion/cartoon-companion.svg';
const scriptPromises = new Map();

function loadScript(src) {
  if (scriptPromises.has(src)) return scriptPromises.get(src);

  const promise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      if (existingScript.dataset.loaded === 'true') resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

function Live2DCompanionAvatar({ size = 96, compact = false }) {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const [status, setStatus] = useState(LIVE2D_ENABLED ? 'loading' : 'disabled');

  useEffect(() => {
    if (!LIVE2D_ENABLED) return undefined;

    let cancelled = false;

    const setupLive2D = async () => {
      try {
        const modelResponse = await fetch(LIVE2D_MODEL_URL, { method: 'HEAD' });
        if (!modelResponse.ok) {
          throw new Error(`Live2D model not found: ${LIVE2D_MODEL_URL}`);
        }

        await loadScript('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/index.min.js');

        if (cancelled || !canvasRef.current) return;

        const { PIXI } = window;
        const Live2DModel = PIXI?.live2d?.Live2DModel;
        if (!PIXI || !Live2DModel) {
          throw new Error('Live2D runtime is unavailable');
        }

        const app = new PIXI.Application({
          view: canvasRef.current,
          width: size,
          height: size,
          transparent: true,
          antialias: true,
          autoStart: true
        });
        appRef.current = app;

        const model = await Live2DModel.from(LIVE2D_MODEL_URL);
        if (cancelled) {
          model.destroy();
          app.destroy(true);
          return;
        }

        model.anchor.set(0.5, 0.5);
        const fitScale = Math.min(size / model.width, size / model.height) * (compact ? 1.1 : 0.95);
        model.scale.set(fitScale);
        model.x = size / 2;
        model.y = size * 0.62;
        app.stage.addChild(model);
        setStatus('ready');
      } catch (error) {
        console.warn('[LearningCompanion] Live2D fallback:', error);
        if (!cancelled) setStatus('fallback');
      }
    };

    setupLive2D();

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, [compact, size]);

  if (status === 'fallback' || status === 'disabled') {
    return (
      <img
        src={CARTOON_COMPANION_URL}
        alt="卡通学习伴侣"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.35))',
          animation: 'companionFloat 2s ease-in-out infinite'
        }}
      />
    );
  }

  return (
    <span
      aria-label="Live2D 学习伴侣"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 70%, rgba(99, 102, 241, 0.22), transparent 66%)',
        animation: status === 'ready' ? 'none' : 'pulseGlow 2s ease-in-out infinite'
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
      />
    </span>
  );
}

/**
 * 学习伴侣组件 - 为小白提供上下文相关的智能提示和 AI 对话
 *
 * 特性：
 * - 根据当前状态自动推荐下一步操作
 * - AI 对话功能（需要登录）
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
  labType = 'LINEAR' // 'LINEAR' | 'LOGISTIC' | 'TREE' | 'NN' | 'LLM' | 'YOLO'
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [currentHint, setCurrentHint] = useState(0);
  const [showNewHint, setShowNewHint] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dockSide, setDockSide] = useState('right');
  const companionRef = useRef(null);

  // AI 对话相关状态
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatEndRef = useRef(null);

  // Auth state
  const { isAuthenticated } = useAuthStore();
  
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
      if (mode === 'INFERENCE') {
        hints.push({
          icon: '🛸',
          text: '现在是预测推理模式。点击画板放一个测试点，看看模型会给出怎样的预测！',
          action: '添加测试点'
        });
        hints.push({
          icon: '🔍',
          text: '紫色/测试点不会参与训练，它们用来检验这条直线有没有学会规律。',
          action: '观察预测'
        });
      } else if (pointsCount === 0) {
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
    } else if (labType === 'LOGISTIC') {
      if (mode === 'INFERENCE') {
        hints.push({
          icon: '🔍',
          text: '现在是分类推理模式。点击画板添加测试点，观察它落在决策边界哪一侧。',
          action: '测试分类'
        });
      } else if (pointsCount < 2) {
        hints.push({
          icon: '🟠',
          text: '先在画布上放两类点：左键和右键分别代表不同类别。',
          action: '添加两类数据'
        });
      } else if (lossHistoryLength === 0 && !isTraining) {
        hints.push({
          icon: '🚀',
          text: '数据准备好了，开始训练后观察分类边界如何移动。',
          action: '开始训练'
        });
      } else if (isTraining) {
        hints.push({
          icon: '📉',
          text: '训练中。重点看交叉熵 Loss 是否下降，以及边界是否逐渐分开两类点。',
          action: '观察边界'
        });
      }
    } else if (labType === 'TREE') {
      if (mode === 'INFERENCE') {
        hints.push({
          icon: '🛸',
          text: '推理模式下添加测试点，看看决策树的矩形区域会把它分到哪一类。',
          action: '添加测试点'
        });
      } else if (pointsCount < 2) {
        hints.push({
          icon: '🌱',
          text: '先添加两类数据点。决策树会用横竖切分线把空间切成小区域。',
          action: '添加两类数据'
        });
      } else {
        hints.push({
          icon: '✂️',
          text: '试着调大树深度，观察边界从一刀切变成更细的矩形网格。',
          action: '调整树深度'
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
    } else if (labType === 'LLM') {
      if (mode === 'inference') {
        hints.push({
          icon: '💬',
          text: '先点一个提示词模板或自己输入文本，然后在 Token 嵌入面板点击不同 token，对比它们的向量变化。',
          action: '选择提示词'
        });
        hints.push({
          icon: '👁️',
          text: '注意力面板可以切换 Head，也可以点击热力图格子，看看“哪个词正在关注哪个词”。',
          action: '点注意力头'
        });
        hints.push({
          icon: '🎲',
          text: '生成前试着调 Temperature。低温更稳定，高温更多样；生成后看概率条解释模型为什么选这个词。',
          action: '调温度再生成'
        });
      } else if (lossHistoryLength === 0 && !isTraining) {
        hints.push({
          icon: '✂️',
          text: '先不要急着训练。请在 Tokenization 可视化里手动切分连续文本，再点“确认切分”观察哪些 token 命中词表。',
          action: '手动切分文本'
        });
        hints.push({
          icon: '🧩',
          text: '把“机器学习”合成一个 token，再切成“机/器/学/习”对比 ID。红色 <UNK> 说明你的切法不在词表里。',
          action: '比较切法'
        });
        hints.push({
          icon: '📉',
          text: '确认切分后再训练 25 步，观察 Loss 是否下降。Loss 是模型预测下一个 token 的错误程度。',
          action: '训练 25 步'
        });
      } else {
        hints.push({
          icon: '🔁',
          text: '现在 Loss 已经有变化了。切到推理模式，用提示词模板测试模型，再点击嵌入和注意力面板做解释。',
          action: '切换推理'
        });
        hints.push({
          icon: '⚙️',
          text: '如果想看训练更慢或更快，可以调“连续训练速度”。速度只影响演示节奏，不改变学习目标。',
          action: '调训练速度'
        });
      }
    } else if (labType === 'YOLO') {
      if (pointsCount < 2) {
        hints.push({
          icon: '🏷️',
          text: '先把人和书包都加入标注。没有标注，模型不知道框要往哪里靠。',
          action: '完成标注'
        });
      } else if (lossHistoryLength < 3) {
        hints.push({
          icon: '🎯',
          text: '点击训练，让预测框逐渐贴近真值框。IoU 越高说明框越准。',
          action: '训练模型'
        });
      } else {
        hints.push({
          icon: '🧹',
          text: '调置信度和 NMS 阈值，观察低分框和重复框如何被过滤。',
          action: '调整阈值'
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
    const timer = setTimeout(() => setCurrentHint(0), 0);
    return () => clearTimeout(timer);
  }, [pointsCount, lossHistoryLength, isTraining, currentLoss, mode]);
  
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

  useEffect(() => {
    const handleGlobalToggle = () => {
      setIsVisible(prev => !prev);
    };
    window.addEventListener('toggle-learning-companion', handleGlobalToggle);
    return () => window.removeEventListener('toggle-learning-companion', handleGlobalToggle);
  }, []);

  useEffect(() => {
    if (isMobile) return undefined;

    const pointerQuery = window.matchMedia?.('(pointer: coarse)');
    if (pointerQuery?.matches) return undefined;

    const avoidDistance = 96;

    const handleMouseMove = (event) => {
      const companion = companionRef.current;
      if (!companion) return;

      const rect = companion.getBoundingClientRect();
      const isNear = event.clientX >= rect.left - avoidDistance
        && event.clientX <= rect.right + avoidDistance
        && event.clientY >= rect.top - avoidDistance
        && event.clientY <= rect.bottom + avoidDistance;

      if (isNear) {
        setDockSide('left');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile]);

  // 自动滚动到聊天底部
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // 发送消息到 AI
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    if (!isAuthenticated) {
      setChatError('请先登录后再使用 AI 对话功能');
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatError(null);
    setIsLoading(true);

    // 添加用户消息
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Get token from zustand persist storage
      const authData = localStorage.getItem('ai-edu-auth');
      const authState = authData ? JSON.parse(authData) : null;
      const token = authState?.state?.token;

      if (!token) {
        throw new Error('请先登录后再使用 AI 对话功能');
      }

      const response = await fetch('/api/ai-chat/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          labType: labType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '发送失败');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatError(error.message || 'AI 服务暂时不可用');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理键盘发送
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isVisible) return null;

  const currentHintData = hints[currentHint % hints.length];
  const effectiveDockSide = isMobile ? 'right' : dockSide;
  
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
        @keyframes chatSlideIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes typing {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
      
      {/* 悬浮助手主体 */}
      <div ref={companionRef} style={{
        position: 'fixed',
        bottom: isMobile ? '80px' : '24px',
        right: '24px',
        zIndex: 10004,
        display: 'flex',
        flexDirection: 'column',
        alignItems: effectiveDockSide === 'left' ? 'flex-start' : 'flex-end',
        gap: isMobile ? '8px' : '12px',
        maxWidth: '100%',
        transform: effectiveDockSide === 'left' ? 'translateX(calc(100% + 48px - 100vw))' : 'translateX(0)',
        transition: 'transform 0.35s ease'
      }}>
        {/* 提示气泡 */}
        {isExpanded && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(45, 45, 70, 0.98))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '18px 18px 6px 18px',
            padding: isMobile ? '10px 12px' : '12px 14px',
            maxWidth: isMobile ? '230px' : '260px',
            marginRight: isMobile ? '2px' : '4px',
            position: 'relative',
            animation: 'hintSlideIn 0.3s ease-out',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
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
            <div style={{
              position: 'absolute',
              right: '18px',
              bottom: '-8px',
              width: '16px',
              height: '16px',
              background: 'rgba(45, 45, 70, 0.98)',
              borderRight: '1px solid rgba(99, 102, 241, 0.4)',
              borderBottom: '1px solid rgba(99, 102, 241, 0.4)',
              transform: 'rotate(45deg)'
            }} />
            
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
        
        {/* AI 聊天面板 */}
        {showChat && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(45, 45, 70, 0.98))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: isMobile ? '12px' : '16px',
            width: isMobile ? '280px' : '340px',
            maxHeight: '450px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'chatSlideIn 0.3s ease-out',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden'
          }}>
            {/* 聊天头部 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(99, 102, 241, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>AI 小智</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* 聊天消息列表 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '300px'
            }}>
              {chatMessages.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.85rem',
                  padding: '20px 0'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👋</div>
                  有什么关于机器学习的问题，问我吧！
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ fontSize: '1rem' }}>🤖</span>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ animation: 'typing 1s infinite', animationDelay: '0s' }}>●</span>
                    <span style={{ animation: 'typing 1s infinite', animationDelay: '0.2s' }}>●</span>
                    <span style={{ animation: 'typing 1s infinite', animationDelay: '0.4s' }}>●</span>
                  </span>
                </div>
              )}

              {chatError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontSize: '0.8rem'
                }}>
                  ⚠️ {chatError}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* 聊天输入框 */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder={isAuthenticated ? '输入你的问题...' : '请先登录'}
                disabled={!isAuthenticated || isLoading}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '20px',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  resize: 'none',
                  maxHeight: '80px',
                  minHeight: '40px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isLoading || !isAuthenticated}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: chatInput.trim() && !isLoading && isAuthenticated
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'rgba(99, 102, 241, 0.3)',
                  color: '#fff',
                  cursor: chatInput.trim() && !isLoading && isAuthenticated ? 'pointer' : 'not-allowed',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                ➤
              </button>
            </div>
          </div>
        )}

        {/* 悬浮按钮组 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* AI 聊天按钮 */}
          <button
            onClick={() => {
              if (!isAuthenticated) {
                setChatError('请先登录后再使用 AI 对话功能');
                return;
              }
              setShowChat(prev => !prev);
            }}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: showChat
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)',
              animation: showChat ? 'none' : 'pulseGlow 2s ease-in-out infinite',
              transition: 'all 0.3s ease'
            }}
            title={isAuthenticated ? 'AI 对话' : '登录后使用 AI 对话'}
          >
            💬
          </button>

          {/* 主按钮 */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              width: isExpanded ? '64px' : '56px',
              height: isExpanded ? '64px' : '56px',
              borderRadius: '50%',
              border: 'none',
              background: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.9), rgba(99,102,241,0.22) 58%, rgba(99,102,241,0.02) 72%)',
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
            <Live2DCompanionAvatar size={isExpanded ? 64 : 56} compact />
          </button>
        </div>
      </div>
    </>
  );
}
