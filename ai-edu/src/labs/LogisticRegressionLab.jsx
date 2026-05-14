import React, { useState, useEffect, useRef } from 'react';
import LogisticGraphCanvas from '../components/LogisticGraphCanvas';
import LogisticControlPanel from '../components/LogisticControlPanel';
import LossChart from '../components/LossChart';
import DatasetPanel from '../components/DatasetPanel';
import LearningCompanion from '../components/LearningCompanion';
import useAchievementStore from '../store/achievementStore';
import { computeCrossEntropyLoss, logisticGradientDescentStep } from '../utils/mlEngine';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { logisticRegressionScenarios } from '../store/scenarioConfig';
import { usePedagogyStore } from '../store/pedagogyStore';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';

export default function LogisticRegressionLab({ scenarioEnabled = false }) {
  const [points, setPoints] = useState([]);
  const [testPoints, setTestPoints] = useState([]);
  const [mode, setMode] = useState('TRAIN');
  const [w1, setW1] = useState(Math.random() * 2 - 1);
  const [w2, setW2] = useState(Math.random() * 2 - 1);
  const [b, setB] = useState(Math.random() * 2 - 1);
  const [learningRate, setLearningRate] = useState(1.0); // 对于逻辑回归，步长可以大一点
  const [lossHistory, setLossHistory] = useState([]);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [epochCount, setEpochCount] = useState(0);

  // 成就系统
  const { achievements, unlockAchievement } = useAchievementStore();
  const [achievementPopups, setAchievementPopups] = useState([]);
  const [hasGeneratedData, setHasGeneratedData] = useState(false);

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

  // 逻辑回归成就监测
  useEffect(() => {
    if (scenarioEnabled) return;

    // LOGISTIC_EXPLORER: 进入逻辑回归实验室
    if (!achievements.includes('LOGISTIC_EXPLORER')) {
      triggerAchievement('LOGISTIC_EXPLORER', '分类探索者', '🟠🔵', 30);
    }

    // 添加第一个点
    if (points.length === 1 && !achievements.includes('LOGISTIC_FIRST_POINT')) {
      triggerAchievement('LOGISTIC_FIRST_POINT', '分类初体验', '📍', 10);
    }

    // 开始训练
    if (lossHistory.length === 1 && !achievements.includes('LOGISTIC_FIRST_TRAIN')) {
      triggerAchievement('LOGISTIC_FIRST_TRAIN', '分类训练', '⚙️', 10);
    }

    // 切换模式
    if (mode === 'INFERENCE' && testPoints.length === 0 && !achievements.includes('LOGISTIC_INFERENCE')) {
      triggerAchievement('LOGISTIC_INFERENCE', '分类预测', '🔍', 20);
    }
  }, [scenarioEnabled, points.length, lossHistory.length, mode, achievements]);

  // Sync point count & class count to the global store so the App-level useScenarioEngine
  // (used by SpotlightOverlay) can validate prerequisites.
  useEffect(() => {
    const classes = new Set(points.map((p) => p.label)).size;
    setLabDataSummary({ lgPoints: points.length, lgClasses: classes });
  }, [points.length, setLabDataSummary]);

  // Scenario engine for guided mode
  const {
    currentExperiment,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep
  } = useScenarioEngine(
    logisticRegressionScenarios, scenarioEnabled, false,
    (stepId) => {
      // Validate prerequisites for NEXT_BUTTON steps
      if (stepId === 'lg_step_1_add_data') {
        const classes = new Set(points.map(p => p.label));
        if (classes.size < 2) {
          return '请分别用鼠标左键和右键添加两种颜色的数据点！';
        }
      }
      if (stepId === 'lg_step_3_train' && points.length < 2) {
        return '请先添加至少 2 个数据点！';
      }
      return null;
    }
  );

  // 实时损失
  const currentLoss = computeCrossEntropyLoss(points, w1, w2, b);

  // 收敛检测相关 ref（放在组件顶层，动画循环和 useEffect 都能访问）
  const plateauStateRef = useRef({
    prevLoss: null,
    prevW1: null,
    prevW2: null,
    prevB: null,
    plateauFrames: 0,
    hasTriggered: false
  });

  // 动画帧与状态闭包
  const reqRef = useRef();
  const stateRef = useRef({ points, w1, w2, b, learningRate, isAutoTraining, scenarioEnabled });
  const nextStepRef = useRef(nextStep);

  useEffect(() => {
    stateRef.current = { points, w1, w2, b, learningRate, isAutoTraining, scenarioEnabled };
  }, [points, w1, w2, b, learningRate, isAutoTraining, scenarioEnabled]);

  useEffect(() => {
    nextStepRef.current = nextStep;
  }, [nextStep]);

  const handleAddPoint = (point) => {
    if (mode === 'TRAIN') {
      setPoints(prev => [...prev, point]);
    } else {
      setTestPoints(prev => [...prev, point]);
    }
  };

  const handleTrainStep = () => {
    if (points.length === 0) return;
    const { w1: nw1, w2: nw2, b: nb } = logisticGradientDescentStep(points, w1, w2, b, learningRate);
    setW1(nw1);
    setW2(nw2);
    setB(nb);
    const newLoss = computeCrossEntropyLoss(points, nw1, nw2, nb);
    setLossHistory(prev => [...prev.slice(-150), newLoss]);
  };

  const handleAutoTrainToggle = () => {
    if (points.length === 0) {
      alert('⚠️ 请先在画板上放置至少两种颜色的数据点！');
      return;
    }
    const types = new Set(points.map(p => p.label));
    if (types.size < 2) {
      alert('⚠️ 逻辑回归旨在分类！你现在只添加了一种类型的数据点，请鼠标右键添加另一种点！');
      return;
    }
    setIsAutoTraining(prev => !prev);
  };

  const handleReset = () => {
    setPoints([]);
    setTestPoints([]);
    setW1(Math.random() * 2 - 1);
    setW2(Math.random() * 2 - 1);
    setB(Math.random() * 2 - 1);
    setLossHistory([]);
    setIsAutoTraining(false);
  };

  const handleClearTest = () => {
    setTestPoints([]);
  }

  // 生成预设数据集
  const generateDataset = (type) => {
    const pts = [];
    const N = 50;
    if (type === 'circle') {
      for (let i = 0; i < N; i++) {
        const r = Math.random() * 0.2;
        const theta = Math.random() * 2 * Math.PI;
        pts.push({ x: 0.5 + r * Math.cos(theta), y: 0.5 + r * Math.sin(theta), label: 0 });
      }
      for (let i = 0; i < N * 1.5; i++) {
        const r = 0.35 + Math.random() * 0.1;
        const theta = Math.random() * 2 * Math.PI;
        pts.push({ x: 0.5 + r * Math.cos(theta), y: 0.5 + r * Math.sin(theta), label: 1 });
      }
    } else if (type === 'xor') {
      for (let i = 0; i < N * 2; i++) {
        const x = Math.random();
        const y = Math.random();
        if (Math.abs(x - 0.5) < 0.1 || Math.abs(y - 0.5) < 0.1) continue;
        const label = (x > 0.5) ^ (y > 0.5) ? 1 : 0;
        pts.push({ x, y, label });
      }
    } else if (type === 'moons') {
      for (let i = 0; i < N; i++) {
        const theta = Math.random() * Math.PI;
        pts.push({ x: 0.5 + 0.3 * Math.cos(theta), y: 0.6 + 0.2 * Math.sin(theta), label: 0 });
      }
      for (let i = 0; i < N; i++) {
        const theta = Math.random() * Math.PI;
        pts.push({ x: 0.5 + 0.3 * Math.cos(theta) + 0.15, y: 0.6 - 0.2 * Math.sin(theta) - 0.1, label: 1 });
      }
    } else if (type === 'spiral') {
      for (let i = 0; i < N * 2; i++) {
        const t = (i / (N * 2)) * 4 * Math.PI;
        const r = 0.05 + (i / (N * 2)) * 0.45;
        const x = 0.5 + r * Math.cos(t) + (Math.random() - 0.5) * 0.03;
        const y = 0.5 + r * Math.sin(t) + (Math.random() - 0.5) * 0.03;
        pts.push({ x, y, label: 0 });
      }
      for (let i = 0; i < N * 2; i++) {
        const t = (i / (N * 2)) * 4 * Math.PI + Math.PI;
        const r = 0.05 + (i / (N * 2)) * 0.45;
        const x = 0.5 + r * Math.cos(t) + (Math.random() - 0.5) * 0.03;
        const y = 0.5 + r * Math.sin(t) + (Math.random() - 0.5) * 0.03;
        pts.push({ x, y, label: 1 });
      }
    }
    return pts;
  };

  const handleGenerateData = (type) => {
    setIsAutoTraining(false);
    setLossHistory([]);
    setTestPoints([]);
    setW1(Math.random() * 2 - 1);
    setW2(Math.random() * 2 - 1);
    setB(Math.random() * 2 - 1);
    setPoints(generateDataset(type));
  };

  // 删除指定索引的训练点
  const handleRemovePoint = (index) => {
    setPoints(prev => prev.filter((_, i) => i !== index));
  };

  // 导入 CSV 数据集
  const handleImportCSV = (newPoints) => {
    setPoints(prev => [...prev, ...newPoints]);
  };

  // 清空所有训练数据并重置模型
  const handleClearAllPoints = () => {
    setPoints([]);
    setLossHistory([]);
    setW1(Math.random() * 2 - 1);
    setW2(Math.random() * 2 - 1);
    setB(Math.random() * 2 - 1);
  };

  // Game Loop
  useEffect(() => {
    if (!isAutoTraining) {
      // 重置收敛检测状态
      plateauStateRef.current = {
        prevLoss: null,
        prevW1: null,
        prevW2: null,
        prevB: null,
        plateauFrames: 0,
        hasTriggered: false
      };
      return;
    }

    let lastTime = performance.now();
    let localEpochCounter = 0;

    const loop = (time) => {
      if (time - lastTime > 30) {
        const { points: cPoints, w1: cw1, w2: cw2, b: cb, learningRate: cLR, scenarioEnabled: cScenarioEnabled } = stateRef.current;
        if(cPoints.length > 0) {
            const { w1: mw1, w2: mw2, b: mb } = logisticGradientDescentStep(cPoints, cw1, cw2, cb, cLR);
            const l = computeCrossEntropyLoss(cPoints, mw1, mw2, mb);

            // --- 收敛检测（直接在此循环中执行，不依赖 React 状态） ---
            if (cScenarioEnabled && !plateauStateRef.current.hasTriggered) {
              const ps = plateauStateRef.current;
              const prevLoss = ps.prevLoss;

              if (prevLoss !== null) {
                const lossChange = Math.abs(prevLoss - l) / (prevLoss || 1);
                const paramChange = ps.prevW1 !== null
                  ? Math.abs(mw1 - ps.prevW1) + Math.abs(mw2 - ps.prevW2) + Math.abs(mb - ps.prevB)
                  : 0;

                const isPlateau = lossChange < 0.05 || paramChange < 0.0001;

                if (isPlateau) {
                  ps.plateauFrames += 1;
                } else {
                  ps.plateauFrames = 0;
                }

                if (ps.plateauFrames >= 20 || (localEpochCounter >= 30 && lossChange < 0.01)) {
                  ps.hasTriggered = true;
                  ps.plateauFrames = 0;
                  ps.prevLoss = null;
                  ps.prevW1 = null;
                  ps.prevW2 = null;
                  ps.prevB = null;
                  if (nextStepRef.current) nextStepRef.current();
                }
              }

              ps.prevLoss = l;
              ps.prevW1 = mw1;
              ps.prevW2 = mw2;
              ps.prevB = mb;
            }
            // --- 收敛检测结束 ---

            setW1(mw1);
            setW2(mw2);
            setB(mb);
            setLossHistory(prev => [...prev.slice(-150), l]);
            localEpochCounter += 1;
            setEpochCount(localEpochCounter);
        }
        lastTime = time;
      }
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isAutoTraining]);

  let stepTitle = '1️⃣ 第一步：收集两类数据';
  let stepDesc = '逻辑回归不是用来「画一条拟合线」的，而是用来做分类(Classification)。请用鼠标左键和右键在画布上分散地点击，摆放橙色和蓝色两支队伍。';
  if (mode === 'INFERENCE') {
    stepTitle = '🛸 开始推断 (Inference Phase)';
    stepDesc = '欢迎进入实战环节！现在你在画布上放下的未知圆点，AI 会根据目前楚河汉界的位置瞬间判断它应该属于哪个阵营，并赋予发光特效。如果边界移动，它的信仰也会随之改变！';
  } else {
    if (points.length > 1 && lossHistory.length === 0) {
      stepTitle = '2️⃣ 第二步：理解交叉熵 (Cross Entropy)';
      stepDesc = '当前这条紫线就是算法随机生成的分割线(Decision Boundary)。错分的点会产生极大的惩罚，算法的目标是转动并移动这条线，直到两派数据被完美隔开。';
    } else if (lossHistory.length > 0 && currentLoss > 0.1) {
      stepTitle = '3️⃣ 第三步：分类训练中...';
      stepDesc = '不断调整分界面的位置和角度。你也许会发现有些点太「深入敌后」，模型不管怎么转都无法完美分割，这是线性模型的局限性。';
    } else if (lossHistory.length > 0 && currentLoss <= 0.1) {
      stepTitle = '🎉 第四步：成功划清界限！尝试推理';
      stepDesc = '两部分数据被成功分类！你可以切换到【🛸 预测推理】模式，来验证任何新坐标属于哪个阵营。';
    }
  }

  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      width: '100%',
      height: 'calc(100vh - 140px)',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>

      {/* 左列：图形交互面板 */}
      <div style={{
        flex: '0 0 380px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        height: '100%'
      }}>
        <LogisticGraphCanvas
          points={points}
          testPoints={testPoints}
          w1={w1}
          w2={w2}
          b={b}
          onAddPoint={handleAddPoint}
          onReportClick={() => reportClick('lg-graph-canvas')}
        />
      </div>

      {/* 中列：控制面板 */}
      <div style={{
        flex: '1 1 300px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '280px',
        maxHeight: '100%',
        overflow: 'auto'
      }}>
        <LogisticControlPanel
          mode={mode}
          setMode={setMode}
          onClearTest={handleClearTest}
          w1={w1}
          w2={w2}
          b={b}
          loss={currentLoss}
          stepTitle={stepTitle}
          stepDesc={stepDesc}
          onTrainStep={handleTrainStep}
          onAutoTrain={handleAutoTrainToggle}
          isAutoTraining={isAutoTraining}
          onReset={handleReset}
          learningRate={learningRate}
          setLearningRate={setLearningRate}
          reportClick={reportClick}
          reportValueChange={reportValueChange}
        />
        <LossChart lossHistory={lossHistory} />
      </div>

      {/* 右列：数据集面板 */}
      <div style={{
        flex: '0 0 280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '240px',
        maxHeight: '100%',
        overflow: 'auto'
      }}>
        <DatasetPanel
          type="logistic"
          points={points}
          onAddPoint={handleAddPoint}
          onRemovePoint={handleRemovePoint}
          onImportCSV={handleImportCSV}
          onGeneratePreset={handleGenerateData}
          onClearAll={handleClearAllPoints}
        />
      </div>

      {/* 场景引导组件 - 使用本实验室的场景状态 */}
      {scenarioEnabled && (
        <>
          <SpotlightOverlay onNextStep={nextStep} />
          <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 10003 }}>
            <PedagogySidebar
              currentExperiment={currentExperiment}
              currentStepIndex={currentStepIndex}
              labId="LOGISTIC"
            />
          </div>
        </>
      )}

      {/* 学习伴侣 - 仅在非引导模式下显示 */}
      {!scenarioEnabled && (
        <LearningCompanion
          pointsCount={points.length}
          lossHistoryLength={lossHistory.length}
          currentLoss={currentLoss}
          isTraining={isAutoTraining}
          mode={mode}
          labType="LINEAR"
        />
      )}

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
