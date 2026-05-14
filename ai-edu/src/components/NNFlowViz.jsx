import React, { useMemo } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function relu(z) {
  return Math.max(0, z);
}

function reluDerivative(z) {
  return z > 0 ? 1 : 0;
}

function inspectSample(sample, model, useRelu) {
  if (!sample || !model) return null;

  const { W1, b1, W2, b2, hiddenNodes } = model;
  const x1 = sample.x;
  const x2 = sample.y;
  const z1 = Array(hiddenNodes).fill(0);
  const a1 = Array(hiddenNodes).fill(0);

  for (let j = 0; j < hiddenNodes; j++) {
    z1[j] = x1 * W1[0][j] + x2 * W1[1][j] + b1[j];
    a1[j] = useRelu ? relu(z1[j]) : z1[j];
  }

  let z2 = b2[0];
  for (let j = 0; j < hiddenNodes; j++) {
    z2 += a1[j] * W2[j][0];
  }

  const a2 = sigmoid(z2);
  const target = typeof sample.label === 'number' ? sample.label : null;
  const dz2 = target === null ? 0 : a2 - target;
  const dz1 = Array(hiddenNodes).fill(0);

  for (let j = 0; j < hiddenNodes; j++) {
    const da1 = dz2 * W2[j][0];
    dz1[j] = da1 * (useRelu ? reluDerivative(z1[j]) : 1);
  }

  return { x1, x2, a1, a2, dz1, dz2, target, W1, W2, hiddenNodes };
}

function activationColor(value, output = false) {
  const intensity = clamp(Math.abs(value), 0, 1);
  if (output) {
    return value >= 0.5
      ? `rgba(59,130,246,${0.58 + intensity * 0.32})`
      : `rgba(249,115,22,${0.58 + intensity * 0.32})`;
  }
  return value >= 0
    ? `rgba(56,189,248,${0.28 + intensity * 0.58})`
    : `rgba(251,146,60,${0.28 + intensity * 0.58})`;
}

function connectionColor(value, backward = false) {
  const intensity = clamp(Math.abs(value), 0, 1.4);
  if (backward) {
    return value >= 0
      ? `rgba(248,113,113,${0.36 + intensity * 0.48})`
      : `rgba(250,204,21,${0.36 + intensity * 0.48})`;
  }
  return value >= 0
    ? `rgba(96,165,250,${0.25 + intensity * 0.45})`
    : `rgba(125,211,252,${0.22 + intensity * 0.35})`;
}

function particle(start, end, color, duration, key, visible = true) {
  if (!visible) return null;
  return (
    <circle key={key} r="4.5" fill={color} opacity="0.95">
      <animate attributeName="cx" values={`${start.x};${end.x}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="cy" values={`${start.y};${end.y}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" dur={duration} repeatCount="indefinite" />
    </circle>
  );
}

function buildLayout(hiddenCount, height) {
  // Multi-row layout for hidden layer - single column in the middle
  const colX = 290; // Fixed x position for hidden layer column
  if (hiddenCount === 0) return { nodes: [], rows: 0, colX };

  const maxRows = Math.min(hiddenCount, 8); // Cap at 8 rows for visibility
  const rows = maxRows;
  const rowHeight = (height - 80) / Math.max(rows - 1, 1);
  const startY = 45;

  const nodes = [];
  for (let i = 0; i < hiddenCount; i++) {
    const clampedRow = Math.min(i, rows - 1);
    nodes.push({
      row: clampedRow,
      col: 0,
      x: colX,
      y: startY + clampedRow * rowHeight,
    });
  }
  return { nodes, rows, colX };
}

export default function NNFlowViz({ model, points, testPoints, epochCount, isAutoTraining, mode }) {
  const useRelu = usePedagogyStore((state) => state.useRelu);

  const sample = useMemo(() => {
    if (mode === 'INFERENCE' && testPoints.length > 0) return testPoints[testPoints.length - 1];
    if (points.length > 0) return points[epochCount % points.length];
    return null;
  }, [epochCount, mode, points, testPoints]);

  const pass = useMemo(() => inspectSample(sample, model, useRelu), [sample, model, useRelu]);

  const width = 640;
  const height = 320;
  const xInput = 70;
  const xOutput = 570;
  const inputNodes = [
    { x: xInput, y: 95, label: 'x1', value: pass?.x1 ?? 0 },
    { x: xInput, y: 225, label: 'x2', value: pass?.x2 ?? 0 },
  ];
  const { nodes: layoutNodes, colX: xHidden } = useMemo(
    () => buildLayout(model?.hiddenNodes ?? 0, height),
    [model?.hiddenNodes, height]
  );
  const hiddenNodes = layoutNodes.map((node, index) => ({
    x: node.x,
    y: node.y,
    label: `h${index + 1}`,
    value: pass?.a1[index] ?? 0,
    gradient: pass?.dz1[index] ?? 0,
  }));
  const outputNode = { x: xOutput, y: 160, value: pass?.a2 ?? 0 };

  return (
    <div className="glass-panel nn-flow-panel">
      <div className="nn-flow-header">
        <div>
          <h3>神经元传播演示</h3>
        </div>
        <div className={`nn-network-badge ${isAutoTraining ? 'is-live' : ''}`}>
          {mode === 'TRAIN' ? (isAutoTraining ? '自动训练中' : '可单步观察') : '推理模式'}
        </div>
      </div>

      {!pass ? (
        <div className="nn-network-empty">先生成样本并开始训练，观察神经元信号流动。</div>
      ) : (
        <>
          <div className="nn-flow-legend">
            <span><i className="nn-legend-dot forward" />前向信号</span>
            <span><i className="nn-legend-dot backward" />反向梯度</span>
            <span><i className="nn-legend-line" />连线越粗，影响越强</span>
          </div>

          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="nn-network-svg">
            <text x={xInput} y={28} textAnchor="middle" className="nn-layer-label">输入层</text>
            <text x={xHidden} y={28} textAnchor="middle" className="nn-layer-label">隐层神经元</text>
            <text x={xOutput} y={28} textAnchor="middle" className="nn-layer-label">输出层</text>

            {hiddenNodes.flatMap((hiddenNode, hiddenIndex) =>
              inputNodes.map((inputNode, inputIndex) => {
                const forwardStrength = (pass.W1[inputIndex][hiddenIndex] || 0) * hiddenNode.value;
                const backwardStrength = hiddenNode.gradient * inputNode.value;
                return (
                  <g key={`ih-${inputIndex}-${hiddenIndex}`}>
                    <line
                      x1={inputNode.x}
                      y1={inputNode.y}
                      x2={hiddenNode.x}
                      y2={hiddenNode.y}
                      stroke={connectionColor(forwardStrength)}
                      strokeWidth={1.5 + clamp(Math.abs(forwardStrength), 0, 1.5) * 3}
                      strokeLinecap="round"
                    />
                    {particle(inputNode, hiddenNode, 'rgba(96,165,250,0.96)', '1.05s', `f-${inputIndex}-${hiddenIndex}`)}
                    {mode === 'TRAIN' && (
                      <>
                        <line
                          x1={hiddenNode.x}
                          y1={hiddenNode.y}
                          x2={inputNode.x}
                          y2={inputNode.y}
                          stroke={connectionColor(backwardStrength, true)}
                          strokeWidth={1.2 + clamp(Math.abs(backwardStrength), 0, 1.5) * 2.2}
                          strokeLinecap="round"
                          strokeDasharray="8 8"
                        />
                        {particle(hiddenNode, inputNode, 'rgba(248,113,113,0.96)', '1.2s', `b-${inputIndex}-${hiddenIndex}`, isAutoTraining || Math.abs(backwardStrength) > 0.02)}
                      </>
                    )}
                  </g>
                );
              })
            )}

            {hiddenNodes.map((hiddenNode, hiddenIndex) => {
              const forwardStrength = hiddenNode.value * pass.W2[hiddenIndex][0];
              const backwardStrength = pass.dz2 * pass.W2[hiddenIndex][0];
              return (
                <g key={`ho-${hiddenIndex}`}>
                  <line
                    x1={hiddenNode.x}
                    y1={hiddenNode.y}
                    x2={outputNode.x}
                    y2={outputNode.y}
                    stroke={connectionColor(forwardStrength)}
                    strokeWidth={1.5 + clamp(Math.abs(forwardStrength), 0, 1.5) * 3}
                    strokeLinecap="round"
                  />
                  {particle(hiddenNode, outputNode, 'rgba(59,130,246,0.96)', '0.95s', `fo-${hiddenIndex}`)}
                  {mode === 'TRAIN' && (
                    <>
                      <line
                        x1={outputNode.x}
                        y1={outputNode.y}
                        x2={hiddenNode.x}
                        y2={hiddenNode.y}
                        stroke={connectionColor(backwardStrength, true)}
                        strokeWidth={1.2 + clamp(Math.abs(backwardStrength), 0, 1.5) * 2.2}
                        strokeLinecap="round"
                        strokeDasharray="8 8"
                      />
                      {particle(outputNode, hiddenNode, 'rgba(239,68,68,0.96)', '1.1s', `bo-${hiddenIndex}`, isAutoTraining || Math.abs(backwardStrength) > 0.02)}
                    </>
                  )}
                </g>
              );
            })}

            {inputNodes.map((node) => (
              <g key={node.label}>
                <circle cx={node.x} cy={node.y} r="26" fill={activationColor(node.value)} stroke="rgba(255,255,255,0.78)" strokeWidth="2" />
                <text x={node.x} y={node.y - 3} textAnchor="middle" className="nn-node-value">{node.label}</text>
                <text x={node.x} y={node.y + 14} textAnchor="middle" className="nn-node-sub">{node.value.toFixed(2)}</text>
              </g>
            ))}

            {hiddenNodes.map((node) => (
              <g key={node.label}>
                <circle cx={node.x} cy={node.y} r="18" fill={activationColor(node.value)} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                <text x={node.x} y={node.y + 3} textAnchor="middle" className="nn-node-index">{node.label}</text>
              </g>
            ))}

            <g>
              <circle cx={outputNode.x} cy={outputNode.y} r="32" fill={activationColor(outputNode.value, true)} stroke="rgba(255,255,255,0.88)" strokeWidth="2" />
              <text x={outputNode.x} y={outputNode.y - 4} textAnchor="middle" className="nn-node-value">{outputNode.value.toFixed(2)}</text>
              <text x={outputNode.x} y={outputNode.y + 16} textAnchor="middle" className="nn-node-sub">预测概率</text>
            </g>
          </svg>

          <div className="nn-flow-readout">
            <div className="nn-readout-card">
              <span>当前样本</span>
              <strong>({sample.x.toFixed(2)}, {sample.y.toFixed(2)})</strong>
              <small>{pass.target === null ? '推理' : `标签 ${pass.target}`}</small>
            </div>
            <div className="nn-readout-card">
              <span>前向传播</span>
              <strong>输入 → 隐层 → 输出</strong>
              <small>{useRelu ? 'ReLU激活' : '线性激活'}</small>
            </div>
            <div className="nn-readout-card">
              <span>反向传播</span>
              <strong>{mode === 'TRAIN' ? `误差 ${pass.dz2 >= 0 ? '+' : ''}${pass.dz2.toFixed(3)}` : '推理模式'}</strong>
              <small>误差回传至各神经元</small>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
