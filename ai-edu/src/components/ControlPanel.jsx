import React, { useState, useEffect } from 'react';

export default function ControlPanel({
  mode, setMode, onClearTest,
  w, b, loss, stepTitle, stepDesc,
  onTrainStep, onAutoTrain, isAutoTraining, onReset,
  learningRate, setLearningRate,
  reportClick, reportValueChange
}) {
  const [pointsCount, setPointsCount] = useState(0);
  const [showEncouragement, setShowEncouragement] = useState(false);
  const [encouragementMsg, setEncouragementMsg] = useState('');
  const [hasStartedTraining, setHasStartedTraining] = useState(false);
  const [prevLoss, setPrevLoss] = useState(null);

  // 监听 loss 变化来追踪训练进度
  useEffect(() => {
    if (loss != null && loss > 0 && prevLoss != null) {
      if (loss < prevLoss * 0.9) {
        // Loss 下降了至少 10%
        setEncouragementMsg('🎉 Loss 下降明显！模型正在学习！');
        setShowEncouragement(true);
        setTimeout(() => setShowEncouragement(false), 2500);
      }
    }
    setPrevLoss(loss);
  }, [loss, prevLoss]);

  const [trainButtonPulse, setTrainButtonPulse] = useState(false);
  useEffect(() => {
    if (isAutoTraining) {
      const interval = setInterval(() => {
        setTrainButtonPulse(p => !p);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isAutoTraining]);

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', position: 'relative' }}>
      {/* 顶部标题 */}
      <div>
        <h2 className="text-gradient" style={{ margin: '0', fontSize: '1.3rem' }}>AI 黑盒实验室</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
          揭开机器学习：从数据到模型
        </p>
      </div>

      {/* 鼓励文案 */}
      {showEncouragement && (
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(22,163,74,0.95))',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '25px',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(34,197,94,0.5)',
          animation: 'encourageIn 0.4s ease-out',
          zIndex: 10,
          whiteSpace: 'nowrap'
        }}>
          {encouragementMsg}
        </div>
      )}

      {/* 模式切换 */}
      <div id="lr-btn-mode-toggle" style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px' }}>
        <button
          id="lr-btn-mode-train"
          className={`btn ${mode === 'TRAIN' ? 'btn-primary' : ''}`}
          onClick={() => { setMode('TRAIN'); if (reportClick) reportClick('lr-btn-mode-train'); }}
          style={{ 
            flex: 1, 
            padding: '8px', 
            opacity: mode === 'TRAIN' ? 1 : 0.6, 
            fontSize: '0.9rem',
            transition: 'all 0.2s ease'
          }}
        >
          🏋️ 训练模式
        </button>
        <button
          id="lr-btn-mode-inference"
          className={`btn ${mode === 'INFERENCE' ? 'btn-primary' : ''}`}
          onClick={() => { setMode('INFERENCE'); if(isAutoTraining) onAutoTrain(); if (reportClick) reportClick('lr-btn-mode-toggle'); }}
          style={{ 
            flex: 1, 
            padding: '8px', 
            opacity: mode === 'INFERENCE' ? 1 : 0.6, 
            background: mode === 'INFERENCE' ? 'var(--accent-purple)' : '',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease'
          }}
        >
          🛸 预测推理
        </button>
      </div>

      {/* 教学步骤提示块 */}
      <div style={{ 
        background: 'rgba(59, 130, 246, 0.08)', 
        padding: '12px', 
        borderRadius: '8px', 
        borderLeft: '3px solid var(--accent-blue)',
        transition: 'all 0.3s ease'
      }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'var(--accent-blue)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>STEP</div>
          {stepTitle ? stepTitle.substring(stepTitle.indexOf(' ') + 1) : ''}
        </h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
          {stepDesc || ''}
        </p>
      </div>

      {/* 核心指标展示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            模型公式 (Model)
          </div>
          <div style={{ fontSize: '1.1rem', marginTop: '4px', fontWeight: 'bold' }}>
            y = <span style={{color: 'var(--accent-green)'}}>w</span>x + <span style={{color: 'var(--accent-green)'}}>b</span>
          </div>
          <div style={{ fontSize: '1rem', fontFamily: 'monospace', marginTop: '4px', color: 'var(--text-secondary)' }}>
            w: {w != null ? w.toFixed(4) : '----'} <br/>
            b: {b != null ? b.toFixed(4) : '----'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>误差总和 (Loss)</div>
          <div id="lr-loss-display" style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: loss < 0.1 ? 'var(--accent-green)' : loss < 0.5 ? 'var(--accent-orange)' : 'var(--accent-red)',
            fontFamily: 'monospace',
            textShadow: loss < 0.1 ? '0 0 15px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.3)',
            transition: 'all 0.3s ease'
          }}>
            {loss != null ? loss.toFixed(4) : '----'}
          </div>
          {/* Loss 质量标签 */}
          {loss != null && loss > 0 && (
            <div style={{
              fontSize: '0.7rem',
              color: loss < 0.05 ? 'var(--accent-green)' : loss < 0.2 ? 'var(--accent-orange)' : 'var(--accent-red)',
              marginTop: '2px'
            }}>
              {loss < 0.05 ? '✅ 优秀' : loss < 0.2 ? '🟡 良好' : loss < 0.5 ? '🟠 一般' : '🔴 需优化'}
            </div>
          )}
        </div>
      </div>

      {/* 控制条 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            学习步长 (学习率)
          </label>
          <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{learningRate.toFixed(2)}</span>
        </div>
        <input
          id="lr-slider-learning-rate"
          type="range"
          min="0.01"
          max="1.0"
          step="0.01"
          value={learningRate}
          onChange={(e) => { setLearningRate(parseFloat(e.target.value)); if (reportValueChange) reportValueChange('lr-slider-learning-rate', parseFloat(e.target.value)); }}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button id="lr-btn-train-step" className="btn" onClick={() => { onTrainStep(); if (reportClick) reportClick('lr-btn-train-step'); }} style={{ flex: 1 }} disabled={mode !== 'TRAIN'}>
          单步 (Step)
        </button>
        <button
          id="lr-btn-auto-train"
          className={`btn ${isAutoTraining ? '' : 'btn-primary'}`}
          onClick={() => { onAutoTrain(); if (reportClick) reportClick('lr-btn-auto-train'); }}
          disabled={mode !== 'TRAIN'}
          style={{ 
            flex: 1, 
            background: isAutoTraining ? 'var(--accent-red)' : '',
            transform: trainButtonPulse && isAutoTraining ? 'scale(0.98)' : 'scale(1)',
            transition: 'all 0.15s ease'
          }}
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

      <style>{`
        @keyframes encourageIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
