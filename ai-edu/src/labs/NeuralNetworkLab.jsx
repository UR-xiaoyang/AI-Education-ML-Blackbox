import React, { useMemo, useState, useEffect, useRef } from 'react';
import NNGraphCanvas from '../components/NNGraphCanvas';
import NNControlPanel from '../components/NNControlPanel';
import NNFlowViz from '../components/NNFlowViz';
import LossChart from '../components/LossChart';
import LearningCompanion from '../components/LearningCompanion';
import NN3DVisualizer from '../components/NN3DVisualizer';
import useAchievementStore from '../store/achievementStore';
import { initNNModel, computeNNLoss, nnTrainStep } from '../utils/nnEngine';
import { usePedagogyStore } from '../store/pedagogyStore';
import { useTrainingInterceptor } from '../hooks/useTrainingInterceptor';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { nnExperiments } from '../store/scenarioConfig';

const generateDataset = (type) => {
  const points = [];
  const N = 50;

  if (type === 'circle') {
    // 内圈：类别 0，中心 (0.5, 0.5)，小半径
    for (let i = 0; i < N; i += 1) {
      const r = Math.random() * 0.2;
      const theta = Math.random() * 2 * Math.PI;
      points.push({ x: 0.5 + r * Math.cos(theta), y: 0.5 + r * Math.sin(theta), label: 0 });
    }
    // 外圈：类别 1，同心圆环，内半径 0.4，外半径 0.45
    for (let i = 0; i < N * 1.5; i += 1) {
      const r = 0.4 + Math.random() * 0.05;
      const theta = Math.random() * 2 * Math.PI;
      points.push({ x: 0.5 + r * Math.cos(theta), y: 0.5 + r * Math.sin(theta), label: 1 });
    }
  } else if (type === 'xor') {
    // XOR 数据集：四个象限，对角同类
    // 左下象限：类别 0
    for (let i = 0; i < N / 2; i += 1) {
      const x = Math.random() * 0.35;
      const y = Math.random() * 0.35;
      points.push({ x, y, label: 0 });
    }
    // 右上象限：类别 0
    for (let i = 0; i < N / 2; i += 1) {
      const x = 0.65 + Math.random() * 0.35;
      const y = 0.65 + Math.random() * 0.35;
      points.push({ x, y, label: 0 });
    }
    // 左上象限：类别 1
    for (let i = 0; i < N / 2; i += 1) {
      const x = Math.random() * 0.35;
      const y = 0.65 + Math.random() * 0.35;
      points.push({ x, y, label: 1 });
    }
    // 右下象限：类别 1
    for (let i = 0; i < N / 2; i += 1) {
      const x = 0.65 + Math.random() * 0.35;
      const y = Math.random() * 0.35;
      points.push({ x, y, label: 1 });
    }
  } else if (type === 'moons') {
    // 上半月牙：类别 0
    for (let i = 0; i < N; i += 1) {
      const t = Math.PI * (i / N);
      const x = 0.5 + 0.3 * Math.cos(t) + (Math.random() - 0.5) * 0.05;
      const y = 0.5 + 0.3 * Math.sin(t) + (Math.random() - 0.5) * 0.05;
      points.push({ x, y, label: 0 });
    }
    // 下半月牙：类别 1，与上半月分离
    for (let i = 0; i < N; i += 1) {
      const t = Math.PI * (i / N);
      const x = 0.5 - 0.3 * Math.cos(t) + (Math.random() - 0.5) * 0.05;
      const y = 0.5 - 0.3 * Math.sin(t) - 0.25 + (Math.random() - 0.5) * 0.05;
      points.push({ x, y, label: 1 });
    }
  } else if (type === 'poisoned') {
    // 左下角：类别 0
    for (let i = 0; i < N; i += 1) {
      points.push({ x: 0.15 + Math.random() * 0.2, y: 0.15 + Math.random() * 0.2, label: 0 });
    }
    // 右上角：类别 1
    for (let i = 0; i < N; i += 1) {
      points.push({ x: 0.65 + Math.random() * 0.2, y: 0.65 + Math.random() * 0.2, label: 1 });
    }
    // 异常值：诱发梯度爆炸
    points.push({ x: 10.0, y: -5.0, label: 0 });
    points.push({ x: -10.0, y: 15.0, label: 1 });
  } else if (type === 'linear') {
    // 线性可分数据集（基础演示用）
    // 类别 0：左下区域
    for (let i = 0; i < N; i += 1) {
      points.push({ x: Math.random() * 0.4, y: Math.random() * 0.4, label: 0 });
    }
    // 类别 1：右上区域
    for (let i = 0; i < N; i += 1) {
      points.push({ x: 0.6 + Math.random() * 0.4, y: 0.6 + Math.random() * 0.4, label: 1 });
    }
  }

  return points;
};

export default function NeuralNetworkLab({ scenarioEnabled = false }) {
  const [points, setPoints] = useState([]);
  const [testPoints, setTestPoints] = useState([]);
  const [mode, setMode] = useState('TRAIN');
  const [hiddenNodes, setHiddenNodes] = useState(8);
  const [model, setModel] = useState(() => initNNModel(8));
  const [learningRate, setLearningRate] = useState(0.1);
  const [lossHistory, setLossHistory] = useState([]);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [epochCount, setEpochCount] = useState(0);
  const [show3DView, setShow3DView] = useState(false); // 3D 可视化开关

  // 成就系统
  const { achievements, unlockAchievement } = useAchievementStore();
  const [achievementPopups, setAchievementPopups] = useState([]); // 成就弹窗队列
  const [hasGeneratedData, setHasGeneratedData] = useState(false); // 追踪是否生成过数据

  // 成就触发函数
  const triggerAchievement = (achievementId, name, icon, xpReward) => {
    if (achievements.includes(achievementId)) return;
    const popup = { id: Date.now(), achievementId, name, icon, xp: xpReward };
    setAchievementPopups(prev => [...prev, popup]);
    unlockAchievement(achievementId);
    setTimeout(() => {
      setAchievementPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 3500);
  };

  // NN 实验室成就监测
  useEffect(() => {
    if (scenarioEnabled) return;
    
    // NN_EXPLORER: 进入 NN 实验室
    if (!achievements.includes('NN_EXPLORER')) {
      triggerAchievement('NN_EXPLORER', '神经网络探索者', '🧠', 30);
    }
    
    // CIRCLE_DATA: 生成同心圆数据
    if (hasGeneratedData && !achievements.includes('CIRCLE_DATA')) {
      triggerAchievement('CIRCLE_DATA', '同心圆专家', '⭕', 20);
    }
    
    // XOR_CHALLENGE: XOR 数据集
    if (points.length > 0 && !achievements.includes('XOR_CHALLENGE')) {
      // XOR 数据特征是4个象限都有点
      const xVals = points.map(p => p.x);
      const hasLowHigh = xVals.some(x => x < 0.4) && xVals.some(x => x > 0.6);
      if (hasLowHigh && points.length >= 50) {
        triggerAchievement('XOR_CHALLENGE', '异或挑战者', '❌', 40);
      }
    }
    
    // DEEP_LEARNING: 开始深度学习训练
    if (lossHistory.length === 1 && !achievements.includes('DEEP_LEARNING')) {
      triggerAchievement('DEEP_LEARNING', '深度学习入门', '🔥', 30);
    }
    
    // NN_LOW_LOSS: NN Loss < 0.15
    if (model) {
      const useReluInEffect = usePedagogyStore.getState().useRelu;
      const loss = computeNNLoss(points, model, useReluInEffect);
      if (loss < 0.15 && loss > 0 && !achievements.includes('NN_LOW_LOSS')) {
        triggerAchievement('NN_LOW_LOSS', '神经网络大师', '🏆', 50);
      }
    }
    
    // 3D_VIEW: 打开 3D 视角
    if (show3DView && !achievements.includes('3D_VIEW')) {
      triggerAchievement('3D_VIEW', '立体思维', '🔮', 25);
    }
  }, [scenarioEnabled, hasGeneratedData, points.length, lossHistory.length, model, show3DView]);

  const isSimulationPaused = usePedagogyStore((state) => state.isSimulationPaused);
  const activeSetupAction = usePedagogyStore((state) => state.activeSetupAction);
  const reflectionModeActive = usePedagogyStore((state) => state.reflectionModeActive);
  const completionChoiceMode = usePedagogyStore((state) => state.completionChoiceMode);
  const useRelu = usePedagogyStore((state) => state.useRelu);
  const resumeSimulation = usePedagogyStore((state) => state.resumeSimulation);
  const setInterceptorRule = usePedagogyStore((state) => state.setInterceptorRule);
  const { reportClick } = useScenarioEngine(nnExperiments, scenarioEnabled);

  // 进入实验室时重置所有状态
  useEffect(() => {
    // 清除之前的 activeSetupAction，确保干净的状态
    usePedagogyStore.getState().setSetupAction(null);
    // 启用 ReLU 激活函数，使网络能够学习非线性模式
    usePedagogyStore.getState().setUseRelu(true);
    // 清掉上一个实验遗留的暂停/拦截状态，避免训练循环空转
    setInterceptorRule(null);
    resumeSimulation();

    setPoints([]);
    setTestPoints([]);
    setMode('TRAIN');
    setHiddenNodes(8);
    setModel(initNNModel(8));
    setLearningRate(0.1);
    setLossHistory([]);
    setIsAutoTraining(false);
    setEpochCount(0);
  }, [resumeSimulation, setInterceptorRule]); // 只在组件挂载时执行一次

  useEffect(() => {
    if (activeSetupAction === 'preset_data_circle') {
      handleGenerateData('circle');
    } else if (activeSetupAction === 'preset_data_moons') {
      handleGenerateData('moons');
    } else if (activeSetupAction === 'preset_data_xor') {
      handleGenerateData('xor');
    } else if (activeSetupAction === 'preset_data_poisoned') {
      handleGenerateData('poisoned');
    }
  }, [activeSetupAction]);

  useEffect(() => {
    setModel(initNNModel(hiddenNodes));
    setLossHistory([]);
    setEpochCount(0);
  }, [hiddenNodes]);

  useEffect(() => {
    // 进入反思问答或章节完成弹窗时，必须真正停止自动训练，
    // 否则后续恢复 simulation 后会继续沿用旧的自动训练状态。
    if (scenarioEnabled && (reflectionModeActive || completionChoiceMode)) {
      setIsAutoTraining(false);
    }
  }, [scenarioEnabled, reflectionModeActive, completionChoiceMode]);

  // 提取模型权重以便用于收敛检测
  const modelWeights = useMemo(() => {
    if (!model) return null;
    const flatWeights = [];
    // 展平 W1, b1, W2, b2
    model.W1.forEach(row => row.forEach(w => flatWeights.push(w)));
    model.b1.forEach(w => flatWeights.push(w));
    model.W2.forEach(row => row.forEach(w => flatWeights.push(w)));
    flatWeights.push(model.b2[0]);
    return { weights: flatWeights };
  }, [model]);

  const currentLoss = computeNNLoss(points, model, useRelu);
  const datasetSummary = useMemo(() => {
    const label0Count = points.filter((point) => point.label === 0).length;
    const label1Count = points.filter((point) => point.label === 1).length;
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);

    return {
      total: points.length,
      label0Count,
      label1Count,
      xRange: xValues.length ? [Math.min(...xValues), Math.max(...xValues)] : null,
      yRange: yValues.length ? [Math.min(...yValues), Math.max(...yValues)] : null,
      recentPoints: points.slice(-6).reverse()
    };
  }, [points]);

  useTrainingInterceptor(epochCount, currentLoss, modelWeights);

  // 检查模型是否包含 NaN
  const modelHasNaN = (model) => {
    if (!model) return false;
    const check = (arr) => Array.isArray(arr) ? arr.some(check) : isNaN(arr);
    return check(model.W1) || check(model.b1) || check(model.W2) || check(model.b2);
  };

  const reqRef = useRef();
  const stateRef = useRef({
    points,
    model,
    learningRate,
    isAutoTraining,
    isSimulationPaused: scenarioEnabled ? isSimulationPaused : false,
    epochCount,
    useRelu
  });

  useEffect(() => {
    stateRef.current = {
      points,
      model,
      learningRate,
      isAutoTraining,
      isSimulationPaused: scenarioEnabled ? isSimulationPaused : false,
      epochCount,
      useRelu
    };
  }, [points, model, learningRate, isAutoTraining, isSimulationPaused, epochCount, scenarioEnabled, useRelu]);

  const handleAddPoint = (point) => {
    if (mode === 'TRAIN') {
      setPoints((prev) => [...prev, point]);
      return;
    }
    setTestPoints((prev) => [...prev, point]);
  };

  const handleTrainStep = () => {
    if (points.length === 0) return;
    const nextModel = nnTrainStep(points, model, learningRate, useRelu);
    setModel(nextModel);
    const newLoss = computeNNLoss(points, nextModel, useRelu);
    setLossHistory((prev) => [...prev.slice(-100), newLoss]);
  };

  const handleAutoTrainToggle = () => {
    // 如果没有数据，自动生成同心圆数据集并立即开始训练
    if (points.length === 0) {
      setPoints(generateDataset('circle'));
      setIsAutoTraining(true);
      return;
    }

    const types = new Set(points.map((p) => p.label));
    if (types.size < 2) {
      alert('请确认画面上有两种类别的数据。');
      return;
    }

    setIsAutoTraining((prev) => !prev);
  };

  const handleReset = () => {
    setPoints([]);
    setTestPoints([]);
    setLossHistory([]);
    setIsAutoTraining(false);
    setModel(initNNModel(hiddenNodes));
  };

  const handleClearTest = () => {
    setTestPoints([]);
  };

  const handleGenerateData = (type) => {
    setIsAutoTraining(false);
    setLossHistory([]);
    setTestPoints([]);
    setModel(initNNModel(hiddenNodes));
    setPoints(generateDataset(type));
    setHasGeneratedData(true);
  };

  useEffect(() => {
    if (!isAutoTraining) return undefined;

    let lastTime = performance.now();
    let localEpochCounter = stateRef.current.epochCount;

    const loop = (time) => {
      const {
        points: currentPoints,
        model: currentModel,
        learningRate: currentLearningRate,
        isSimulationPaused: paused,
        useRelu
      } = stateRef.current;

      if (paused) {
        reqRef.current = requestAnimationFrame(loop);
        return;
      }

      if (currentPoints.length > 0) {
        let nextModel = currentModel;
        let hasNaN = false;

        for (let step = 0; step < 5; step += 1) {
          nextModel = nnTrainStep(currentPoints, nextModel, currentLearningRate, useRelu);
          // 检测模型是否出现 NaN
          if (modelHasNaN(nextModel)) {
            hasNaN = true;
            break;
          }
        }

        // 如果模型出现 NaN，停止训练并显示警告
        if (hasNaN) {
          setIsAutoTraining(false);
          setModel(initNNModel(hiddenNodes)); // 重置模型
          setLossHistory(prev => [...prev.slice(-149), Infinity]); // 添加一个标记点
          return;
        }

        setModel(nextModel);
        localEpochCounter += 5;
        stateRef.current.epochCount = localEpochCounter;

        if (time - lastTime > 50) {
          const nextLoss = computeNNLoss(currentPoints, nextModel, useRelu);
          // 如果 loss 变成 NaN，停止训练
          if (isNaN(nextLoss)) {
            setIsAutoTraining(false);
            setLossHistory(prev => [...prev.slice(-149), Infinity]);
            return;
          }
          setLossHistory((prev) => [...prev.slice(-150), nextLoss]);
          setEpochCount(localEpochCounter);
          lastTime = time;
        }
      }

      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isAutoTraining, points.length]);

  let stepTitle = '1 第一阶段：非线性大考';
  let stepDesc = '线性模型只能切出一条直线。如果两类数据按同心圆排布，直线再努力也分不开。试着点击右侧的预设数据开始观察。';

  if (mode === 'INFERENCE') {
    stepTitle = '🔍 开始推理';
    stepDesc = '现在你可以在画布中放置测试点，观察模型如何根据学到的边界进行分类。';
  } else if (points.length > 3 && lossHistory.length === 0 && hiddenNodes <= 3) {
    stepTitle = '2 空间折叠初体验';
    stepDesc = '当前隐藏层容量较小。先训练看看，它通常只能形成比较粗糙的决策边界。';
  } else if (points.length > 3 && lossHistory.length === 0 && hiddenNodes > 3) {
    stepTitle = '3 更强的模型容量';
    stepDesc = '你加入了更多神经元。训练后再观察边界，会更容易看到更复杂的非线性拟合。';
  } else if (lossHistory.length > 0 && currentLoss > 0.15) {
    stepTitle = '🔥 反向传播进行中';
    stepDesc = '损失还比较高，边界正在持续调整。留意背景决策面是如何逐渐变形的。';
  } else if (lossHistory.length > 0 && currentLoss <= 0.15) {
    stepTitle = '🏁 拟合开始成形';
    stepDesc = 'Loss 已经明显下降。此时切到推理模式，在边界附近多放几个点，看看泛化效果。';
  }

  return (
    <div className="nn-lab-layout">
      {/* 左栏：可视化画布 + Loss实时曲线 */}
      <div className="nn-lab-canvas-section">
        <NNGraphCanvas
          points={points}
          testPoints={testPoints}
          model={model}
          onAddPoint={handleAddPoint}
        />
        <LossChart lossHistory={lossHistory} />
      </div>

      {/* 中栏：神经元传播演示、数据集统计 */}
      <div className="nn-lab-right-section">
        <NNFlowViz
          model={model}
          points={points}
          testPoints={testPoints}
          epochCount={epochCount}
          isAutoTraining={isAutoTraining}
          mode={mode}
        />

        <div className="glass-panel nn-dataset-panel" style={{ padding: '12px', gap: '10px' }}>
          <div className="nn-dataset-header">
            <div>
              <h3>数据集统计</h3>
            </div>
            <div className="nn-network-badge">{datasetSummary.total} 个样本</div>
          </div>

          <div className="nn-dataset-stats">
            <div className="nn-dataset-stat is-orange">
              <span>类别 0</span>
              <strong>{datasetSummary.label0Count}</strong>
            </div>
            <div className="nn-dataset-stat is-blue">
              <span>类别 1</span>
              <strong>{datasetSummary.label1Count}</strong>
            </div>
            <div className="nn-dataset-stat">
              <span>X 范围</span>
              <strong>
                {datasetSummary.xRange
                  ? `${datasetSummary.xRange[0].toFixed(2)} - ${datasetSummary.xRange[1].toFixed(2)}`
                  : '--'}
              </strong>
            </div>
            <div className="nn-dataset-stat">
              <span>Y 范围</span>
              <strong>
                {datasetSummary.yRange
                  ? `${datasetSummary.yRange[0].toFixed(2)} - ${datasetSummary.yRange[1].toFixed(2)}`
                  : '--'}
              </strong>
            </div>
          </div>

          <div id="data-presets-panel" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>预设数据集</div>
            <div id="nn-preset-buttons" className="nn-preset-buttons">
              <button className="btn" onClick={() => { handleGenerateData('linear'); reportClick('nn-preset-buttons'); }}>线性可分</button>
              <button className="btn" onClick={() => { handleGenerateData('circle'); reportClick('nn-preset-buttons'); }}>同心圆</button>
              <button className="btn" onClick={() => { handleGenerateData('xor'); reportClick('nn-preset-buttons'); }}>异或</button>
              <button className="btn" onClick={() => { handleGenerateData('moons'); reportClick('nn-preset-buttons'); }}>双月牙</button>
            </div>
          </div>
        </div>
      </div>

      {/* 右栏：深度学习初步 (MLP) */}
      <div className="nn-lab-control-section">
        <NNControlPanel
          mode={mode}
          setMode={setMode}
          onClearTest={handleClearTest}
          model={model}
          loss={currentLoss}
          stepTitle={stepTitle}
          stepDesc={stepDesc}
          onTrainStep={handleTrainStep}
          onAutoTrain={handleAutoTrainToggle}
          isAutoTraining={isAutoTraining}
          onReset={handleReset}
          learningRate={learningRate}
          setLearningRate={setLearningRate}
          onGenerateData={handleGenerateData}
          hiddenNodes={hiddenNodes}
          setHiddenNodes={setHiddenNodes}
          datasetLength={points.length}
          scenarioEnabled={scenarioEnabled}
        />
      </div>

      {/* 学习伴侣 - 仅在非引导模式下显示 */}
      {!scenarioEnabled && (
        <LearningCompanion
          pointsCount={points.length}
          lossHistoryLength={lossHistory.length}
          currentLoss={currentLoss}
          isTraining={isAutoTraining}
          mode={mode}
          labType="NN"
        />
      )}

      {/* 3D 可视化切换按钮 */}
      {!scenarioEnabled && points.length > 0 && (
        <button
          onClick={() => setShow3DView(prev => !prev)}
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '24px',
            padding: '12px 20px',
            background: show3DView 
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
              : 'rgba(30, 30, 50, 0.95)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '25px',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10005,
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          title="切换到 3D 视角"
        >
          🔮 {show3DView ? '关闭 3D' : '3D 视角'}
        </button>
      )}

      {/* 3D 可视化面板 */}
      <NN3DVisualizer 
        model={model} 
        points={points} 
        isVisible={show3DView && !scenarioEnabled}
      />

      {/* 成就解锁弹窗 */}
      {achievementPopups.map((popup, index) => (
        <div
          key={popup.id}
          style={{
            position: 'fixed',
            top: `${100 + index * 90}px`,
            right: '24px',
            zIndex: 10010,
            background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(50, 50, 80, 0.98))',
            border: '2px solid rgba(251, 191, 36, 0.6)',
            borderRadius: '16px',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            animation: 'achievementPopup 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 8px 32px rgba(251, 191, 36, 0.3)',
            minWidth: '280px'
          }}
        >
          <div style={{
            fontSize: '2.5rem',
            animation: 'achievementBounce 0.6s ease-out'
          }}>
            {popup.icon}
          </div>
          <div>
            <div style={{
              fontSize: '0.75rem',
              color: 'rgba(251, 191, 36, 0.8)',
              marginBottom: '2px'
            }}>
              成就解锁! +{popup.xp} XP
            </div>
            <div style={{
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              {popup.name}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes achievementPopup {
          0% { transform: translateX(400px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes achievementBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
