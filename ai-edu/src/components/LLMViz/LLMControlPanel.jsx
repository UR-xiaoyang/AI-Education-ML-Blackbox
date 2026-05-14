import React from 'react';
import useLLMStore from '../../store/llmStore';
import './LLMControlPanel.css';

export default function LLMControlPanel({
  onTrainStep,
  onToggleTraining,
  onReset,
  isTraining,
  learningRate,
  setLearningRate,
  temperature,
  setTemperature,
  trainingStep,
  lossHistory,
  mode,
  onModeChange,
}) {
  const { selectTheme, selectedTheme } = useLLMStore();

  return (
    <div className="glass-panel llm-control-panel">
      <div className="panel-header">
        <h3>控制面板</h3>
      </div>

      {/* 模式切换 */}
      <div className="control-section">
        <span className="section-label">实验模式</span>
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'train' ? 'active' : ''}`}
            onClick={() => onModeChange('train')}
          >
            训练模式
          </button>
          <button
            className={`mode-btn ${mode === 'inference' ? 'active' : ''}`}
            onClick={() => onModeChange('inference')}
          >
            推理模式
          </button>
        </div>
      </div>

      {mode === 'train' ? (
        <>
          {/* 训练主题选择 */}
          <div className="control-section">
            <span className="section-label">选择训练主题</span>
            <div className="theme-selector">
              <button
                className={`theme-btn ${selectedTheme === 'qa' ? 'active' : ''}`}
                onClick={() => selectTheme('qa')}
              >
                问答训练
              </button>
              <button
                className={`theme-btn ${selectedTheme === 'story' ? 'active' : ''}`}
                onClick={() => selectTheme('story')}
              >
                故事生成
              </button>
              <button
                className={`theme-btn ${selectedTheme === 'technical' ? 'active' : ''}`}
                onClick={() => selectTheme('technical')}
              >
                技术文档
              </button>
            </div>
          </div>

          {/* 学习率 */}
          <div className="control-section">
            <span className="section-label">
              学习率: <strong>{learningRate.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={learningRate}
              onChange={(e) => setLearningRate(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>慢</span>
              <span>快</span>
            </div>
          </div>

          {/* 训练控制 */}
          <div className="control-section training-controls">
            <button className="btn btn-secondary" onClick={onTrainStep}>
              单步训练
            </button>
            <button
              className={`btn ${isTraining ? 'btn-warning' : 'btn-primary'}`}
              onClick={onToggleTraining}
            >
              {isTraining ? '暂停训练' : '开始训练'}
            </button>
          </div>

          {/* 训练状态 */}
          <div className="control-section training-status">
            <div className="status-item">
              <span className="status-label">训练步数</span>
              <span className="status-value">{trainingStep}</span>
            </div>
            <div className="status-item">
              <span className="status-label">当前损失</span>
              <span className="status-value">
                {lossHistory.length > 0 ? lossHistory[lossHistory.length - 1].toFixed(4) : '-'}
              </span>
            </div>
          </div>

          {/* 重置 */}
          <button className="btn btn-ghost" onClick={onReset}>
            重置模型
          </button>
        </>
      ) : (
        <>
          {/* 推理说明 */}
          <div className="control-section inference-info">
            <p>在下方输入提示词，点击"生成"按钮开始推理。</p>
            <p>推理时会展示 Token 嵌入和注意力可视化。</p>
          </div>

          {/* Temperature */}
          <div className="control-section">
            <span className="section-label">
              Temperature: <strong>{temperature.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="slider"
            />
            <div className="slider-labels">
              <span>确定性强</span>
              <span>多样性高</span>
            </div>
          </div>

          {/* 重置 */}
          <button className="btn btn-ghost" onClick={onReset}>
            重置
          </button>
        </>
      )}
    </div>
  );
}
