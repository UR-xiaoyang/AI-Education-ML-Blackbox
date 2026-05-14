import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DataPoint,
  DatasetType,
  getDataset
} from '../utils/faultyDataPresets';
import { useFaultyTrainingEngine, TrainingConfig, FaultType, RecommendedFix } from '../hooks/useFaultyTrainingEngine';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { useTrainingInterceptor } from '../hooks/useTrainingInterceptor';
import { faultExperiments, TriggerCondition } from '../store/scenarioConfig';
import { SpotlightOverlay } from './SpotlightOverlay';
import { PedagogySidebar } from './PedagogySidebar';
import { FaultLossChart } from './FaultLossChart';
import { FaultFixConfirmation, RecommendedParams } from './FaultFixConfirmation';
import { FaultComparisonPanel, FixStateRecord } from './FaultComparisonPanel';
import FaultGraphCanvas from './FaultGraphCanvas';

/**
 * 故障严重程度
 */
type FaultSeverity = 'critical' | 'warning' | 'info';

/**
 * 获取故障严重程度
 */
function getFaultSeverity(faultType: FaultType, loss: number | null): FaultSeverity {
  if (faultType === 'gradient-explosion') return 'critical';
  if (faultType === 'data-poisoning') return 'critical';
  if (faultType === 'gradient-vanishing') return 'warning';
  if (faultType === 'overfitting') return 'warning';
  return 'info';
}

/**
 * 故障诊断实验台组件
 */
export const FaultSimulatorUI: React.FC<{
  scenarioEnabled?: boolean;
}> = ({ scenarioEnabled = false }) => {
  const [datasetType, setDatasetType] = useState<DatasetType>('standard');
  const [hiddenNodes, setHiddenNodes] = useState<number>(8);
  const [epochs, setEpochs] = useState<number>(500);
  // 降低默认学习率：从 0.5 改为 0.1，使正常训练更稳定
  const [lr, setLr] = useState<number>(0.1);
  const [activationType, setActivationType] = useState<TrainingConfig['activationType']>('relu');
  const [initialization, setInitialization] = useState<TrainingConfig['initialization']>('random');
  const [useGradientClipping, setUseGradientClipping] = useState<boolean>(false);

  // 用户手动添加的数据点（与预设数据集分开）
  const [userPoints, setUserPoints] = useState<DataPoint[]>([]);

  // 修复确认对话框状态
  const [showFixConfirmation, setShowFixConfirmation] = useState<boolean>(false);
  // 修复历史记录
  const [fixHistory, setFixHistory] = useState<FixStateRecord[]>([]);
  // 已确认的故障类型集合（避免重复弹出对话框）
  const [acknowledgedFaults, setAcknowledgedFaults] = useState<Set<string>>(new Set());
  // 是否是由用户手动点击"查看修复方案"触发的对话框
  const [isManualTrigger, setIsManualTrigger] = useState<boolean>(false);
  // 控制是否允许显示故障修复对话框（使用 ref 避免异步问题）
  const faultDialogAllowedRef = useRef(false);

  // 用于在回调中访问最新的 faultType 和 startTraining
  const faultTypeRef = useRef<FaultType | null>(null);
  const startTrainingRef = useRef<() => void>(() => {});
  // 保存修复前的参数（用于记录）
  const preFixParamsRef = useRef<{
    lr: number;
    initialization: string;
    useGradientClipping: boolean;
    activationType: string;
    hiddenNodes: number;
    loss: number | null;
  } | null>(null);

  const { currentExperiment, currentStepIndex, reportClick, reportValueChange, nextStep } =
    useScenarioEngine(faultExperiments, scenarioEnabled, false);

  // 预设数据集（仅用于训练，不直接显示）
  const presetDataset = useMemo(() => getDataset(datasetType), [datasetType]);

  // 只使用用户添加的点作为显示数据（默认空，用户点击添加）
  const displayDataset = userPoints;

  // 训练时合并预设数据 + 用户点
  const trainingDataset = useMemo(() => [...presetDataset, ...userPoints], [presetDataset, userPoints]);

  // 处理用户添加数据点
  const handleAddPoint = useCallback((point: DataPoint) => {
    setUserPoints(prev => [...prev, point]);
  }, []);

  // 生成验证数据集（使用与训练集相同的分布，但不同的随机种子）
  const validationDataset = useMemo(() => {
    const valData: DataPoint[] = [];

    // 根据数据集类型选择种子
    const seedMap: Record<string, number> = {
      standard: 42,
      noisy: 123,
      outlier: 456,
      poisoned: 789,
      sparse: 111,
      'extreme-gradient-explosion': 999,
      'extreme-gradient-vanish': 888,
      'extreme-overfitting': 777,
    };
    const seed = seedMap[datasetType] ?? 321;

    // 使用固定种子生成可重现的验证数据
    const originalRandom = Math.random;
    let seedValue = seed;
    Math.random = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };

    // 根据数据集类型生成不同的验证数据
    if (datasetType === 'extreme-gradient-vanish') {
      // 梯度消失数据集：极小变化
      const baseY = 10;
      for (let i = 0; i <= 100; i += 2) {
        const noise = (Math.random() - 0.5) * 0.0001;
        valData.push({ x: i, y: baseY + noise });
      }
    } else if (datasetType === 'extreme-overfitting') {
      // 过拟合数据集：完美的线性 + 陷阱点
      for (let i = 0; i <= 10; i += 0.3) {
        const noise = (Math.random() - 0.5) * 0.1;
        valData.push({ x: i, y: 2 * i + 5 + noise });
      }
      // 验证集的陷阱点位置稍有偏移
      valData.push({ x: 0.6, y: 1.0 });
      valData.push({ x: 9.4, y: 18.5 });
    } else {
      // 标准生成逻辑
      for (let i = 0; i <= 10; i += 0.5) {
        const noise = (Math.random() - 0.5) * 2;
        valData.push({ x: i, y: 2 * i + 5 + noise });
      }

      // 添加离群点到验证集
      if (datasetType === 'outlier') {
        valData.push({ x: 90, y: -500 });
      } else if (datasetType === 'poisoned') {
        valData.push({ x: 10, y: -5 });
        valData.push({ x: -10, y: 15 });
      } else if (datasetType === 'extreme-gradient-explosion') {
        // 极端爆炸：添加极端离群点
        valData.push({ x: 50, y: -1000 });
        valData.push({ x: -20, y: 2000 });
        valData.push({ x: 100, y: 5000 });
      }
    }

    Math.random = originalRandom;
    return valData;
  }, [datasetType]);

  const trainingConfig: TrainingConfig = useMemo(() => ({
    hiddenNodes, epochs, lr, dataset: trainingDataset, activationType, initialization, useGradientClipping, validationDataset
  }), [hiddenNodes, epochs, lr, trainingDataset, activationType, initialization, useGradientClipping, validationDataset]);

  const { isTraining, currentEpoch, loss, validationLoss, curvePoints, lossHistory, validationLossHistory, statusMessage, statusType, faultType, solutionTips, faultJustDetected, startTraining, reset, getRecommendedFix, acknowledgeFault } =
    useFaultyTrainingEngine(trainingConfig);

  // 集成训练拦截器用于 AUTO_INTERCEPT 触发条件
  useTrainingInterceptor(currentEpoch, loss ?? 0);

  // 当进入教学模式或切换实验时，确保参数设置为教学模式的默认值
  // 这确保了教学步骤2"正常训练"的参数是正确的
  // 注意：使用 currentExperiment?.id 而不是 currentExperiment 对象本身
  // 以避免因对象引用变化导致的重复重置
  useEffect(() => {
    if (scenarioEnabled && currentExperiment?.id === 'FAULT_EXP_1_GRADIENT_EXPLOSION') {
      // 重置为教学模式的默认参数（用于正常训练演示）
      // 只在首次进入或切换实验时重置，避免学生修改的参数被覆盖
      setDatasetType('standard');
      setHiddenNodes(8);
      setEpochs(500);
      setLr(0.1);  // 降低学习率以保持训练稳定
      setActivationType('relu');
      setInitialization('random');  // 对应 He 初始化（推荐）
      setUseGradientClipping(false);
      // 重置故障配置状态 - 学生在设置故障前不应看到故障对话框
      faultDialogAllowedRef.current = false;
    }
  }, [scenarioEnabled, currentExperiment?.id]);

  // 保持 refs 与状态同步
  faultTypeRef.current = faultType;
  startTrainingRef.current = startTraining;

  // 检测到故障时显示修复确认对话框
  useEffect(() => {
    // 获取当前步骤的触发条件
    const currentStep = currentExperiment?.steps[currentStepIndex];
    const currentTrigger = currentStep?.triggerCondition;

    // 只有当故障是新检测到的（faultJustDetected=true）
    // 且该故障类型尚未被确认过时，才显示对话框
    // 或者当用户手动点击"查看修复方案"时
    // 自习模式(scenarioEnabled=false)不会自动弹出对话框
    // 关键：在 VALUE_CHANGE 步骤中（学生设置故障参数），不自动显示对话框
    //       只有当学生开始配置故障参数后，才允许显示对话框
    const canShowFixDialog = isManualTrigger ||
      (faultJustDetected &&
       faultType &&
       !acknowledgedFaults.has(faultType) &&
       scenarioEnabled &&
       faultDialogAllowedRef.current);

    if (canShowFixDialog) {
      // 保存修复前的参数
      preFixParamsRef.current = {
        lr,
        initialization,
        useGradientClipping,
        activationType,
        hiddenNodes,
        loss
      };
      setShowFixConfirmation(true);
      // 清除故障检测标志
      acknowledgeFault();
      // 清除手动触发标志
      setIsManualTrigger(false);
    }
  }, [faultJustDetected, faultType, lr, initialization, useGradientClipping, activationType, hiddenNodes, loss, acknowledgeFault, acknowledgedFaults, isManualTrigger, scenarioEnabled, currentExperiment, currentStepIndex]);

  // 处理修复确认对话框的确认
  const handleFixConfirm = useCallback(() => {
    const currentFaultType = faultTypeRef.current;
    const preFix = preFixParamsRef.current;

    if (!currentFaultType || !preFix) {
      setShowFixConfirmation(false);
      return;
    }

    // 获取推荐参数
    const recommended = getRecommendedFix(currentFaultType);

    // 应用推荐的修复参数
    if (recommended.lr !== undefined) setLr(recommended.lr);
    if (recommended.initialization !== undefined) setInitialization(recommended.initialization);
    if (recommended.useGradientClipping !== undefined) setUseGradientClipping(recommended.useGradientClipping);
    if (recommended.activationType !== undefined) setActivationType(recommended.activationType);
    if (recommended.hiddenNodes !== undefined) setHiddenNodes(recommended.hiddenNodes);

    // 记录修复历史
    setFixHistory(prev => [...prev, {
      timestamp: Date.now(),
      faultType: currentFaultType,
      before: preFix,
      after: {
        lr: recommended.lr ?? preFix.lr,
        initialization: recommended.initialization ?? preFix.initialization,
        useGradientClipping: recommended.useGradientClipping ?? preFix.useGradientClipping,
        activationType: recommended.activationType ?? preFix.activationType,
        hiddenNodes: recommended.hiddenNodes ?? preFix.hiddenNodes,
        loss: null,
        status: '修复中'
      }
    }]);

    // 将该故障类型添加到已确认集合，避免修复后重复弹出对话框
    setAcknowledgedFaults(prev => new Set([...prev, currentFaultType]));

    setShowFixConfirmation(false);

    // 延迟启动训练，让用户看到参数变化
    setTimeout(() => startTrainingRef.current(), 800);
  }, [getRecommendedFix]);

  // 处理修复确认对话框的取消
  const handleFixCancel = useCallback(() => {
    setShowFixConfirmation(false);
    // 清除修复前参数
    preFixParamsRef.current = null;
  }, []);

  // 处理参数值变化的辅助函数
  // 当学生在设置故障参数时修改参数时，允许显示故障修复对话框
  // 这确保只有在学生主动设置故障参数后，才会显示故障修复对话框
  const handleParamChange = useCallback((targetId: string, newValue: any) => {
    // 检查当前步骤是否需要参数配置
    const currentStep = currentExperiment?.steps[currentStepIndex];

    // 允许故障对话框的条件：
    // 1. 当前步骤是 VALUE_CHANGE 触发（专门用于参数配置）
    // 2. 或者当前步骤是故障设置步骤（学生需要手动调整参数）
    const isValueChangeStep = currentStep?.triggerCondition === TriggerCondition.VALUE_CHANGE;
    const isFaultSetupStep = currentStep?.id === 'exp1_step4_create_fault' ||
                             currentStep?.id === 'exp2_step4_create_fault';

    if (scenarioEnabled && (isValueChangeStep || isFaultSetupStep)) {
      faultDialogAllowedRef.current = true;  // 使用 ref 避免异步问题
    }
    // 调用原有的 reportValueChange
    reportValueChange(targetId, newValue);
  }, [currentExperiment, currentStepIndex, scenarioEnabled, reportValueChange]);

  // 手动应用推荐的修复方案（不显示确认对话框）
  const applyRecommendedFix = useCallback(() => {
    const currentFaultType = faultTypeRef.current;
    if (!currentFaultType) return;

    // 获取推荐参数
    const recommended = getRecommendedFix(currentFaultType);

    // 应用推荐的修复参数
    if (recommended.lr !== undefined) setLr(recommended.lr);
    if (recommended.initialization !== undefined) setInitialization(recommended.initialization);
    if (recommended.useGradientClipping !== undefined) setUseGradientClipping(recommended.useGradientClipping);
    if (recommended.activationType !== undefined) setActivationType(recommended.activationType);
    if (recommended.hiddenNodes !== undefined) setHiddenNodes(recommended.hiddenNodes);

    // 报告点击事件，用于课程引导
    reportClick('fault-btn-apply-fix');

    // 延迟启动训练
    setTimeout(() => startTrainingRef.current(), 300);
  }, [getRecommendedFix, reportClick]);

  const datasetOptions = [
    // 正常数据集
    { value: 'standard', label: '📈 标准数据' },
    { value: 'noisy', label: '📊 噪音数据' },
    { value: 'sparse', label: '📉 稀疏数据' },
    // 故障诱发数据集
    { value: 'outlier', label: '⚠️ 离群点 (易爆炸)' },
    { value: 'poisoned', label: '☠️ 污染数据 (易爆炸)' },
    { value: 'extreme-gradient-explosion', label: '💥 极端爆炸 (必炸)' },
    { value: 'extreme-gradient-vanish', label: '📉 极端消失 (易消失)' },
    { value: 'extreme-overfitting', label: '🎯 过拟合陷阱' },
  ];

  return (
    <div id="fault-simulator" className="nn-lab-layout">
      {/* 左栏：拟合曲线可视化 + Loss 图表 */}
      <div className="nn-lab-canvas-section">
        <div className="glass-panel" style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>📊 拟合曲线可视化</h3>
          <FaultGraphCanvas
            curvePoints={curvePoints}
            dataset={displayDataset}
            statusType={statusType}
            faultType={faultType}
            onAddPoint={handleAddPoint}
          />
          {statusMessage && (
            <div style={{
              marginTop: '8px', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem',
              background: statusType === 'error' ? 'rgba(255,77,79,0.2)' : 'rgba(255,152,0,0.2)',
              border: `1px solid ${statusType === 'error' ? 'rgba(255,77,79,0.5)' : 'rgba(255,152,0,0.5)'}`,
              color: statusType === 'error' ? '#ff4d4f' : '#ff9800'
            }}>
              {statusMessage}
            </div>
          )}
        </div>
        {/* Loss 图表 */}
        <div id="fault-loss-chart-container">
          <FaultLossChart
            lossHistory={lossHistory}
            validationLossHistory={validationLossHistory}
            faultType={faultType}
            currentEpoch={currentEpoch}
            totalEpochs={epochs}
          />
        </div>
      </div>

      {/* 右栏：控制面板 + 当前状态 + 修复历史 */}
      <div className="nn-lab-right-section">
        {/* 当前状态 */}
        <div className="glass-panel" style={{ padding: '12px', marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--accent-purple)' }}>🔍 当前状态</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
            <div>训练轮次</div><div style={{ fontWeight: 'bold' }}>{currentEpoch} / {epochs}</div>
            <div>当前 Loss</div>
            <div style={{ fontWeight: 'bold', color: loss === null ? 'inherit' : Number.isNaN(loss) ? '#ff4d4f' : '#4dabf7' }}>
              {loss === null ? '-' : (Number.isNaN(loss) ? 'NaN' : loss.toFixed(4))}
            </div>
            <div>模型状态</div>
            <div style={{ fontWeight: 'bold', color: isTraining ? '#4caf50' : 'inherit' }}>
              {isTraining ? '🔄 训练中' : '⏹️ 已停止'}
            </div>
          </div>
          {faultType && (
            <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,77,79,0.1)', borderRadius: '6px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>⚠️ 检测到故障</span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  background: getFaultSeverity(faultType, loss) === 'critical' ? '#ff4d4f' :
                              getFaultSeverity(faultType, loss) === 'warning' ? '#ff9800' : '#4caf50',
                  color: '#fff'
                }}>
                  {getFaultSeverity(faultType, loss) === 'critical' ? '严重' :
                   getFaultSeverity(faultType, loss) === 'warning' ? '警告' : '提示'}
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                {faultType === 'gradient-explosion' && '梯度爆炸'}
                {faultType === 'gradient-vanishing' && '梯度消失'}
                {faultType === 'overfitting' && '过拟合'}
                {faultType === 'data-poisoning' && '数据污染'}
                {faultType === 'local-minima' && '局部最小值'}
                {faultType === 'bad-initialization' && '不良初始化'}
              </div>
              {solutionTips.length > 0 && (
                <div style={{ marginTop: '6px', padding: '6px', background: 'rgba(76,175,80,0.1)', borderRadius: '4px' }}>
                  <div style={{ color: '#4caf50', fontWeight: 'bold', marginBottom: '4px' }}>💡 解决方案</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: 'rgba(255,255,255,0.8)', fontSize: '0.7rem' }}>
                    {solutionTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                  <button
                    id="fault-btn-apply-fix"
                    onClick={() => {
                      applyRecommendedFix();
                    }}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      padding: '6px 8px',
                      background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    🔧 应用修复方案
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 控制面板 */}
        <div className="glass-panel" style={{ padding: '12px', flex: 1 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--accent-green)' }}>⚙️ 控制面板</h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>学习率 (LR): <span style={{ color: '#4dabf7' }}>{lr}</span></label>
            <input id="fault-lr-slider" type="range" min="0.0001" max="2.0" step="0.0001" value={lr} onChange={e => { setLr(Number(e.target.value)); handleParamChange('fault-lr-slider', Number(e.target.value)); }} disabled={isTraining} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>隐藏层节点: <span style={{ color: '#4dabf7' }}>{hiddenNodes}</span></label>
            <input id="fault-hidden-nodes-slider" type="range" min="1" max="20" value={hiddenNodes} onChange={e => { setHiddenNodes(Number(e.target.value)); handleParamChange('fault-hidden-nodes-slider', Number(e.target.value)); }} disabled={isTraining} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>训练轮数: <span style={{ color: '#4dabf7' }}>{epochs}</span></label>
            <input id="fault-epochs-slider" type="range" min="10" max="2000" step="10" value={epochs} onChange={e => { setEpochs(Number(e.target.value)); handleParamChange('fault-epochs-slider', Number(e.target.value)); }} disabled={isTraining} style={{ width: '100%' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>激活函数</label>
            <select value={activationType} onChange={e => setActivationType(e.target.value as TrainingConfig['activationType'])} disabled={isTraining} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}>
              <option value="relu">ReLU (推荐)</option>
              <option value="sigmoid">Sigmoid (易梯度消失)</option>
              <option value="tanh">Tanh</option>
              <option value="leakyrelu">Leaky ReLU</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>权重初始化</label>
            <select value={initialization} onChange={e => setInitialization(e.target.value as TrainingConfig['initialization'])} disabled={isTraining} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}>
              <option value="random">He初始化 (推荐)</option>
              <option value="xavier">Xavier初始化</option>
              <option value="large">大权重 (易爆炸)</option>
              <option value="tiny">小权重 (易消失)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" id="fault-gradient-clipping" checked={useGradientClipping} onChange={e => setUseGradientClipping(e.target.checked)} disabled={isTraining} />
            <label htmlFor="fault-gradient-clipping" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>梯度裁剪</label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button id="fault-btn-train" onClick={() => { startTraining(); reportClick('fault-btn-train'); }} disabled={isTraining} className="btn btn-primary" style={{ flex: 2, padding: '10px', fontWeight: 'bold' }}>
              {isTraining ? '🔄 训练中...' : '▶️ 开始训练'}
            </button>
            <button id="fault-btn-reset" onClick={() => { reset(); reportClick('fault-btn-reset'); }} className="btn" style={{ flex: 1, padding: '10px' }}>🔄 重置</button>
          </div>
        </div>

        {/* 修复历史对比面板 */}
        {fixHistory.length > 0 && (
          <FaultComparisonPanel
            fixHistory={fixHistory}
            currentState={{
              lr,
              initialization,
              useGradientClipping,
              activationType,
              hiddenNodes,
              loss
            }}
            faultType={faultType}
          />
        )}
      </div>

      {/* 教学模式显示引导组件 */}
      {scenarioEnabled && (
        <>
          <SpotlightOverlay onNextStep={nextStep} />
          <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 10003 }}>
            <PedagogySidebar currentExperiment={currentExperiment} currentStepIndex={currentStepIndex} labId="FAULT" />
          </div>
        </>
      )}

      {/* 修复确认对话框 */}
      {showFixConfirmation && faultType && (
        <FaultFixConfirmation
          faultType={faultType}
          currentParams={{
            lr,
            initialization,
            useGradientClipping,
            activationType,
            hiddenNodes,
            datasetType
          }}
          recommendedParams={getRecommendedFix(faultType) as RecommendedParams}
          onConfirm={handleFixConfirm}
          onCancel={handleFixCancel}
          onManualFix={() => {
            setShowFixConfirmation(false);
            acknowledgeFault();
          }}
        />
      )}
    </div>
  );
};

export default FaultSimulatorUI;
