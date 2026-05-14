import React, { useMemo } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import './LLMFlowViz.css';

export default function LLMFlowViz({ tokens, isTraining = false }) {
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);

  // 将 token IDs 转换为 token 文本
  const tokenTexts = useMemo(() => {
    return tokens.map(id => vocabInfo.vocab[id] || '<UNK>').filter(t => t !== '<PAD>');
  }, [tokens, vocabInfo]);

  // 简化的流程阶段
  const stages = [
    { id: 'tokens', label: '输入 Tokens', color: '#38bdf8' },
    { id: 'embedding', label: 'Token 嵌入', color: '#818cf8' },
    { id: 'positional', label: '位置编码', color: '#a78bfa' },
    { id: 'attention', label: '自注意力', color: '#c084fc' },
    { id: 'ffn', label: '前馈网络', color: '#e879f9' },
    { id: 'output', label: '输出预测', color: '#f472b6' },
  ];

  return (
    <div className="glass-panel llm-flow-viz">
      <div className="panel-header">
        <h3>LLM 数据流图</h3>
        <span className={`badge ${isTraining ? 'training' : 'idle'}`}>
          {isTraining ? '训练中' : '空闲'}
        </span>
      </div>

      <div className="flow-diagram">
        <svg width="100%" height="200" viewBox="0 0 600 200">
          {/* 阶段节点 */}
          {stages.map((stage, i) => {
            const x = 50 + i * 95;
            const y = 100;
            return (
              <g key={stage.id} className={`stage-node ${isTraining ? 'active' : ''}`}>
                {/* 连接线 */}
                {i > 0 && (
                  <>
                    <line
                      x1={x - 45}
                      y1={y}
                      x2={x - 10}
                      y2={y}
                      stroke={stages[i - 1].color}
                      strokeWidth="2"
                      strokeDasharray="8 4"
                      className="connector"
                    />
                    {/* 动画粒子 */}
                    {isTraining && (
                      <circle r="4" fill={stage.color} opacity="0.8">
                        <animateMotion
                          path={`M ${x - 45} ${y} L ${x - 10} ${y}`}
                          dur="1.5s"
                          repeatCount="indefinite"
                          begin={`${i * 0.2}s`}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.8;0.8;0"
                          dur="1.5s"
                          repeatCount="indefinite"
                          begin={`${i * 0.2}s`}
                        />
                      </circle>
                    )}
                  </>
                )}

                {/* 节点圆圈 */}
                <circle
                  cx={x}
                  cy={y}
                  r="28"
                  fill={`${stage.color}22`}
                  stroke={stage.color}
                  strokeWidth="2"
                />

                {/* 节点图标 */}
                <text
                  x={x}
                  y={y - 5}
                  textAnchor="middle"
                  className="stage-icon"
                >
                  {getStageIcon(stage.id)}
                </text>

                {/* 阶段标签 */}
                <text
                  x={x}
                  y={y + 50}
                  textAnchor="middle"
                  className="stage-label"
                >
                  {stage.label}
                </text>
              </g>
            );
          })}

          {/* Token 显示 */}
          <g className="token-display" transform="translate(50, 170)">
            <text x="0" y="0" className="flow-section-label">
              当前序列:
            </text>
            <g transform="translate(80, -8)">
              {tokenTexts.slice(0, 6).map((token, i) => (
                <g key={i} transform={`translate(${i * 45}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width="40"
                    height="20"
                    rx="4"
                    fill="rgba(56, 189, 248, 0.2)"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <text
                    x="20"
                    y="14"
                    textAnchor="middle"
                    className="token-text"
                  >
                    {token.length > 5 ? token.slice(0, 4) + '..' : token}
                  </text>
                </g>
              ))}
              {tokenTexts.length > 6 && (
                <text x={6 * 45 + 10} y="14" className="token-more">
                  +{tokenTexts.length - 6}
                </text>
              )}
            </g>
          </g>
        </svg>
      </div>

      {/* 流程说明 */}
      <div className="flow-explanation">
        <div className="flow-step">
          <span className="step-num">1</span>
          <span className="step-desc">Token 嵌入：将每个词转换为向量表示</span>
        </div>
        <div className="flow-step">
          <span className="step-num">2</span>
          <span className="step-desc">位置编码：为序列中的每个位置添加位置信息</span>
        </div>
        <div className="flow-step">
          <span className="step-num">3</span>
          <span className="step-desc">自注意力：计算词与词之间的关联强度</span>
        </div>
        <div className="flow-step">
          <span className="step-num">4</span>
          <span className="step-desc">前馈网络：对每个位置进行非线性变换</span>
        </div>
        <div className="flow-step">
          <span className="step-num">5</span>
          <span className="step-desc">输出预测：计算每个词作为下一个词的概率</span>
        </div>
      </div>

      <style>{`
        .llm-flow-viz .stage-node.active circle:first-of-type {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// 获取阶段图标
function getStageIcon(stageId) {
  switch (stageId) {
    case 'tokens':
      return '📝';
    case 'embedding':
      return '📊';
    case 'positional':
      return '📍';
    case 'attention':
      return '👁️';
    case 'ffn':
      return '⚡';
    case 'output':
      return '🎯';
    default:
      return '•';
  }
}