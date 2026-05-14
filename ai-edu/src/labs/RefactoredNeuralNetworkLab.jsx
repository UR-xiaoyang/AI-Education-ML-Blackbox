import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Settings,
  Pause,
  RotateCcw,
  Trash2,
  Zap,
  Layers,
  Activity,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// 模拟数据 - 双月牙数据集
// ============================================================================
const generateMoonsData = () => {
  const points = [];
  for (let i = 0; i < 50; i++) {
    const theta = Math.random() * Math.PI;
    points.push({
      x: 0.5 + 0.3 * Math.cos(theta),
      y: 0.6 + 0.2 * Math.sin(theta),
      label: 0,
    });
  }
  for (let i = 0; i < 50; i++) {
    const theta = Math.random() * Math.PI;
    points.push({
      x: 0.5 + 0.3 * Math.cos(theta) + 0.15,
      y: 0.6 - 0.2 * Math.sin(theta) - 0.1,
      label: 1,
    });
  }
  return points;
};

// ============================================================================
// 组件: 实验说明栏
// ============================================================================
function ExperimentHeader({ currentStep, totalSteps }) {
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div id="nn-header" className="w-full mb-4">
      {/* 进度条 - 黄色长条 */}
      <div id="nn-progress-bar" className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          id="nn-progress-fill"
          className="h-full bg-gradient-to-r from-yellow-400 via-amber-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* 左侧说明文本 */}
        <div id="nn-header-text" className="flex-1">
          <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-2">
            神经网络：在这个实验中，你将体会到贪婪的代价...
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            学习率决定了AI纠错的步幅大小。
          </p>
        </div>

        {/* 右侧页码和设置 */}
        <div id="nn-header-right" className="flex items-center gap-3">
          <span id="nn-page-indicator" className="text-sm text-slate-400 font-mono">
            {currentStep} / {totalSteps}
          </span>
          <button
            id="nn-btn-settings"
            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 组件: 左侧可视化画布
// ============================================================================
function VisualizationCanvas({ points, onCanvasClick }) {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const width = 500;
  const height = 460;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const step = 6;
    const cols = Math.floor(width / step);
    const rows = Math.floor(height / step);

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * step;
        const cy = (r + 0.5) * step;
        const logicX = cx / width;
        const logicY = (height - cy) / height;

        const moon1Center = { x: 0.5, y: 0.7 };
        const moon2Center = { x: 0.65, y: 0.5 };
        const dist1 = Math.sqrt((logicX - moon1Center.x) ** 2 + (logicY - moon1Center.y) ** 2);
        const dist2 = Math.sqrt((logicX - moon2Center.x) ** 2 + (logicY - moon2Center.y) ** 2);
        const p = 1 / (1 + Math.exp((dist1 - 0.25) * 8 - (dist2 - 0.25) * 8));

        const R = Math.round(249 * (1 - p) + 59 * p);
        const G = Math.round(115 * (1 - p) + 130 * p);
        const B = Math.round(22 * (1 - p) + 246 * p);
        const alpha = Math.abs(p - 0.5) * 2;
        const bgR = 15, bgG = 23, bgB = 42;
        const fR = bgR + (R - bgR) * alpha * 0.65;
        const fG = bgG + (G - bgG) * alpha * 0.65;
        const fB = bgB + (B - bgB) * alpha * 0.65;

        for (let yOffset = 0; yOffset < step; yOffset++) {
          for (let xOffset = 0; xOffset < step; xOffset++) {
            const px = c * step + xOffset;
            const py = r * step + yOffset;
            const idx = (py * width + px) * 4;
            data[idx] = fR;
            data[idx + 1] = fG;
            data[idx + 2] = fB;
            data[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const handleClick = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / width;
    const y = 1 - (e.clientY - rect.top) / height;
    onCanvasClick?.({ x, y, label: e.shiftKey ? 1 : 0 });
  };

  return (
    <div
      id="nn-canvas-container"
      className="glass-panel relative overflow-hidden"
    >
      <canvas
        id="nn-canvas-heatmap"
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0"
      />

      <svg
        id="nn-canvas-svg"
        ref={svgRef}
        width={width}
        height={height}
        onClick={handleClick}
        className="relative cursor-crosshair"
        style={{ zIndex: 1 }}
      >
        <g id="nn-canvas-grid" stroke="rgba(255,255,255,0.06)" strokeWidth={1}>
          {Array.from({ length: Math.floor(width / 50) + 1 }).map((_, i) => (
            <React.Fragment key={`v-${i}`}>
              <line x1={0} y1={i * 50} x2={width} y2={i * 50} />
              <line x1={i * 50} y1={0} x2={i * 50} y2={height} />
            </React.Fragment>
          ))}
        </g>

        <g id="nn-canvas-points">
          {points.map((p, i) => (
            <circle
              key={`point-${i}`}
              cx={p.x * width}
              cy={height - p.y * height}
              r={7}
              fill={p.label === 1 ? '#3B82F6' : '#F97316'}
              stroke="#fff"
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
            />
          ))}
        </g>

        {points.length === 0 && (
          <text
            id="nn-canvas-empty-hint"
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="14"
          >
            点击画布添加数据点
          </text>
        )}
      </svg>

      <div
        id="nn-canvas-coords"
        className="absolute bottom-2 left-2 text-xs text-slate-500 font-mono bg-slate-900/60 px-2 py-1 rounded"
      >
        X: 0.00 - 1.00 | Y: 0.00 - 1.00
      </div>
    </div>
  );
}

// ============================================================================
// 组件: 中间控制面板
// ============================================================================
function ControlPanel({
  mode,
  setMode,
  stepTitle,
  stepDesc,
  hiddenNeurons,
  loss,
  learningRate,
  setLearningRate,
  selectedDataset,
  setSelectedDataset,
  onTrainStep,
  onAutoTrain,
  isAutoTraining,
  onClearTest,
  onReset,
}) {
  return (
    <div id="nn-control-panel" className="glass-panel nn-control-panel">
      {/* 标题区 */}
      <div id="nn-panel-title">
        <h3 className="text-gradient" style={{ margin: 0, fontSize: '1.1rem' }}>
          深度学习初步 (MLP)
        </h3>
        <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontSize: '0.72rem' }}>
          观察神经元如何协同工作，扭转非线性空间
        </p>
      </div>

      {/* 模式切换 */}
      <div id="nn-mode-toggle" style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '10px' }}>
        <button
          id="nn-btn-mode-train"
          onClick={() => setMode('TRAIN')}
          className={`btn ${mode === 'TRAIN' ? 'btn-primary' : ''}`}
          style={{ flex: 1, padding: '6px', opacity: mode === 'TRAIN' ? 1 : 0.6, fontSize: '0.8rem' }}
        >
          训练模式
        </button>
        <button
          id="nn-btn-mode-inference"
          onClick={() => setMode('INFERENCE')}
          className={`btn ${mode === 'INFERENCE' ? 'btn-primary' : ''}`}
          style={{ flex: 1, padding: '6px', opacity: mode === 'INFERENCE' ? 1 : 0.6, fontSize: '0.8rem' }}
        >
          预测推理
        </button>
      </div>

      {/* 状态提示框 */}
      <div id="nn-step-hint" style={{ background: 'rgba(244, 114, 182, 0.06)', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #f472b6' }}>
        <h3 style={{ margin: '0 0 3px 0', fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ background: '#f472b6', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>STEP</div>
          {stepTitle}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>
          {stepDesc}
        </p>
      </div>

      {/* 核心指标 */}
      <div id="nn-stats-row" className="nn-stat-row">
        <div id="nn-stat-neurons" className="nn-stat-box">
          <span>隐藏神经元</span>
          <strong className="neuron-value">{hiddenNeurons} 个</strong>
        </div>
        <div id="nn-stat-loss" className="nn-stat-box">
          <span>BCE Loss</span>
          <strong className="loss-value">{loss.toFixed(4)}</strong>
        </div>
      </div>

      {/* 数据集选择 */}
      <div id="nn-dataset-section">
        <span id="nn-dataset-label" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>困难拓扑数据集</span>
        <div id="nn-dataset-buttons" className="nn-preset-buttons">
          <button
            id="nn-btn-dataset-circle"
            onClick={() => setSelectedDataset('circle')}
            className={`btn ${selectedDataset === 'circle' ? 'btn-primary' : ''}`}
          >
            同心圆
          </button>
          <button
            id="nn-btn-dataset-xor"
            onClick={() => setSelectedDataset('xor')}
            className={`btn ${selectedDataset === 'xor' ? 'btn-primary' : ''}`}
          >
            异或
          </button>
          <button
            id="nn-btn-dataset-moons"
            onClick={() => setSelectedDataset('moons')}
            className={`btn ${selectedDataset === 'moons' ? 'btn-primary' : ''}`}
          >
            双月牙
          </button>
        </div>
      </div>

      {/* 学习步长滑块 */}
      <div id="nn-learning-rate-section" className="nn-slider-row">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <label id="nn-learning-rate-label" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            学习步长: {learningRate.toFixed(2)}
          </label>
        </div>
        <input
          id="nn-input-learning-rate"
          type="range"
          min="0.05"
          max="2.0"
          step="0.05"
          value={learningRate}
          onChange={(e) => setLearningRate(parseFloat(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      {/* 主要操作按钮 */}
      <div id="nn-primary-actions" className="nn-control-buttons">
        <button
          id="nn-btn-step"
          onClick={onTrainStep}
          disabled={mode !== 'TRAIN'}
          className="btn"
        >
          单步
        </button>
        <button
          id="nn-btn-auto-train"
          onClick={onAutoTrain}
          disabled={mode !== 'TRAIN'}
          className={`btn ${isAutoTraining ? '' : 'btn-primary'}`}
          style={{ flex: 2, background: isAutoTraining ? 'var(--accent-red)' : '' }}
        >
          {isAutoTraining ? '停止训练' : '深度学习'}
        </button>
      </div>

      {/* 次要操作按钮 */}
      <div id="nn-secondary-actions" className="nn-secondary-buttons">
        <button
          id="nn-btn-clear-test"
          onClick={onClearTest}
          className="btn"
        >
          <Trash2 className="w-3.5 h-3.5" style={{ marginRight: '4px' }} />
          清理预测点
        </button>
        <button
          id="nn-btn-reset"
          onClick={onReset}
          className="btn"
        >
          <RotateCcw className="w-3.5 h-3.5" style={{ marginRight: '4px' }} />
          彻底重置
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 组件: Loss曲线图
// ============================================================================
function LossChart({ lossHistory }) {
  const width = 320;
  const height = 100;

  if (lossHistory.length === 0) {
    return (
      <div id="nn-panel-loss" className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div id="nn-loss-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 className="w-4 h-4 text-red-400" />
          <span id="nn-loss-title" className="text-sm font-medium text-slate-300">Loss 曲线</span>
        </div>
        <div
          id="nn-loss-empty"
          className="flex items-center justify-center border border-dashed border-slate-700/50 rounded-lg"
          style={{ height }}
        >
          <span className="text-xs text-slate-500">暂无训练数据</span>
        </div>
      </div>
    );
  }

  const maxLoss = Math.max(...lossHistory, 0.1);
  const getSvgY = (loss) => height - ((loss / maxLoss) * (height - 20)) - 10;

  const pathD = lossHistory
    .map((loss, i) => {
      const x = (i / Math.max(lossHistory.length - 1, 1)) * width;
      const y = getSvgY(loss);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div id="nn-panel-loss" className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div id="nn-loss-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 className="w-4 h-4 text-red-400" />
          <span id="nn-loss-title" className="text-sm font-medium text-slate-300">Loss 曲线</span>
        </div>
        <span id="nn-loss-latest" className="text-xs text-slate-500 font-mono">
          最新: {lossHistory[lossHistory.length - 1]?.toFixed(4)}
        </span>
      </div>
      <svg id="nn-loss-svg" width={width} height={height} className="w-full">
        <line
          id="nn-loss-gridline"
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="4 4"
        />
        <path
          id="nn-loss-curve"
          d={pathD}
          fill="none"
          stroke="#EF4444"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          id="nn-loss-dot"
          cx={width}
          cy={getSvgY(lossHistory[lossHistory.length - 1])}
          r="4"
          fill="#EF4444"
          stroke="#fff"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

// ============================================================================
// 组件: 数据集统计
// ============================================================================
function DatasetStats({ stats }) {
  return (
    <div id="nn-panel-dataset-stats" className="glass-panel nn-dataset-panel">
      <div id="nn-dataset-stats-header" className="nn-dataset-header">
        <div>
          <h3>数据集统计</h3>
        </div>
        <div id="nn-dataset-total" className="nn-network-badge">{stats.total} 个样本</div>
      </div>

      <div id="nn-dataset-classes" className="nn-dataset-stats">
        <div id="nn-stat-class0" className="nn-dataset-stat is-orange">
          <span>类别 0</span>
          <strong id="nn-class0-value">{stats.label0}</strong>
        </div>
        <div id="nn-stat-class1" className="nn-dataset-stat is-blue">
          <span>类别 1</span>
          <strong id="nn-class1-value">{stats.label1}</strong>
        </div>
      </div>

      <div id="nn-dataset-ranges" className="grid grid-cols-2 gap-2 mt-2">
        <div id="nn-stat-xrange" className="text-center p-2 bg-slate-900/40 rounded-lg">
          <span className="text-[10px] text-slate-500 block mb-0.5">X 范围</span>
          <span id="nn-xrange-value" className="text-xs font-mono text-slate-300">
            {stats.xRange[0].toFixed(2)} - {stats.xRange[1].toFixed(2)}
          </span>
        </div>
        <div id="nn-stat-yrange" className="text-center p-2 bg-slate-900/40 rounded-lg">
          <span className="text-[10px] text-slate-500 block mb-0.5">Y 范围</span>
          <span id="nn-yrange-value" className="text-xs font-mono text-slate-300">
            {stats.yRange[0].toFixed(2)} - {stats.yRange[1].toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 组件: 神经网络传播演示
// ============================================================================
function NeuralNetworkViz({ currentSample, hiddenNeurons }) {
  const width = 320;
  const height = 220;

  const inputNodes = [
    { x: 60, y: 70, label: 'x1', value: currentSample?.x1 ?? 0.32 },
    { x: 60, y: 150, label: 'x2', value: currentSample?.x2 ?? 0.76 },
  ];

  const pseudoRandom = (seed) => ((seed * 9301 + 49297) % 233280) / 233280;

  const hiddenNodes = Array.from({ length: hiddenNeurons }, (_, i) => ({
    x: 160,
    y: hiddenNeurons === 1 ? height / 2 : 45 + (i * (height - 90)) / (hiddenNeurons - 1),
    label: `h${i + 1}`,
    value: (0.3 + pseudoRandom(i + 1) * 0.6).toFixed(2),
  }));

  const outputNode = { x: 260, y: height / 2, value: currentSample?.output ?? 0.00 };

  const getLineWidth = (index) => 1.5 + pseudoRandom(index + 10) * 2;

  return (
    <div id="nn-panel-network" className="glass-panel nn-flow-panel">
      <div id="nn-network-header" className="nn-flow-header">
        <div>
          <h3>神经网络传播演示</h3>
        </div>
        <div id="nn-network-legend" className="nn-flow-legend">
          <span><i className="nn-legend-dot forward" />前向信号</span>
          <span><i className="nn-legend-dot backward" />反向梯度</span>
          <span><i className="nn-legend-line" />连线越粗，影响越强</span>
        </div>
      </div>

      <div id="nn-network-svg-container" className="nn-network-svg border border-slate-700/30 rounded-xl overflow-hidden bg-gradient-to-b from-slate-900/80 to-slate-900/40">
        <svg id="nn-network-svg" width={width} height={height} className="w-full">
          <text id="nn-layer-label-input" x={60} y={20} textAnchor="middle" className="nn-layer-label">输入层</text>
          <text id="nn-layer-label-hidden" x={160} y={20} textAnchor="middle" className="nn-layer-label">隐层神经元</text>
          <text id="nn-layer-label-output" x={260} y={20} textAnchor="middle" className="nn-layer-label">输出层</text>

          <g id="nn-connections-input-hidden">
            {inputNodes.map((inNode, i) =>
              hiddenNodes.map((hidNode, j) => {
                const lineIdx = i * hiddenNeurons + j;
                return (
                  <line
                    id={`nn-conn-ih-${i}-${j}`}
                    key={`ih-${i}-${j}`}
                    x1={inNode.x}
                    y1={inNode.y}
                    x2={hidNode.x - 16}
                    y2={hidNode.y}
                    stroke="rgba(96,165,250,0.4)"
                    strokeWidth={getLineWidth(lineIdx)}
                    strokeLinecap="round"
                  />
                );
              })
            )}
          </g>

          <g id="nn-connections-hidden-output">
            {hiddenNodes.map((hidNode, i) => (
              <line
                id={`nn-conn-ho-${i}`}
                key={`ho-${i}`}
                x1={hidNode.x + 16}
                y1={hidNode.y}
                x2={outputNode.x - 24}
                y2={outputNode.y}
                stroke="rgba(96,165,250,0.5)"
                strokeWidth={getLineWidth(i + 20)}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g id="nn-nodes-input">
            {inputNodes.map((node) => (
              <g id={`nn-node-${node.label}`} key={node.label}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="20"
                  fill="rgba(56,189,248,0.3)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1.5"
                />
                <text x={node.x} y={node.y - 4} textAnchor="middle" className="nn-node-value">{node.label}</text>
                <text x={node.x} y={node.y + 10} textAnchor="middle" className="nn-node-sub">{node.value.toFixed(2)}</text>
              </g>
            ))}
          </g>

          <g id="nn-nodes-hidden">
            {hiddenNodes.map((node) => (
              <g id={`nn-node-${node.label}`} key={node.label}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="14"
                  fill="rgba(139,92,246,0.4)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1.5"
                />
                <text x={node.x} y={node.y + 3} textAnchor="middle" className="nn-node-index">{node.label}</text>
              </g>
            ))}
          </g>

          <g id="nn-node-output">
            <circle
              cx={outputNode.x}
              cy={outputNode.y}
              r="22"
              fill="rgba(59,130,246,0.5)"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
            />
            <text x={outputNode.x} y={outputNode.y - 4} textAnchor="middle" className="nn-node-value">{outputNode.value.toFixed(2)}</text>
            <text x={outputNode.x} y={outputNode.y + 10} textAnchor="middle" className="nn-node-sub">预测概率</text>
          </g>
        </svg>
      </div>

      <div id="nn-network-readouts" className="nn-flow-readout">
        <div id="nn-readout-sample" className="nn-readout-card">
          <span>当前样本</span>
          <strong>({currentSample?.x1.toFixed(2)}, {currentSample?.x2.toFixed(2)})</strong>
        </div>
        <div id="nn-readout-forward" className="nn-readout-card">
          <span>前向传播</span>
          <strong>输入 → 隐层 → 输出</strong>
        </div>
        <div id="nn-readout-backward" className="nn-readout-card">
          <span>反向传播</span>
          <strong>误差 {currentSample?.error ?? -0.023}</strong>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 主组件: 神经网络实验室
// ============================================================================
export default function RefactoredNeuralNetworkLab() {
  const [mode, setMode] = useState('TRAIN');
  const [points, setPoints] = useState(generateMoonsData());
  const [hiddenNeurons, _setHiddenNeurons] = useState(4);
  const [learningRate, setLearningRate] = useState(2.0);
  const [loss, setLoss] = useState(0.0086);
  const [lossHistory, setLossHistory] = useState(() => {
    const history = [];
    let current = 0.7;
    for (let i = 0; i < 50; i++) {
      current = Math.max(0.008, current * (0.92 + Math.random() * 0.06));
      history.push(current);
    }
    return history;
  });
  const [selectedDataset, setSelectedDataset] = useState('moons');
  const [isAutoTraining, setIsAutoTraining] = useState(false);

  const currentSample = { x1: 0.32, x2: 0.76, output: 0.00, error: -0.023 };

  const datasetStats = useMemo(() => {
    const label0 = points.filter((p) => p.label === 0).length;
    const label1 = points.filter((p) => p.label === 1).length;
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    return {
      total: points.length,
      label0,
      label1,
      xRange: [Math.min(...xValues), Math.max(...xValues)],
      yRange: [Math.min(...yValues), Math.max(...yValues)],
    };
  }, [points]);

  const handleGenerateData = (type) => {
    setSelectedDataset(type);
    if (type === 'moons') {
      setPoints(generateMoonsData());
    }
  };

  const handleTrainStep = () => {
    setLoss((prev) => Math.max(0.001, prev * 0.85));
    setLossHistory((prev) => [...prev.slice(-49), Math.max(0.001, loss * 0.85)]);
  };

  const handleAutoTrain = () => {
    setIsAutoTraining(!isAutoTraining);
    if (!isAutoTraining) {
      const interval = setInterval(() => {
        setLoss((prev) => {
          const next = Math.max(0.001, prev * (0.92 + Math.random() * 0.06));
          setLossHistory((h) => [...h.slice(-99), next]);
          return next;
        });
      }, 100);
      window._nnTrainInterval = interval;
    } else {
      clearInterval(window._nnTrainInterval);
    }
  };

  const handleClearTest = () => {
    // 清理预测点的逻辑
  };

  const handleReset = () => {
    setPoints([]);
    setLoss(0.7);
    setLossHistory([]);
    setIsAutoTraining(false);
  };

  const handleCanvasClick = (point) => {
    setPoints((prev) => [...prev, point]);
  };

  return (
    <div id="nn-lab-root" className="min-h-screen bg-[#0B1121] p-6">
      <div id="nn-lab-container" className="max-w-[1800px] mx-auto">
        <ExperimentHeader currentStep={4} totalSteps={6} />

        <div id="nn-main-grid" className="nn-lab-layout">
          {/* 区块 A: 左侧可视化画布 (第1列) */}
          <div id="nn-block-canvas" className="nn-lab-canvas-wrap">
            <VisualizationCanvas points={points} onCanvasClick={handleCanvasClick} />
          </div>

          {/* 区块 B: 中间控制面板 (第2列) */}
          <div id="nn-block-control" className="nn-lab-side">
            <ControlPanel
              mode={mode}
              setMode={setMode}
              stepTitle="拟合开始成形"
              stepDesc="Loss 已经明显下降。此时切到推理模式，在边界附近多放几个点，看看泛化效果。"
              hiddenNeurons={hiddenNeurons}
              loss={loss}
              learningRate={learningRate}
              setLearningRate={setLearningRate}
              selectedDataset={selectedDataset}
              setSelectedDataset={handleGenerateData}
              onTrainStep={handleTrainStep}
              onAutoTrain={handleAutoTrain}
              isAutoTraining={isAutoTraining}
              onClearTest={handleClearTest}
              onReset={handleReset}
            />
          </div>

          {/* 区块 C: 右侧状态展示 (第3列) */}
          <div id="nn-block-sidebar" className="nn-lab-side">
            <LossChart lossHistory={lossHistory} />
            <DatasetStats stats={datasetStats} />
          </div>

          {/* 区块 D: 神经网络传播演示 (第2-3列下方，跨两列) */}
          <div id="nn-block-flow" className="nn-flow-panel col-span-2">
            <NeuralNetworkViz
              currentSample={currentSample}
              hiddenNeurons={hiddenNeurons}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
