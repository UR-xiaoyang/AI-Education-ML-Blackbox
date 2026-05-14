import React, { useState, useEffect } from 'react';

/**
 * 交互式小测验组件
 * 在关键学习步骤弹出，验证学生对概念的理解
 * 响应式设计
 */
export default function QuizModal({ 
  isOpen, 
  onClose, 
  question, 
  options, 
  correctIndex,
  onAnswer,
  explanation // 答对/答错后的解释
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 重置状态当 quiz 打开时
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  }, [isOpen]);

  // 重置状态当 quiz 打开时
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(null);
      setShowResult(false);
      setIsCorrect(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (index) => {
    if (showResult) return;
    
    setSelectedIndex(index);
    setShowResult(true);
    const correct = index === correctIndex;
    setIsCorrect(correct);
    
    if (onAnswer) {
      onAnswer(correct);
    }
  };

  const handleContinue = () => {
    if (onClose) onClose();
  };

  return (
    <>
      <style>{`
        @keyframes quizFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes quizSlideIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes correctPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes wrongShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
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
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10005,
          animation: 'quizFadeIn 0.3s ease-out'
        }}
        onClick={handleContinue}
      />

      {/* 测验主体 */}
      <div 
        style={{
          position: 'fixed',
          top: isMobile ? '5%' : '50%',
          left: '50%',
          transform: isMobile ? 'translateX(-50%)' : 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: isMobile ? '16px' : '20px',
          padding: isMobile ? '20px' : '32px',
          maxWidth: '480px',
          width: '90%',
          maxHeight: isMobile ? '90vh' : '80vh',
          overflow: 'auto',
          zIndex: 10006,
          animation: 'quizSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 标题 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '2rem',
            animation: showResult 
              ? (isCorrect ? 'correctPulse 0.5s ease' : 'wrongShake 0.5s ease')
              : 'none'
          }}>
            {showResult ? (isCorrect ? '✅' : '❌') : '📝'}
          </div>
          <div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '4px'
            }}>
              {showResult 
                ? (isCorrect ? '回答正确！🎉' : '再想想看...')
                : '小测验'
              }
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              {isCorrect ? '太棒了！' : '挑战一下'}
            </div>
          </div>
        </div>

        {/* 题目 */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '1rem', 
            color: 'rgba(255, 255, 255, 0.95)',
            lineHeight: 1.6
          }}>
            {question}
          </p>
        </div>

        {/* 选项 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {options.map((option, index) => {
            const isSelected = selectedIndex === index;
            const isCorrectOption = index === correctIndex;
            const showCorrectHighlight = showResult && isCorrectOption;
            const showWrongHighlight = showResult && isSelected && !isCorrectOption;

            let bgColor = 'rgba(255, 255, 255, 0.05)';
            let borderColor = 'rgba(255, 255, 255, 0.1)';
            let textColor = 'rgba(255, 255, 255, 0.8)';

            if (showCorrectHighlight) {
              bgColor = 'rgba(34, 197, 94, 0.2)';
              borderColor = 'rgba(34, 197, 94, 0.6)';
              textColor = '#4ade80';
            } else if (showWrongHighlight) {
              bgColor = 'rgba(239, 68, 68, 0.2)';
              borderColor = 'rgba(239, 68, 68, 0.6)';
              textColor = '#f87171';
            } else if (isSelected) {
              bgColor = 'rgba(99, 102, 241, 0.2)';
              borderColor = 'rgba(99, 102, 241, 0.5)';
            }

            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={showResult}
                style={{
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  textAlign: 'left',
                  cursor: showResult ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: showCorrectHighlight 
                    ? '#22c55e' 
                    : showWrongHighlight 
                      ? '#ef4444'
                      : 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: showCorrectHighlight || showWrongHighlight ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  flexShrink: 0
                }}>
                  {showCorrectHighlight ? '✓' : showWrongHighlight ? '✕' : String.fromCharCode(65 + index)}
                </div>
                <span style={{
                  fontSize: '0.95rem',
                  color: textColor,
                  lineHeight: 1.4
                }}>
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {/* 解释 */}
        {showResult && explanation && (
          <div style={{
            background: isCorrect 
              ? 'rgba(34, 197, 94, 0.1)' 
              : 'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${isCorrect 
              ? 'rgba(34, 197, 94, 0.3)' 
              : 'rgba(251, 191, 36, 0.3)'}`,
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: isCorrect ? '#4ade80' : '#fbbf24',
              fontWeight: 'bold',
              marginBottom: '6px'
            }}>
              💡 {isCorrect ? '知识巩固' : '提示'}
            </div>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: 1.5
            }}>
              {explanation}
            </p>
          </div>
        )}

        {/* 继续按钮 */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '14px',
            background: showResult
              ? (isCorrect 
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)')
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            borderRadius: '10px',
            fontSize: '1rem',
            fontWeight: 'bold',
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {showResult ? '继续学习 →' : '我来试试'}
        </button>
      </div>
    </>
  );
}

/**
 * 测验题库
 */
export const QUIZ_QUESTIONS = {
  LINEAR_STEP_1: {
    // 第一步后：数据收集完成后
    question: '数据点是 AI 学习的基础。你添加的数据点代表什么？',
    options: [
      'AI 训练的目标答案',
      '供 AI 学习参考的样本数据',
      '测试 AI 能力的考题',
      '用来展示的可视化数据'
    ],
    correctIndex: 1,
    explanation: '数据点代表"样本数据"——我们给 AI 看的例子。AI 通过这些样本学习规律，而不是直接告诉它答案。这就是"机器学习"的核心：让机器从数据中发现模式！'
  },
  
  LINEAR_STEP_2: {
    // Loss 概念引入后
    question: 'Loss（损失值）表示什么？',
    options: [
      'AI 已经掌握的知识量',
      'AI 犯错的程度，值越大表示犯错越多',
      '训练数据的数量',
      '神经网络的层数'
    ],
    correctIndex: 1,
    explanation: 'Loss 是"损失函数"的值，表示 AI 当前预测与真实值之间的差距。Loss 越大，说明 AI 的预测越不准确；Loss 越小，说明 AI 学得越好。我们的目标就是让 Loss 尽可能地小！'
  },
  
  LINEAR_STEP_3: {
    // 训练开始后
    question: '"梯度下降"是什么？',
    options: [
      '一种画直线的方法',
      '让 Loss 逐步降低的优化算法',
      '测量数据精度的工具',
      '导入外部数据的方式'
    ],
    correctIndex: 1,
    explanation: '梯度下降是机器学习的核心优化算法。"梯度"指向Loss下降最快的方向，"下降"就是沿着这个方向迈步。每一步都在减少错误，最终找到Loss最低的点——这就是模型学到的"最佳答案"。'
  },
  
  LINEAR_STEP_4: {
    // 训练完成后
    question: '当 Loss 很低时，说明了什么？',
    options: [
      'AI 已经完美记住所有训练数据',
      'AI 的模型参数已经调整到较好的状态',
      '训练数据太多了',
      '学习率设置正确'
    ],
    correctIndex: 1,
    explanation: 'Loss 低表示 AI 找到了一个不错的解——模型参数调整到了使预测误差最小的状态。但要注意：如果 Loss 在训练数据上很低，在新数据上却很高，说明可能是"过拟合"了。'
  },
  
  INFERENCE: {
    // 推理模式
    question: '"推理模式"中，你添加的点代表什么？',
    options: [
      '新的训练数据',
      '用来测试 AI 的问题，AI 需要预测答案',
      '用来验证正确答案的数据',
      '用于可视化的辅助点'
    ],
    correctIndex: 1,
    explanation: '推理模式中，你添加的点是一次"提问"。AI 需要根据之前学到的规律，预测出答案。这就像考试一样——AI 用学到的知识来回答新问题，考验它的"泛化能力"。'
  }
};
