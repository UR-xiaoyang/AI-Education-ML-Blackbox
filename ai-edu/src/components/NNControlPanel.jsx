import React from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { nnExperiments } from '../store/scenarioConfig';

export default function NNControlPanel({
  mode,
  setMode,
  onClearTest,
  model,
  loss,
  stepTitle,
  stepDesc,
  onTrainStep,
  onAutoTrain,
  isAutoTraining,
  onReset,
  learningRate,
  setLearningRate,
  onGenerateData,
  hiddenNodes,
  setHiddenNodes,
  datasetLength,
  scenarioEnabled
}) {
  const unlocks = usePedagogyStore((state) => state.unlocks);
  const useRelu = usePedagogyStore((state) => state.useRelu);
  const setUseRelu = usePedagogyStore((state) => state.setUseRelu);
  const { reportValueChange, reportClick } = useScenarioEngine(nnExperiments, scenarioEnabled);

  return (
    <div className="glass-panel nn-control-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div>
        <h2 className="text-gradient" style={{ margin: '0', fontSize: '1.1rem' }}>深度学习初步 (MLP)</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontSize: '0.72rem' }}>
          观察神经元如何协同合作，扭转非线性空间
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '10px' }}>
        <button className={`btn ${mode === 'TRAIN' ? 'btn-primary' : ''}`} onClick={() => setMode('TRAIN')} style={{ flex: 1, padding: '6px', opacity: mode === 'TRAIN' ? 1 : 0.6, fontSize: '0.8rem' }}>
          训练模式
        </button>
        <button id="nn-inference-mode-btn" className={`btn ${mode === 'INFERENCE' ? 'btn-primary' : ''}`} onClick={() => { setMode('INFERENCE'); if (isAutoTraining) onAutoTrain(); }} style={{ flex: 1, padding: '6px', opacity: mode === 'INFERENCE' ? 1 : 0.6, background: mode === 'INFERENCE' ? 'var(--accent-purple)' : '', fontSize: '0.8rem' }}>
          预测推理
        </button>
      </div>

      <div style={{ background: 'rgba(244, 114, 182, 0.06)', padding: '8px 10px', borderRadius: '8px', borderLeft: '3px solid #f472b6' }}>
        <h3 style={{ margin: '0 0 3px 0', fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ background: '#f472b6', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>STEP</div>
          {stepTitle.substring(stepTitle.indexOf(' ') + 1)}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>
          {stepDesc}
        </p>
      </div>

      <div className="nn-stat-row">
        <div className="nn-stat-box">
          <span>隐藏神经元</span>
          <strong className="neuron-value">{model.hiddenNodes} 个</strong>
        </div>
        <div className="nn-stat-box">
          <span>BCE Loss</span>
          <strong className="loss-value">{loss.toFixed(4)}</strong>
        </div>
      </div>

      {unlocks.showActivation && (
        <div id="checkbox-relu" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(244, 114, 182, 0.1)', borderRadius: '8px', border: '1px solid rgba(244, 114, 182, 0.3)' }}>
          <input type="checkbox" id="relu-toggle" checked={useRelu} onChange={(e) => { const val = e.target.checked; setUseRelu(val); reportValueChange('checkbox-relu', val); }} disabled={isAutoTraining} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          <label htmlFor="relu-toggle" style={{ fontSize: '0.82rem', color: '#fff', cursor: 'pointer', flex: 1 }}>
            开启 ReLU 激活函数 (空间折叠)
          </label>
        </div>
      )}

      {unlocks.showHiddenLayers && (
        <div id="hidden-layers-slider" className="nn-slider-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              神经元数量: {hiddenNodes}
            </label>
          </div>
          <input type="range" min="1" max="16" step="1" value={hiddenNodes} onChange={(e) => { const val = parseInt(e.target.value, 10); setHiddenNodes(val); reportValueChange('hidden-layers-slider', val); }} style={{ width: '100%', cursor: 'pointer' }} disabled={isAutoTraining} />
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>修改神经元会重置网络</p>
        </div>
      )}

      {/* 数据预设按钮已移至 NeuralNetworkLab 的数据集面板 */}

      {unlocks.showLearningRate && (
        <div id="learning-rate-slider" className="nn-slider-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              学习步长: {learningRate.toFixed(2)}
            </label>
          </div>
          <input type="range" min="0.05" max="2.0" step="0.05" value={learningRate} onChange={(e) => { const val = parseFloat(e.target.value); setLearningRate(val); reportValueChange('learning-rate-slider', val); }} style={{ width: '100%', cursor: 'pointer' }} />
        </div>
      )}

      <div className="nn-control-buttons">
        <button className="btn" onClick={onTrainStep} disabled={mode !== 'TRAIN' || datasetLength === 0}>单步</button>
        <button id="btn-auto-train" className={`btn ${isAutoTraining ? '' : 'btn-primary'}`} onClick={() => { onAutoTrain(); reportClick('btn-auto-train'); }} disabled={mode !== 'TRAIN' || datasetLength === 0} title={datasetLength === 0 ? '请先在画布上放置数据，或点击右下角的预设生成' : ''} style={{ flex: 2, background: isAutoTraining ? 'var(--accent-red)' : '' }}>
          {isAutoTraining ? '停止训练' : '深度学习'}
        </button>
      </div>

      <div className="nn-secondary-buttons">
        <button className="btn" onClick={onClearTest}>清理预测点</button>
        <button className="btn" onClick={onReset}>彻底重置</button>
      </div>
    </div>
  );
}
