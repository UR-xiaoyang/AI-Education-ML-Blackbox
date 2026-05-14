import React from 'react';

export default function LogisticControlPanel({
  mode, setMode, onClearTest,
  w1, w2, b, loss, stepTitle, stepDesc,
  onTrainStep, onAutoTrain, isAutoTraining, onReset,
  learningRate, setLearningRate,
  reportClick, reportValueChange
}) {
  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div>
        <h2 className="text-gradient" style={{ margin: '0', fontSize: '1.3rem' }}>逻辑回归 (二元分类)</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
          画出楚河汉界，把两类数据分隔开来
        </p>
      </div>

      {/* 模式切换 (Train / Inference) */}
      <div id="lg-btn-mode-toggle" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px' }}>
        <button
          id="lg-btn-mode-train"
          className={`btn ${mode === 'TRAIN' ? 'btn-primary' : ''}`}
          onClick={() => { setMode('TRAIN'); if (reportClick) reportClick('lg-btn-mode-train'); }}
          style={{ flex: 1, padding: '8px', opacity: mode === 'TRAIN' ? 1 : 0.6, fontSize: '0.9rem' }}
        >
          🏋️ 训练模式
        </button>
        <button
          id="lg-btn-mode-inference"
          className={`btn ${mode === 'INFERENCE' ? 'btn-primary' : ''}`}
          onClick={() => { setMode('INFERENCE'); if(isAutoTraining) onAutoTrain(); if (reportClick) reportClick('lg-btn-mode-toggle'); }}
          style={{ flex: 1, padding: '8px', opacity: mode === 'INFERENCE' ? 1 : 0.6, background: mode === 'INFERENCE' ? 'var(--accent-purple)' : '', fontSize: '0.9rem' }}
        >
          🛸 预测推理
        </button>
      </div>

      {/* 教学步骤提示块 */}
      <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-purple)' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <div style={{ background: 'var(--accent-purple)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>STEP</div>
           {stepTitle.substring(stepTitle.indexOf(' ') + 1)}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
          {stepDesc}
        </p>
      </div>

      {/* 核心指标展示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            决策边界公式
          </div>
          <div style={{ fontSize: '1.0rem', marginTop: '4px', fontWeight: 'bold' }}>
            <span style={{color: 'var(--accent-purple)'}}>w1</span>·x + <span style={{color: 'var(--accent-purple)'}}>w2</span>·y + <span style={{color: 'var(--accent-purple)'}}>b</span> = 0
          </div>
          <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', marginTop: '4px', color: 'var(--text-secondary)' }}>
            w1: {w1.toFixed(3)} <br/>
            w2: {w2.toFixed(3)} <br/>
            b: {b.toFixed(3)}
          </div>
        </div>
        <div id="lg-loss-display" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>交叉熵损失 (BCE)</div>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: 'var(--accent-red)', 
            fontFamily: 'monospace',
            textShadow: '0 0 8px rgba(239,68,68,0.3)'
          }}>
            {loss.toFixed(4)}
          </div>
        </div>
      </div>

      {/* 控制条 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            学习步长 (学习率)
          </label>
          <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{learningRate.toFixed(2)}</span>
        </div>
        <input
          id="lg-slider-learning-rate"
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={learningRate}
          onChange={(e) => { setLearningRate(parseFloat(e.target.value)); if (reportValueChange) reportValueChange('lg-slider-learning-rate', parseFloat(e.target.value)); }}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button id="lg-btn-train-step" className="btn" onClick={() => { onTrainStep(); if (reportClick) reportClick('lg-btn-train-step'); }} style={{ flex: 1 }} disabled={mode !== 'TRAIN'}>
          单步 (Step)
        </button>
        <button
          id="lg-btn-auto-train"
          className={`btn ${isAutoTraining ? '' : 'btn-primary'}`}
          onClick={() => { onAutoTrain(); if (reportClick) reportClick('lg-btn-auto-train'); }}
          disabled={mode !== 'TRAIN'}
          style={{ flex: 1, background: isAutoTraining ? 'var(--accent-red)' : '' }}
        >
          {isAutoTraining ? '🛑 停止训练' : '✨ 自动训练'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn" onClick={onClearTest} style={{ flex: 1, opacity: 0.8 }}>
          🧹 清空测试集
        </button>
        <button className="btn" onClick={onReset} style={{ flex: 1, opacity: 0.8 }}>
          🔄 全局重置
        </button>
      </div>
    </div>
  );
}
