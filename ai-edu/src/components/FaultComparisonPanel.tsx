import React from 'react';

/**
 * 修复前后状态对比记录
 */
export interface FixStateRecord {
  timestamp: number;
  faultType: string;
  before: {
    lr: number;
    initialization: string;
    useGradientClipping: boolean;
    activationType: string;
    hiddenNodes: number;
    loss: number | null;
    status: string;
  };
  after?: {
    lr: number;
    initialization: string;
    useGradientClipping: boolean;
    activationType: string;
    hiddenNodes: number;
    loss: number | null;
    status: string;
  };
}

/**
 * 对比面板属性
 */
export interface FaultComparisonPanelProps {
  fixHistory: FixStateRecord[];
  currentState?: {
    lr: number;
    initialization: string;
    useGradientClipping: boolean;
    activationType: string;
    hiddenNodes: number;
    loss: number | null;
  };
  faultType?: string | null;
}

/**
 * 格式化参数值显示
 */
function formatValue(key: string, value: any): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'number') {
    if (key === 'lr') return value.toFixed(4);
    return value.toString();
  }
  switch (key) {
    case 'initialization':
      switch (value) {
        case 'random': return 'He';
        case 'xavier': return 'Xavier';
        case 'large': return '大权重';
        case 'tiny': return '小权重';
        default: return String(value);
      }
    case 'activationType':
      switch (value) {
        case 'relu': return 'ReLU';
        case 'sigmoid': return 'Sigmoid';
        case 'tanh': return 'Tanh';
        case 'leakyrelu': return 'Leaky';
        default: return String(value);
      }
    case 'useGradientClipping':
      return value ? '✓' : '✗';
    default:
      return String(value);
  }
}

/**
 * 计算变化百分比
 */
function calcChange(key: string, before: any, after: any): string {
  if (before === after) return '-';
  if (key === 'lr') {
    const beforeNum = Number(before) || 0;
    const afterNum = Number(after) || 0;
    if (beforeNum === 0) return '-';
    const percent = ((afterNum - beforeNum) / beforeNum * 100).toFixed(0);
    return `${afterNum > beforeNum ? '+' : ''}${percent}%`;
  }
  if (key === 'loss' && typeof before === 'number' && typeof after === 'number') {
    if (before === 0) return '-';
    const percent = ((after - before) / before * 100).toFixed(0);
    return `${after < before ? '-' : '+'}${Math.abs(Number(percent))}%`;
  }
  return '✓';
}

/**
 * 获取故障类型图标
 */
function getFaultIcon(faultType: string): string {
  switch (faultType) {
    case 'gradient-explosion': return '🔴';
    case 'gradient-vanishing': return '🟠';
    case 'overfitting': return '🟡';
    case 'data-poisoning': return '🟣';
    default: return '⚠️';
  }
}

/**
 * 获取故障类型中文名
 */
function getFaultName(faultType: string): string {
  switch (faultType) {
    case 'gradient-explosion': return '梯度爆炸';
    case 'gradient-vanishing': return '梯度消失';
    case 'overfitting': return '过拟合';
    case 'data-poisoning': return '数据污染';
    default: return faultType;
  }
}

/**
 * 对比面板组件
 * 显示修复前后的参数变化
 */
export const FaultComparisonPanel: React.FC<FaultComparisonPanelProps> = ({
  fixHistory,
  currentState,
  faultType
}) => {
  // 获取最近的修复记录
  const latestFix = fixHistory.length > 0 ? fixHistory[fixHistory.length - 1] : null;

  // 参数列表
  const params = [
    { key: 'lr', label: '学习率' },
    { key: 'initialization', label: '初始化' },
    { key: 'useGradientClipping', label: '梯度裁剪' },
    { key: 'activationType', label: '激活函数' },
    { key: 'hiddenNodes', label: '神经元' }
  ];

  if (!latestFix) {
    return (
      <div className="glass-panel" style={{
        padding: '12px',
        height: 'fit-content'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--accent-purple)' }}>
          📊 修复历史
        </h4>
        <div style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '20px 0'
        }}>
          暂无修复记录
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{
      padding: '12px',
      height: 'fit-content',
      flexShrink: 0
    }}>
      {/* 标题 */}
      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📊</span>
        <span>修复对比</span>
        {fixHistory.length > 0 && (
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            background: 'rgba(76, 175, 80, 0.2)',
            borderRadius: '4px',
            color: '#4caf50'
          }}>
            {fixHistory.length} 次
          </span>
        )}
      </h4>

      {/* 当前故障状态 */}
      {faultType && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          padding: '6px 10px',
          background: 'rgba(255, 77, 79, 0.15)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 77, 79, 0.3)'
        }}>
          <span style={{ fontSize: '1.1rem' }}>{getFaultIcon(faultType)}</span>
          <span style={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '0.85rem' }}>
            {getFaultName(faultType)}
          </span>
        </div>
      )}

      {/* 参数对比表格 */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* 表头 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 30px 70px',
          gap: '4px',
          padding: '6px 8px',
          background: 'rgba(255, 255, 255, 0.05)',
          fontSize: '0.7rem',
          color: 'rgba(255, 255, 255, 0.5)',
          fontWeight: 'bold'
        }}>
          <span>指标</span>
          <span style={{ textAlign: 'center' }}>修复前</span>
          <span style={{ textAlign: 'center' }}>变化</span>
          <span style={{ textAlign: 'center' }}>修复后</span>
        </div>

        {/* 数据行 */}
        {params.map(({ key, label }) => {
          const beforeVal = latestFix.before[key as keyof typeof latestFix.before];
          const afterVal = latestFix.after ? latestFix.after[key as keyof typeof latestFix.after] : currentState[key as keyof typeof currentState];
          const hasChanged = beforeVal !== afterVal;

          return (
            <div key={key} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 70px 30px 70px',
              gap: '4px',
              padding: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '0.8rem',
              alignItems: 'center'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{label}</span>
              <span style={{
                textAlign: 'center',
                color: hasChanged ? 'rgba(255, 255, 255, 0.4)' : '#4dabf7',
                textDecoration: hasChanged ? 'line-through' : 'none'
              }}>
                {formatValue(key, beforeVal)}
              </span>
              <span style={{
                textAlign: 'center',
                color: hasChanged ? '#4caf50' : 'rgba(255, 255, 255, 0.3)'
              }}>
                {hasChanged ? '→' : '-'}
              </span>
              <span style={{
                textAlign: 'center',
                color: hasChanged ? '#4caf50' : '#4dabf7',
                fontWeight: hasChanged ? 'bold' : 'normal'
              }}>
                {formatValue(key, afterVal)}
              </span>
            </div>
          );
        })}

        {/* Loss对比 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 30px 70px',
          gap: '4px',
          padding: '8px',
          fontSize: '0.8rem',
          alignItems: 'center',
          background: 'rgba(76, 175, 80, 0.1)'
        }}>
          <span style={{ color: '#4caf50', fontWeight: 'bold' }}>Loss</span>
          <span style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            textDecoration: 'line-through'
          }}>
            {latestFix.before.loss !== null ? (Number.isNaN(latestFix.before.loss) ? 'NaN' : latestFix.before.loss.toFixed(2)) : '-'}
          </span>
          <span style={{ textAlign: 'center', color: '#4caf50' }}>→</span>
          <span style={{
            textAlign: 'center',
            color: '#4caf50',
            fontWeight: 'bold'
          }}>
            {currentState.loss !== null ? (Number.isNaN(currentState.loss) ? 'NaN' : currentState.loss.toFixed(2)) : '-'}
          </span>
        </div>
      </div>

      {/* 修复历史 */}
      {fixHistory.length > 1 && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            历史记录: {fixHistory.length} 次修复
          </span>
        </div>
      )}
    </div>
  );
};

export default FaultComparisonPanel;
