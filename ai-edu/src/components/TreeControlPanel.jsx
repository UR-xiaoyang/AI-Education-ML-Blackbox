import React from 'react';

export default function TreeControlPanel({
  mode, setMode, onClearTest,
  maxDepth, setMaxDepth, actualDepth,
  stepTitle, stepDesc, onReset,
  reportClick, reportValueChange,
  sliderDisabled = false,
  modeToggleDisabled = false
}) {
  return (
    <div id="tree-control-panel" className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div>
        <h2 className="text-gradient" style={{ margin: '0', fontSize: '1.3rem' }}>决策树与随机森林</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
          观察决策树如何使用一刀切的方法进行空间分割
        </p>
      </div>

      {/* 模式切换 (Train / Inference) */}
      <div id="dt-btn-mode-toggle" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px', opacity: modeToggleDisabled ? 0.5 : 1 }}>
        <button
          id="dt-btn-mode-train"
          className={`btn ${mode === 'TRAIN' ? 'btn-primary' : ''}`}
          disabled={modeToggleDisabled}
          onClick={() => {
            if (!modeToggleDisabled) {
              setMode('TRAIN');
              if (reportClick) reportClick('dt-btn-mode-train');
            }
          }}
          style={{ flex: 1, padding: '8px', opacity: mode === 'TRAIN' ? 1 : 0.6, fontSize: '0.9rem', cursor: modeToggleDisabled ? 'not-allowed' : 'pointer' }}
        >
          🏋️ 训练模式
        </button>
        <button
          id="dt-btn-mode-inference"
          className={`btn ${mode === 'INFERENCE' ? 'btn-primary' : ''}`}
          disabled={modeToggleDisabled}
          onClick={() => {
            if (!modeToggleDisabled) {
              setMode('INFERENCE');
              if (reportClick) reportClick('dt-btn-mode-inference');
            }
          }}
          style={{ flex: 1, padding: '8px', opacity: mode === 'INFERENCE' ? 1 : 0.6, background: mode === 'INFERENCE' ? 'var(--accent-purple)' : '', fontSize: '0.9rem', cursor: modeToggleDisabled ? 'not-allowed' : 'pointer' }}
        >
          🛸 预测推理 {modeToggleDisabled && '🔒'}
        </button>
      </div>

      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>STEP</div>
          {stepTitle.substring(stepTitle.indexOf(' ') + 1)}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
          {stepDesc}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div id="dt-actual-depth">
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>模型当前实际深度</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>
            {actualDepth} 层
          </div>
        </div>
        {/* 树的深度可视化 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              display: 'flex', gap: '4px',
              opacity: i < maxDepth ? 1 : 0.2,
              transition: 'opacity 0.2s'
            }}>
              {[...Array(Math.pow(2, i))].map((_, j) => (
                <div key={j} style={{
                  width: Math.max(6, 14 - i * 2),
                  height: Math.max(6, 14 - i * 2),
                  borderRadius: '50%',
                  background: i < actualDepth ? '#10b981' : i === actualDepth ? '#fbbf24' : '#475569',
                  boxShadow: i < actualDepth ? '0 0 4px #10b981' : 'none'
                }} />
              ))}
            </div>
          ))}
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
            最大 {maxDepth} 层
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: sliderDisabled ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)' }}>
             最大树深度 (Max Depth):
            <span style={{ fontWeight: 'bold', marginLeft: '8px', color: sliderDisabled ? 'rgba(255,255,255,0.5)' : '#fff' }}>{maxDepth}</span>
            {sliderDisabled && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#fbbf24' }}>🔒</span>}
          </label>
        </div>
        <input
          id="dt-slider-max-depth"
          type="range"
          min="1"
          max="10"
          step="1"
          value={maxDepth}
          disabled={sliderDisabled}
          onChange={(e) => {
            if (!sliderDisabled) {
              setMaxDepth(parseInt(e.target.value));
              if (reportValueChange) reportValueChange('dt-slider-max-depth', parseInt(e.target.value));
            }
          }}
          style={{
            width: '100%',
            cursor: sliderDisabled ? 'not-allowed' : 'pointer',
            opacity: sliderDisabled ? 0.5 : 1
          }}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
          💡 提示：深度越浅越容易**欠拟合**，深度越深越容易**过拟合**。向右猛拉来感受人工智能的"死记硬背"。
        </p>
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
