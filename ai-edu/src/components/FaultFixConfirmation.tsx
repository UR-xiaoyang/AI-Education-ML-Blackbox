import React from 'react';
import { FaultType } from '../hooks/useFaultyTrainingEngine';

/**
 * 推荐参数配置
 */
export interface RecommendedParams {
  lr?: number;
  initialization?: 'random' | 'xavier' | 'large' | 'tiny';
  useGradientClipping?: boolean;
  activationType?: 'relu' | 'sigmoid' | 'tanh' | 'leakyrelu';
  hiddenNodes?: number;
  epochs?: number;
  datasetType?: string;
}

/**
 * 修复确认对话框属性
 */
export interface FaultFixConfirmationProps {
  faultType: FaultType;
  currentParams: {
    lr: number;
    initialization: string;
    useGradientClipping: boolean;
    activationType: string;
    hiddenNodes: number;
    datasetType: string;
  };
  recommendedParams: RecommendedParams;
  onConfirm: () => void;
  onCancel: () => void;
  onManualFix: () => void;
}

/**
 * 获取故障类型的中文名称
 */
function getFaultTypeName(faultType: FaultType): string {
  switch (faultType) {
    case 'gradient-explosion': return '梯度爆炸';
    case 'gradient-vanishing': return '梯度消失';
    case 'overfitting': return '过拟合';
    case 'data-poisoning': return '数据污染';
    case 'local-minima': return '局部最小值';
    case 'bad-initialization': return '初始化不当';
    default: return '未知故障';
  }
}

/**
 * 获取故障类型的图标
 */
function getFaultTypeIcon(faultType: FaultType): string {
  switch (faultType) {
    case 'gradient-explosion': return '🔴';
    case 'gradient-vanishing': return '🟠';
    case 'overfitting': return '🟡';
    case 'data-poisoning': return '🟣';
    default: return '⚠️';
  }
}

/**
 * 获取故障类型的原因说明
 */
function getFaultReason(faultType: FaultType): string {
  switch (faultType) {
    case 'gradient-explosion':
      return '学习率过大，导致参数更新步长失控，数值溢出变成NaN';
    case 'gradient-vanishing':
      return '学习率过小 + 激活函数梯度消失，导致参数几乎不更新';
    case 'overfitting':
      return '模型过于复杂，在训练数据上表现好但泛化能力差';
    case 'data-poisoning':
      return '数据中包含极端离群点，扭曲了模型参数';
    default:
      return '参数配置不当导致训练异常';
  }
}

/**
 * 修复策略说明
 */
function getFixStrategy(faultType: FaultType): string[] {
  switch (faultType) {
    case 'gradient-explosion':
      return [
        '降低学习率（减小每步更新幅度）',
        '启用梯度裁剪（限制最大更新步长）',
        '使用合理的权重初始化'
      ];
    case 'gradient-vanishing':
      return [
        '提高学习率（增加每步更新幅度）',
        '使用ReLU激活函数（避免梯度消失）',
        '使用He初始化（适合ReLU）'
      ];
    case 'overfitting':
      return [
        '减少神经元数量（降低模型容量）',
        '使用早停（避免训练过度）',
        '使用正则化'
      ];
    case 'data-poisoning':
      return [
        '移除离群点（数据清洗）',
        '使用鲁棒损失函数',
        '数据标准化'
      ];
    default:
      return ['调整参数配置'];
  }
}

/**
 * 参数格式化
 */
function formatValue(key: string, value: any): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'number') {
    if (key === 'lr') return value.toFixed(4);
    if (key === 'epochs') return value.toString();
    return value.toString();
  }
  switch (key) {
    case 'initialization':
      switch (value) {
        case 'random': return 'He初始化';
        case 'xavier': return 'Xavier初始化';
        case 'large': return '大权重';
        case 'tiny': return '小权重';
        default: return value;
      }
    case 'activationType':
      switch (value) {
        case 'relu': return 'ReLU';
        case 'sigmoid': return 'Sigmoid';
        case 'tanh': return 'Tanh';
        case 'leakyrelu': return 'Leaky ReLU';
        default: return value;
      }
    case 'useGradientClipping':
      return value ? '✓ 启用' : '✗ 禁用';
    case 'datasetType':
      switch (value) {
        case 'standard': return '标准数据';
        case 'noisy': return '噪音数据';
        case 'outlier': return '离群点数据';
        case 'poisoned': return '污染数据';
        case 'sparse': return '稀疏数据';
        default: return value;
      }
    default:
      return String(value);
  }
}

/**
 * 判断参数是否有变化
 */
function hasChange(key: string, current: any, recommended: any): boolean {
  if (recommended === undefined) return false;
  if (key === 'lr') return Math.abs(current - recommended) > 0.0001;
  return current !== recommended;
}

/**
 * 修复确认对话框组件
 */
export const FaultFixConfirmation: React.FC<FaultFixConfirmationProps> = ({
  faultType,
  currentParams,
  recommendedParams,
  onConfirm,
  onCancel,
  onManualFix
}) => {
  if (!faultType) return null;

  const faultIcon = getFaultTypeIcon(faultType);
  const faultName = getFaultTypeName(faultType);
  const faultReason = getFaultReason(faultType);
  const fixStrategies = getFixStrategy(faultType);

  // 参数比较列表
  const paramComparisons = [
    { key: 'lr', label: '学习率' },
    { key: 'initialization', label: '权重初始化' },
    { key: 'useGradientClipping', label: '梯度裁剪' },
    { key: 'activationType', label: '激活函数' },
    { key: 'hiddenNodes', label: '神经元数' },
    { key: 'datasetType', label: '数据集' }
  ].filter(p => recommendedParams[p.key as keyof RecommendedParams] !== undefined);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" style={{
        width: '480px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* 标题 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '2rem' }}>{faultIcon}</span>
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-red)', fontSize: '1.2rem' }}>
              检测到故障：{faultName}
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
              {faultReason}
            </p>
          </div>
        </div>

        {/* 参数对比 */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-blue)', fontSize: '0.9rem' }}>
            📊 参数对比
          </h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {paramComparisons.map(({ key, label }) => {
              const currentVal = currentParams[key as keyof typeof currentParams];
              const recommendedVal = recommendedParams[key as keyof RecommendedParams];
              const changed = hasChange(key, currentVal, recommendedVal);

              return (
                <div key={key} style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      color: changed ? 'rgba(255,255,255,0.5)' : '#4dabf7',
                      textDecoration: changed ? 'line-through' : 'none'
                    }}>
                      {formatValue(key, currentVal)}
                    </span>
                    {changed && (
                      <>
                        <span style={{ color: '#4caf50' }}>→</span>
                        <span style={{
                          color: '#4caf50',
                          fontWeight: 'bold',
                          background: 'rgba(76, 175, 80, 0.2)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {formatValue(key, recommendedVal)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 修复策略 */}
        <div style={{
          background: 'rgba(76, 175, 80, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          border: '1px solid rgba(76, 175, 80, 0.3)'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#4caf50', fontSize: '0.9rem' }}>
            💡 修复策略
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>
            {fixStrategies.map((strategy, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{strategy}</li>
            ))}
          </ul>
        </div>

        {/* 按钮组 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 2,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            ✓ 确认应用修复
          </button>
          <button
            onClick={onManualFix}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255, 152, 0, 0.2)',
              border: '1px solid rgba(255, 152, 0, 0.5)',
              borderRadius: '8px',
              color: '#ff9800',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.1s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)';
            }}
          >
            🔧 自己调整
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.1s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaultFixConfirmation;
