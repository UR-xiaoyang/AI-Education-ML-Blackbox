import React, { useEffect, useRef, useState } from 'react';
import { FaultType } from '../hooks/useFaultyTrainingEngine';

interface FaultLossChartProps {
  lossHistory: number[];
  validationLossHistory?: number[];
  faultType: FaultType | null;
  currentEpoch?: number;
  totalEpochs?: number;
}

/**
 * 故障诊断课程专用的 Loss 曲线图表
 * 展示训练过程中的损失变化，并标注故障类型
 * 支持同时显示训练Loss和验证Loss用于检测过拟合
 */
export const FaultLossChart: React.FC<FaultLossChartProps> = ({
  lossHistory,
  validationLossHistory = [],
  faultType,
  currentEpoch = 0,
  totalEpochs = 1000
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [logicalWidth, setLogicalWidth] = useState(400);
  const height = 100;

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

  // 计算统计数据
  const validLosses = lossHistory.filter(l => isFinite(l));
  const validValLosses = validationLossHistory.filter(l => isFinite(l) && !isNaN(l));
  const hasNaN = lossHistory.some(l => isNaN(l));
  const hasInfinity = lossHistory.some(l => !isFinite(l) && !isNaN(l));
  const currentLoss = validLosses[validLosses.length - 1];
  const minLoss = validLosses.length > 0 ? Math.min(...validLosses) : 0;

  // 计算验证集统计数据
  const showValidationLoss = validationLossHistory.length > 0;
  const currentValLoss = validValLosses[validValLosses.length - 1];
  const minValLoss = validValLosses.length > 0 ? Math.min(...validValLosses) : 0;

  // 渲染状态
  if (lossHistory.length === 0) {
    return (
      <div ref={containerRef} className="glass-panel" style={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
          暂无训练数据
        </p>
      </div>
    );
  }

  // 计算图表参数 - Y轴始终从0开始，X轴始终从0到totalEpochs
  const combinedLosses = [...validLosses, ...validValLosses];
  const maxLoss = combinedLosses.length > 0 ? Math.max(...combinedLosses, 0.1) : 0.1;

  // X轴：epoch 从 0 到 totalEpochs
  const getSvgX = (index: number) => (index / Math.max(totalEpochs - 1, 1)) * logicalWidth;

  // Y轴：loss 从 0 到 maxLoss（全程保持从0开始）
  const getSvgY = (loss: number) => {
    if (!isFinite(loss)) return 8; // NaN/Inf 显示在顶部
    if (maxLoss === 0) return height / 2;
    return height - (loss / maxLoss) * (height - 20) - 10;
  };

  // 生成训练Loss路径
  const pathD = lossHistory.map((loss, i) => {
    return `${i === 0 ? 'M' : 'L'} ${getSvgX(i)} ${getSvgY(loss)}`;
  }).join(' ');

  // 生成验证Loss路径
  const valPathD = showValidationLoss ? validationLossHistory.map((loss, i) => {
    // 验证Loss与训练Loss的epoch对齐
    const trainIndex = Math.round((i / validationLossHistory.length) * (lossHistory.length - 1));
    return `${i === 0 ? 'M' : 'L'} ${getSvgX(trainIndex)} ${getSvgY(loss)}`;
  }).join(' ') : '';

  // 故障类型对应的颜色和标签
  const faultColors: Record<string, { color: string; bg: string }> = {
    'gradient-explosion': { color: '#ff4d4f', bg: 'rgba(255,77,79,0.2)' },
    'gradient-vanishing': { color: '#ff9800', bg: 'rgba(255,152,0,0.2)' },
    'overfitting': { color: '#ffb300', bg: 'rgba(255,179,0,0.2)' },
    'data-poisoning': { color: '#9c27b0', bg: 'rgba(156,39,176,0.2)' },
    'bad-initialization': { color: '#e91e63', bg: 'rgba(233,30,99,0.2)' },
    'local-minima': { color: '#00bcd4', bg: 'rgba(0,188,212,0.2)' },
  };

  const faultLabels: Record<string, string> = {
    'gradient-explosion': '梯度爆炸',
    'gradient-vanishing': '梯度消失',
    'overfitting': '过拟合',
    'data-poisoning': '数据污染',
    'bad-initialization': '初始化不当',
    'local-minima': '局部最优',
  };

  const currentColor = faultType ? faultColors[faultType]?.color || 'var(--accent-red)' : 'var(--accent-red)';
  const faultBg = faultType ? faultColors[faultType]?.bg : 'transparent';

  return (
    <div ref={containerRef} id="fault-loss-chart-container" className="glass-panel" style={{
      width: '100%',
      height,
      position: 'relative',
      overflow: 'hidden',
      background: faultBg
    }}>
      {/* 顶部信息栏 */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 10,
        right: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.72rem',
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 'bold'
      }}>
        <span>↘ Loss 曲线</span>
        <span>Epoch: {currentEpoch} / {totalEpochs}</span>
      </div>

      {/* 故障指示器 */}
      {faultType && (
        <div style={{
          position: 'absolute',
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          background: faultColors[faultType]?.color || '#ff4d4f',
          padding: '2px 10px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#fff',
          fontWeight: 'bold',
          zIndex: 10
        }}>
          ⚠️ {faultLabels[faultType]}
        </div>
      )}

      {/* 数值崩溃提示 */}
      {(hasNaN || hasInfinity) && !faultType && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,77,79,0.9)',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          color: '#fff',
          zIndex: 10
        }}>
          数值崩溃 (NaN/Inf)
        </div>
      )}

      <svg width={logicalWidth} height={height} viewBox={`0 0 ${logicalWidth} ${height}`}>
        {/* 参考线 */}
        <line
          x1={0}
          y1={height / 2}
          x2={logicalWidth}
          y2={height / 2}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="4 4"
        />

        {/* 验证Loss曲线（如果有） */}
        {showValidationLoss && (
          <path
            d={valPathD}
            fill="none"
            stroke="#9c27b0"
            strokeWidth="2"
            strokeDasharray="5 3"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ transition: 'all 0.05s linear', opacity: 0.7 }}
          />
        )}

        {/* Loss 曲线 */}
        <path
          d={pathD}
          fill="none"
          stroke={currentColor}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'all 0.05s linear' }}
        />

        {/* 当前点高亮 */}
        {lossHistory.length > 0 && (
          <circle
            cx={getSvgX(lossHistory.length - 1)}
            cy={getSvgY(lossHistory[lossHistory.length - 1])}
            r="5"
            fill={currentColor}
            stroke="#fff"
            strokeWidth="2"
            style={{ transition: 'all 0.05s linear' }}
          />
        )}

        {/* 验证Loss当前点（如果有） */}
        {showValidationLoss && validationLossHistory.length > 0 && (
          <circle
            cx={getSvgX(validationLossHistory.length - 1)}
            cy={getSvgY(validationLossHistory[validationLossHistory.length - 1])}
            r="4"
            fill="#9c27b0"
            stroke="#fff"
            strokeWidth="1.5"
            style={{ transition: 'all 0.05s linear' }}
          />
        )}
      </svg>

      {/* 底部统计信息 */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        left: 10,
        right: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.65rem',
        color: 'rgba(255,255,255,0.5)'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {showValidationLoss ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '2px', background: currentColor, display: 'inline-block' }}></span>
                训练: {isFinite(currentLoss) ? currentLoss.toFixed(4) : 'NaN'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '2px', background: '#9c27b0', display: 'inline-block', borderStyle: 'dashed' }}></span>
                验证: {isFinite(currentValLoss) ? currentValLoss.toFixed(4) : 'NaN'}
              </span>
            </>
          ) : (
            <span>
              当前: {isFinite(currentLoss) ? currentLoss.toFixed(4) : 'NaN'} |
              最低: {minLoss.toFixed(4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaultLossChart;
