import { useState, useRef, useCallback } from 'react';
import { DataPoint } from '../utils/faultyDataPresets';

/**
 * 训练配置接口
 */
export interface TrainingConfig {
  hiddenNodes: number;
  epochs: number;
  lr: number;
  dataset: DataPoint[];
  activationType?: 'relu' | 'sigmoid' | 'tanh' | 'leakyrelu';
  initialization?: 'random' | 'xavier' | 'large' | 'tiny';
  useGradientClipping?: boolean;
  weightDecay?: number;
  // 用于检测过拟合的验证数据集
  validationDataset?: DataPoint[];
}

/**
 * 训练状态接口
 */
export interface TrainingState {
  isTraining: boolean;
  currentEpoch: number;
  loss: number | null;
  validationLoss: number | null;  // 验证集 Loss，用于检测过拟合
  curvePoints: DataPoint[];
  lossHistory: number[];
  validationLossHistory: number[];  // 验证集 Loss 历史
  statusMessage: string | null;
  statusType: 'normal' | 'warning' | 'error' | null;
  faultType: FaultType | null;
  solutionTips: string[];  // 解决方案提示
  // 故障检测触发标志（用于显示修复确认对话框）
  faultJustDetected: boolean;
}

/**
 * 推荐修复参数
 */
export interface RecommendedFix {
  lr?: number;
  initialization?: 'random' | 'xavier' | 'large' | 'tiny';
  useGradientClipping?: boolean;
  activationType?: 'relu' | 'sigmoid' | 'tanh' | 'leakyrelu';
  hiddenNodes?: number;
  epochs?: number;
  datasetType?: string;
}

/**
 * 故障类型枚举
 */
export type FaultType =
  | 'gradient-explosion'
  | 'gradient-vanishing'
  | 'overfitting'
  | 'data-poisoning'
  | 'bad-initialization'
  | 'local-minima'
  | null;

/**
 * 激活函数计算
 */
function activation(x: number, type: TrainingConfig['activationType']): number {
  switch (type) {
    case 'sigmoid':
      return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    case 'tanh':
      return Math.tanh(x);
    case 'leakyrelu':
      return x > 0 ? x : 0.1 * x;
    case 'relu':
    default:
      return Math.max(0, x);
  }
}

/**
 * 激活函数导数
 */
function activationDerivative(x: number, type: TrainingConfig['activationType']): number {
  switch (type) {
    case 'sigmoid': {
      const sig = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
      return sig * (1 - sig);
    }
    case 'tanh':
      return 1 - Math.tanh(x) ** 2;
    case 'leakyrelu':
      return x > 0 ? 1 : 0.1;
    case 'relu':
    default:
      return x > 0 ? 1 : 0;
  }
}

/**
 * 梯度裁剪
 */
function clipGradient(value: number, maxNorm: number = 5.0): number {
  if (Math.abs(value) > maxNorm) {
    return Math.sign(value) * maxNorm;
  }
  return value;
}

export function useFaultyTrainingEngine(config: TrainingConfig) {
  const [state, setState] = useState<TrainingState>({
    isTraining: false,
    currentEpoch: 0,
    loss: null,
    validationLoss: null,
    curvePoints: [],
    lossHistory: [],
    validationLossHistory: [],
    statusMessage: null,
    statusType: null,
    faultType: null,
    solutionTips: [],
    faultJustDetected: false,
  });

  const reqRef = useRef<number | null>(null);
  const stopRef = useRef<boolean>(false);

  const reset = useCallback(() => {
    if (reqRef.current) cancelAnimationFrame(reqRef.current);
    stopRef.current = true;
    setState({
      isTraining: false,
      currentEpoch: 0,
      loss: null,
      validationLoss: null,
      curvePoints: [],
      lossHistory: [],
      validationLossHistory: [],
      statusMessage: null,
      statusType: null,
      faultType: null,
      solutionTips: [],
      faultJustDetected: false,
    });
  }, []);

  const startTraining = useCallback(() => {
    reset();
    stopRef.current = false;

    setState((prev) => ({
      ...prev,
      isTraining: true,
      statusMessage: null,
      statusType: null,
      faultType: null,
      solutionTips: [],
      faultJustDetected: false,
    }));

    const N = config.hiddenNodes;
    const { dataset, lr, epochs, activationType = 'relu', initialization = 'random', validationDataset } = config;
    const m = dataset.length;

    if (m === 0) {
      setState(prev => ({ ...prev, isTraining: false }));
      return;
    }

    const X = dataset.map(d => d.x);
    const Y = dataset.map(d => d.y);

    // 验证集数据
    const valX = validationDataset ? validationDataset.map(d => d.x) : X;
    const valY = validationDataset ? validationDataset.map(d => d.y) : Y;
    const valM = valX.length;

    // 初始化权重 - 使用更适合的初始化方法
    const w1: number[] = new Array(N);
    const b1: number[] = new Array(N);
    const w2: number[] = new Array(N);
    let b2 = 0;

    // 缩放因子：对于 ReLU，推荐使用 sqrt(2.0 / fan_in)
    const heScale = Math.sqrt(2.0 / 1);  // fan_in = 1

    for (let j = 0; j < N; j++) {
      switch (initialization) {
        case 'xavier':
          // Xavier: sqrt(6 / (fan_in + fan_out))
          const xavierScale = Math.sqrt(6.0 / (1 + 1));
          w1[j] = (Math.random() * 2 - 1) * xavierScale;
          w2[j] = (Math.random() * 2 - 1) * xavierScale;
          b1[j] = 0;
          break;
        case 'large':
          w1[j] = (Math.random() * 2 - 1) * 10;
          w2[j] = (Math.random() * 2 - 1) * 10;
          b1[j] = 0;
          break;
        case 'tiny':
          w1[j] = (Math.random() * 2 - 1) * 0.001;
          w2[j] = (Math.random() * 2 - 1) * 0.001;
          b1[j] = 0;
          break;
        default: // He 初始化 (适合 ReLU)
          w1[j] = (Math.random() * 2 - 1) * heScale;
          w2[j] = (Math.random() * 2 - 1) * heScale;
          b1[j] = 0;
      }
    }

    switch (initialization) {
      case 'xavier':
        b2 = 0;
        break;
      case 'large':
        b2 = 0;
        break;
      case 'tiny':
        b2 = 0;
        break;
      default:
        b2 = 0;
    }

    let currentEpoch = 0;
    const batchSize = 20;
    const lossHistory: number[] = [];
    const validationLossHistory: number[] = [];
    const useClipping = config.useGradientClipping ?? false;

    /**
     * 计算验证集 Loss
     */
    const computeValidationLoss = (): number => {
      let totalLoss = 0;
      for (let i = 0; i < valM; i++) {
        const x = valX[i];
        const y = valY[i];

        const a1 = new Array(N);
        for (let j = 0; j < N; j++) {
          a1[j] = activation(x * w1[j] + b1[j], activationType);
        }

        let y_pred = b2;
        for (let j = 0; j < N; j++) {
          y_pred += a1[j] * w2[j];
        }

        totalLoss += 0.5 * Math.pow(y_pred - y, 2);
      }
      return totalLoss / valM;
    };

    /**
     * 计算梯度范数（用于检测梯度爆炸）
     */
    const computeGradientNorm = (dw1: number[], dw2: number[]): number => {
      let normSq = 0;
      for (let j = 0; j < N; j++) {
        normSq += dw1[j] * dw1[j] + dw2[j] * dw2[j];
      }
      return Math.sqrt(normSq);
    };

    /**
     * 获取解决方案提示
     */
    const getSolutionTips = (faultType: FaultType): string[] => {
      switch (faultType) {
        case 'gradient-explosion':
          return [
            '降低学习率（如从 0.5 降到 0.1）',
            '启用梯度裁剪，限制参数更新步长',
            '使用更小的初始化权重',
            '尝试 Adam 或 RMSprop 等自适应优化器'
          ];
        case 'gradient-vanishing':
          return [
            '使用 ReLU 激活函数替代 Sigmoid',
            '提高学习率（如从 0.01 升到 0.1）',
            '使用 He 初始化替代默认初始化',
            '减少网络深度，避免层数过多'
          ];
        case 'overfitting':
          return [
            '使用正则化（L1/L2 惩罚）',
            '减少神经元数量（降低模型容量）',
            '使用早停（Early Stopping）',
            '增加训练数据量或使用数据增强'
          ];
        case 'data-poisoning':
          return [
            '数据清洗：检测并移除极端离群点',
            '使用鲁棒损失函数（如 Huber Loss）',
            '对数据进行标准化/归一化',
            '使用异常检测预处理'
          ];
        default:
          return [];
      }
    };

    const trainBatch = () => {
      if (stopRef.current) return;

      let batchLoss = 0;
      let exploded = false;
      let gradientNorm = 0;

      for (let step = 0; step < batchSize && currentEpoch < epochs; step++) {
        let totalLoss = 0;

        const dw1 = new Array(N).fill(0);
        const db1 = new Array(N).fill(0);
        const dw2 = new Array(N).fill(0);
        let db2 = 0;

        // Forward pass
        for (let i = 0; i < m; i++) {
          const x = X[i];
          const y = Y[i];

          const a1 = new Array(N);
          for (let j = 0; j < N; j++) {
            a1[j] = activation(x * w1[j] + b1[j], activationType);
          }

          let y_pred = b2;
          for (let j = 0; j < N; j++) {
            y_pred += a1[j] * w2[j];
          }

          totalLoss += 0.5 * Math.pow(y_pred - y, 2);

          // Backward pass
          const dy_pred = y_pred - y;
          db2 += dy_pred;

          for (let j = 0; j < N; j++) {
            dw2[j] += dy_pred * a1[j];
            const da1 = dy_pred * w2[j];
            const dz1 = activationDerivative(x * w1[j] + b1[j], activationType) * da1;
            dw1[j] += dz1 * x;
            db1[j] += dz1;
          }
        }

        totalLoss /= m;
        batchLoss = totalLoss;

        // 计算当前批次的梯度范数（用于检测梯度爆炸）
        gradientNorm = computeGradientNorm(dw1, dw2);

        // 检测梯度爆炸
        // 条件1: Loss 变成 NaN/Inf（这是真正的数值溢出）
        // 条件2: 梯度范数过大（> 500）表明即将爆炸
        // 注意：阈值从 50 提高到 500，因为训练初期梯度范数可能较大
        //       同时要求至少 5 个 batch 后才检测，避免误判
        if (isNaN(totalLoss) || !isFinite(totalLoss)) {
          exploded = true;
          break;
        }
        if (gradientNorm > 500 && currentEpoch > 5) {
          exploded = true;
          break;
        }

        // 更新权重
        for (let j = 0; j < N; j++) {
          let grad_w2 = (lr * dw2[j]) / m;
          let grad_w1 = (lr * dw1[j]) / m;
          let grad_b1 = (lr * db1[j]) / m;

          if (useClipping) {
            grad_w2 = clipGradient(grad_w2);
            grad_w1 = clipGradient(grad_w1);
            grad_b1 = clipGradient(grad_b1);
          }

          w2[j] -= grad_w2;
          w1[j] -= grad_w1;
          b1[j] -= grad_b1;
        }

        let grad_b2 = (lr * db2) / m;
        if (useClipping) grad_b2 = clipGradient(grad_b2);
        b2 -= grad_b2;

        currentEpoch++;
      }

      // 计算验证集 Loss
      const valLoss = computeValidationLoss();
      validationLossHistory.push(valLoss);

      // 检测梯度消失
      // 只有当 loss 已经很低（< 5）且变化非常小时才认为是梯度消失
      // 正常训练过程中（loss > 10）不应该触发此检测
      let vanished = false;
      const prevLoss = lossHistory[lossHistory.length - 1];
      if (!exploded && prevLoss !== undefined && batchLoss < 5) {
        const lossDelta = Math.abs(prevLoss - batchLoss);
        // 只有当 loss 已经很低（< 5）且变化非常小时才认为是梯度消失
        // 这避免了正常训练过程中的误判
        if (lossDelta < 0.0001 && currentEpoch > 100) {
          vanished = true;
        }
      }

      // 检测过拟合
      let overfitting = false;
      if (validationDataset && validationLossHistory.length >= 20) {
        // 比较最近5个epoch的训练Loss和验证Loss趋势
        const recentTrainLoss = lossHistory.slice(-5);
        const recentValLoss = validationLossHistory.slice(-5);

        const trainLossDecreasing = recentTrainLoss.every((v, i) => i === 0 || v < recentTrainLoss[i - 1] - 0.01);
        const valLossIncreasing = recentValLoss.some((v, i) => i > 0 && v > recentValLoss[i - 1] + 0.1);

        // 如果训练Loss持续下降，但验证Loss开始上升或停滞不前，这是过拟合的信号
        if (trainLossDecreasing && valLossIncreasing && currentEpoch > 100) {
          overfitting = true;
        }

        // 如果验证Loss是训练Loss的3倍以上，且训练继续改善
        if (valLoss > batchLoss * 3 && batchLoss < recentTrainLoss[0] * 0.9) {
          overfitting = true;
        }
      }

      lossHistory.push(batchLoss);

      // 生成拟合曲线
      const curvePoints: DataPoint[] = [];
      const minX = Math.min(...X, ...valX, -15);
      const maxX = Math.max(...X, ...valX, 100);
      const step = (maxX - minX) / 200;

      for (let x = minX; x <= maxX; x += step) {
        let y_pred = b2;
        for (let j = 0; j < N; j++) {
          const a = activation(x * w1[j] + b1[j], activationType);
          y_pred += a * w2[j];
        }
        curvePoints.push({ x, y: y_pred });
      }

      // 判断故障类型
      let faultType: FaultType = null;
      let statusMessage: string | null = null;
      let statusType: TrainingState['statusType'] = null;

      if (exploded) {
        faultType = 'gradient-explosion';
        statusMessage = '⚠️ 梯度爆炸：参数更新步长过大，导致数值溢出';
        statusType = 'error';
      } else if (vanished) {
        faultType = 'gradient-vanishing';
        statusMessage = '⚠️ 梯度消失：梯度太小，模型几乎停止学习';
        statusType = 'warning';
      } else if (overfitting) {
        faultType = 'overfitting';
        statusMessage = '⚠️ 过拟合：训练Loss下降但验证Loss停滞/上升，泛化能力差';
        statusType = 'warning';
      }

      // 收集解决方案提示
      const solutionTips = faultType ? getSolutionTips(faultType) : [];

      const isComplete = currentEpoch >= epochs || exploded || vanished || overfitting;

      setState(prev => ({
        ...prev,
        currentEpoch,
        loss: batchLoss,
        validationLoss: valLoss,
        curvePoints,
        lossHistory: lossHistory.slice(-500),
        validationLossHistory: validationLossHistory.slice(-500),
        isTraining: !isComplete,
        statusMessage,
        statusType,
        faultType: prev.faultType || faultType,
        solutionTips: solutionTips.length > 0 ? solutionTips : prev.solutionTips,
        // 标记故障刚被检测到（用于显示修复确认对话框）
        faultJustDetected: faultType !== null && prev.faultType === null,
      }));

      if (!isComplete && !stopRef.current) {
        reqRef.current = requestAnimationFrame(trainBatch);
      }
    };

    reqRef.current = requestAnimationFrame(trainBatch);

  }, [config, reset]);

  /**
   * 确认已收到故障提示
   * 清除 faultJustDetected 标志
   */
  const acknowledgeFault = useCallback(() => {
    setState(prev => ({
      ...prev,
      faultJustDetected: false,
    }));
  }, []);

  /**
   * 获取推荐修复参数
   */
  const getRecommendedFixForFault = useCallback((faultType: FaultType): RecommendedFix => {
    switch (faultType) {
      case 'gradient-explosion':
        return {
          lr: 0.1,
          initialization: 'xavier',
          useGradientClipping: true,
        };
      case 'gradient-vanishing':
        return {
          lr: 0.1,
          activationType: 'relu',
          initialization: 'random',
        };
      case 'overfitting':
        return {
          hiddenNodes: Math.max(2, Math.floor(config.hiddenNodes / 4)),
        };
      case 'data-poisoning':
        return {
          datasetType: 'standard',
        };
      default:
        return {};
    }
  }, [config.hiddenNodes]);

  return {
    ...state,
    startTraining,
    reset,
    acknowledgeFault,
    getRecommendedFix: getRecommendedFixForFault,
  };
}
