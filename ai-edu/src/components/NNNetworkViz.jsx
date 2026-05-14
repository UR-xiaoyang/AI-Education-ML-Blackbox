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

  return {
    x1,
    x2,
    a1,
    a2,
    dz1,
    dz2,
    target,
    W1,
    W2,
    hiddenNodes,
  };
}

function activationColor(value, output = false) {
  const intensity = clamp(Math.abs(value), 0, 1);
  if (output) {
    return value >= 0.5
      ? `rgba(59,130,246,${0.55 + intensity * 0.35})`
      : `rgba(249,115,22,${0.55 + intensity * 0.35})`;
  }
  return value >= 0
    ? `rgba(56,189,248,${0.28 + intensity * 0.58})`
    : `rgba(251,146,60,${0.28 + intensity * 0.58})`;
}

function edgeColor(value, backward = false) {
  const intensity = clamp(Math.abs(value), 0, 1.2);
  if (backward) {
    return value >= 0
      ? `rgba(248,113,113,${0.32 + intensity * 0.5})`
      : `rgba(250,204,21,${0.32 + intensity * 0.5})`;
  }
  return value >= 0
    ? `rgba(96,165,250,${0.24 + intensity * 0.5})`
    : `rgba(125,211,252,${0.22 + intensity * 0.35})`;
}

function buildParticle(start, end, color, duration, visible, key) {
  if (!visible) return null;
  return (
    <circle key={key} r="4.5" fill={color} opacity="0.95">
      <animate attributeName="cx" values={`${start.x};${end.x}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="cy" values={`${start.y};${end.y}`} dur={duration} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" dur={duration} repeatCount="indefinite" />
    </circle>
  );
}

export default function NNNetworkViz({
  model,
  points,
  testPoints,
  epochCount,
  isAutoTraining,
  mode,
}) {
  const useRelu = usePedagogyStore((state) => state.useRelu);

  const sample = useMemo(() => {
    if (mode === 'INFERENCE' && testPoints.length > 0) {
      return testPoints[testPoints.length - 1];
    }
    if (points.length > 0) {
      return points[epochCount % points.length];
    }
    return null;
  }, [epochCount, mode, points, testPoints]);

  const inspection = useMemo(
    () => inspectSample(sample, model, useRelu),
    [sample, model, useRelu]
  );

  const width = 380;
  const height = 280;
  const xInput = 58;
  const xHidden = 190;
  const xOutput = 322;
  const inputY = [90, 190];
  const hiddenCount = model?.hiddenNodes ?? 0;
  const hiddenY = Array.from({ length: hiddenCount }, (_, index) => {
    if (hiddenCount === 1) return height / 2;
    return 34 + (index * (height - 68)) / (hiddenCount - 1);
  });
  const outputY = height / 2;

  return (
    <div className="glass-panel nn-network-panel">
      <div className="nn-network-header">
        <div>
          <h3>神经元传播视图</h3>
          <p>
            真实神经网络由神经元和带权连接组成。训练过程先做前向预测，再把误差反向传播回来。
          </p>
        </div>
        <div className={`nn-network-badge ${isAutoTraining ? 'is-live' : ''}`}>
          {isAutoTraining ? '反向传播中' : '网络已展开'}
        </div>
      </div>

      {!inspection ? (
        <div className="nn-network-empty">
          先添加或生成一些样本，这里就会显示神经元的激活、连接强弱和误差回传。
        </div>
      ) : (
        <>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <filter id="nnGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <text x={xInput} y={20} textAnchor="middle" className="nn-layer-label">
              输入层
            </text>
            <text x={xHidden} y={20} textAnchor="middle" className="nn-layer-label">
              隐层
            </text>
            <text x={xOutput} y={20} textAnchor="middle" className="nn-layer-label">
              输出层
            </text>

            {hiddenY.flatMap((hy, hiddenIndex) =>
              inputY.map((iy, inputIndex) => {
                const forwardValue =
                  inspection.W1[inputIndex][hiddenIndex] * inspection.a1[hiddenIndex];
                const backwardValue =
                  inspection.dz1[hiddenIndex] * (inspection.inputs[inputIndex] ?? 0);
                const keyBase = `${inputIndex}-${hiddenIndex}`;

                return (
                  <g key={keyBase}>
                    <line
                      x1={xInput}
                      y1={iy}
                      x2={xHidden}
                      y2={hy}
                      {...edgeStyle(forwardValue, 'forward')}
                    />
                    {mode === 'TRAIN' && (
                      <line
                        x1={xHidden}
                        y1={hy}
                        x2={xInput}
                        y2={iy}
                        strokeDasharray="6 6"
                        className={isAutoTraining ? 'nn-backward-flow' : ''}
                        {...edgeStyle(backwardValue, 'backward')}
                      />
                    )}
                  </g>
                );
              })
            )}

            {hiddenY.map((hy, hiddenIndex) => {
              const forwardValue = inspection.a1[hiddenIndex] * inspection.W2[hiddenIndex][0];
              const backwardValue = inspection.dz2 * inspection.W2[hiddenIndex][0];

              return (
                <g key={`hidden-out-${hiddenIndex}`}>
                  <line
                    x1={xHidden}
                    y1={hy}
                    x2={xOutput}
                    y2={outputY}
                    {...edgeStyle(forwardValue, 'forward')}
                  />
                  {mode === 'TRAIN' && (
                    <line
                      x1={xOutput}
                      y1={outputY}
                      x2={xHidden}
                      y2={hy}
                      strokeDasharray="6 6"
                      className={isAutoTraining ? 'nn-backward-flow' : ''}
                      {...edgeStyle(backwardValue, 'backward')}
                    />
                  )}
                </g>
              );
            })}

            {[
              { x: xInput, y: inputY[0], value: inspection.x1 },
              { x: xInput, y: inputY[1], value: inspection.x2 },
            ].map((node, index) => (
              <g key={`input-${index}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="18"
                  fill={nodeColor(node.value, 'input')}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.5"
                  filter="url(#nnGlow)"
                />
                <text x={node.x} y={node.y + 4} textAnchor="middle" className="nn-node-value">
                  {index === 0 ? 'x' : 'y'}
                </text>
              </g>
            ))}

            {hiddenY.map((hy, hiddenIndex) => (
              <g key={`hidden-${hiddenIndex}`}>
                <circle
                  cx={xHidden}
                  cy={hy}
                  r="13"
                  fill={nodeColor(inspection.a1[hiddenIndex], 'hidden')}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1.2"
                  filter="url(#nnGlow)"
                />
                <text x={xHidden} y={hy + 3.5} textAnchor="middle" className="nn-node-index">
                  h{hiddenIndex + 1}
                </text>
              </g>
            ))}

            <g>
              <circle
                cx={xOutput}
                cy={outputY}
                r="24"
                fill={nodeColor(inspection.a2, 'output')}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="1.8"
                filter="url(#nnGlow)"
              />
              <text x={xOutput} y={outputY - 1} textAnchor="middle" className="nn-node-value">
                {inspection.a2.toFixed(2)}
              </text>
              <text x={xOutput} y={outputY + 15} textAnchor="middle" className="nn-node-sub">
                预测概率
              </text>
            </g>
          </svg>

          <div className="nn-network-stats">
            <div className="nn-stat-card">
              <span>当前样本</span>
              <strong>
                ({sample.x.toFixed(2)}, {sample.y.toFixed(2)})
              </strong>
              <small>
                {typeof sample.label === 'number'
                  ? `真实标签 ${sample.label}`
                  : '当前是推理样本'}
              </small>
            </div>
            <div className="nn-stat-card">
              <span>前向传播</span>
              <strong>输入层 -&gt; 隐层 -&gt; 输出概率</strong>
              <small>{useRelu ? '已开启 ReLU 激活' : '当前使用线性激活'}</small>
            </div>
            <div className="nn-stat-card">
              <span>反向传播</span>
              <strong>
                {mode === 'TRAIN'
                  ? `输出误差 ${formatValue(inspection.dz2)}`
                  : '推理模式下不进行回传'}
              </strong>
              <small>虚线越亮，说明这条连接收到的梯度信号越强。</small>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
