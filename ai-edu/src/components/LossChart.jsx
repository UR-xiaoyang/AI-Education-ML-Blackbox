import React, { useEffect, useRef, useState } from 'react';

export default function LossChart({ lossHistory }) {
  const containerRef = useRef(null);
  const [logicalWidth, setLogicalWidth] = useState(400);
  const height = 78;

  // Responsive sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setLogicalWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (lossHistory.length === 0) {
    return (
      <div ref={containerRef} className="glass-panel" style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>暂无训练数据</p>
      </div>
    );
  }

  // 计算 Loss 范围来动态缩放图表，过滤掉 Infinity
  const validLosses = lossHistory.filter(l => isFinite(l));
  const hasInfinity = lossHistory.some(l => !isFinite(l));

  if (validLosses.length === 0) {
    return (
      <div ref={containerRef} className="glass-panel" style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>训练崩溃 (NaN/Inf)</p>
      </div>
    );
  }

  const maxLoss = Math.max(...validLosses, 0.1); // 最少0.1避免除0
  const minLoss = 0;
  const range = maxLoss - minLoss;

  const getSvgX = (index) => (index / Math.max(lossHistory.length - 1, 1)) * logicalWidth;
  // SVG 的 Y 轴往下是正方向，所以要翻转
  const getSvgY = (loss) => {
    if (!isFinite(loss)) return 5; // Infinity 显示在顶部
    return height - ((loss - minLoss) / range) * (height - 20) - 10;
  };

  const pathD = lossHistory.map((loss, i) => {
    return `${i === 0 ? 'M' : 'L'} ${getSvgX(i)} ${getSvgY(loss)}`;
  }).join(' ');

  return (
    <div ref={containerRef} id="loss-chart-container" className="glass-panel" style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>
      {hasInfinity && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,100,100,0.9)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', color: '#fff', zIndex: 10 }}>
          数值崩溃！
        </div>
      )}
      <svg width={logicalWidth} height={height} viewBox={`0 0 ${logicalWidth} ${height}`}>
        {/* 透明参考线 */}
        <line x1={0} y1={height/2} x2={logicalWidth} y2={height/2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

        {/* 核心Loss平滑曲线 */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--accent-red)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'all 0.05s linear' }}
        />
        {/* 最新的那个点高亮显示 */}
        {lossHistory.length > 0 && (
          <circle
            cx={getSvgX(lossHistory.length - 1)}
            cy={getSvgY(lossHistory[lossHistory.length - 1])}
            r="5"
            fill="var(--accent-red)"
            stroke="#fff"
            strokeWidth="2"
            style={{ transition: 'all 0.05s linear' }}
          />
        )}
      </svg>
      {/* 标题 */}
      <div style={{ position: 'absolute', top: 6, left: 10, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>
        ↘ Loss 曲线
      </div>
      {/* Loss 质量标签 */}
      {validLosses.length > 0 && (() => {
        const latest = validLosses[validLosses.length - 1];
        const first = validLosses[0];
        const improving = latest < first;
        const quality = latest < 0.05 ? { label: '✅ 优秀', color: '#4ade80' } : latest < 0.15 ? { label: '🟡 良好', color: '#fbbf24' } : latest < 0.5 ? { label: '🟠 一般', color: '#fb923c' } : { label: '🔴 需优化', color: '#f87171' };
        return (
          <div style={{ position: 'absolute', top: 6, right: 10, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: quality.color }}>{quality.label}</span>
            {improving && <span style={{ fontSize: '0.68rem', color: '#4ade80' }}>↘ 在下降</span>}
            {!improving && latest > 0.3 && <span style={{ fontSize: '0.68rem', color: '#f87171' }}>⚠️ 无明显下降</span>}
          </div>
        );
      })()}
      {/* 当前值 */}
      {validLosses.length > 0 && (
        <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
          当前: {validLosses[validLosses.length - 1].toFixed(4)}
        </div>
      )}
    </div>
  );
}
