import React, { useState, useEffect, useRef } from 'react';
import GraphCanvas from '../components/GraphCanvas';
import ControlPanel from '../components/ControlPanel';
import LossChart from '../components/LossChart';
import DatasetPanel from '../components/DatasetPanel';
import LearningCompanion from '../components/LearningCompanion';
import QuizModal, { QUIZ_QUESTIONS } from '../components/QuizModal';
import { computeLoss, gradientDescentStep, computeGradients } from '../utils/mlEngine';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { linearRegressionScenarios } from '../store/scenarioConfig';
import { usePedagogyStore } from '../store/pedagogyStore';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';
import useAchievementStore from '../store/achievementStore';

export default function LinearRegressionLab({ scenarioEnabled = false }) {
  const [points, setPoints] = useState([]);
  const [testPoints, setTestPoints] = useState([]);
  const [mode, setMode] = useState('TRAIN'); // 'TRAIN' | 'INFERENCE'

  const setLabDataSummary = usePedagogyStore((state) => state.setLabDataSummary);

  // Sync point count to the global store so the App-level useScenarioEngine
  // (used by SpotlightOverlay) can validate prerequisites.
  useEffect(() => {
    setLabDataSummary({ lrPoints: points.length, lrClasses: 1 });
  }, [points.length, setLabDataSummary]);

  const [w, setW] = useState(Math.random() * 2 - 1); // 随机斜率 (-1 到 1)
  const [b, setB] = useState(Math.random()); // 随机截距 (0 到 1)
  const [learningRate, setLearningRate] = useState(0.1);
  const [lossHistory, setLossHistory] = useState([]);
  const [isAutoTraining, setIsAutoTraining] = useState(false);
  const [epochCount, setEpochCount] = useState(0);
  // 梯度下降可视化相关状态
  const [prevW, setPrevW] = useState(null); // 上一步的 w（用于展示变化量）
  const [prevB, setPrevB] = useState(null); // 上一步的 b（用于展示变化量）
  const [gradients, setGradients] = useState({ wGradient: 0, bGradient: 0 });

  // 测验状态
  const [quizState, setQuizState] = useState({
    isOpen: false,
    quizKey: null,
    answeredCorrectly: false
  });
  const [quizHistory, setQuizHistory] = useState([]); // 记录已答过的测验

  // 实时计算当前的误差 (必须放在成就useEffect之前)
  const currentLoss = computeLoss(points, w, b);

  // 成就系统
  const { xp, achievements, unlockAchievement, completeLab } = useAchievementStore();
  const [achievementPopups, setAchievementPopups] = useState([]); // 成就弹窗队列

  // 成就触发函数
  const triggerAchievement = (achievementId, name, icon, xpReward) => {
    // 检查是否已解锁
    if (achievements.includes(achievementId)) return;
    
    // 添加到弹窗队列
    const popup = { id: Date.now(), achievementId, name, icon, xp: xpReward };
    setAchievementPopups(prev => [...prev, popup]);
    
    // 解锁成就
    unlockAchievement(achievementId);
    
    // 3秒后移除弹窗
    setTimeout(() => {
      setAchievementPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 3500);
  };

  // 成就触发监测
  useEffect(() => {
    if (scenarioEnabled) return;
    
    // FIRST_POINT: 添加第一个点
    if (points.length === 1) {
      triggerAchievement('FIRST_POINT', '初试锋芒', '🎯', 10);
    }
    
    // FIRST_TRAIN: 开始第一次训练
    if (lossHistory.length === 1 && !achievements.includes('FIRST_TRAIN')) {
      triggerAchievement('FIRST_TRAIN', '开始学习', '🚀', 10);
    }
    
    // LOW_LOSS: Loss < 0.1
    if (currentLoss < 0.1 && currentLoss > 0 && !achievements.includes('LOW_LOSS')) {
      triggerAchievement('LOW_LOSS', '精益求精', '🎯', 30);
    }
    
    // FIRST_LOSS_DROP: Loss 下降超过 50%
    if (lossHistory.length > 5 && currentLoss < lossHistory[0] * 0.5 && !achievements.includes('FIRST_LOSS_DROP')) {
      triggerAchievement('FIRST_LOSS_DROP', '渐入佳境', '📉', 20);
    }
    
    // INFERENCE_MODE: 进入推理模式
    if (mode === 'INFERENCE' && points.length > 0 && !achievements.includes('INFERENCE_MODE')) {
      triggerAchievement('INFERENCE_MODE', '学以致用', '🧪', 20);
    }
  }, [points.length, lossHistory.length, currentLoss, mode, scenarioEnabled, achievements]);

  // 收敛检测相关 ref（放在组件顶层，动画循环和 useEffect 都能访问）
  const plateauStateRef = useRef({
    prevLoss: null,
    prevW: null,
    prevB: null,
    plateauFrames: 0,
    hasTriggered: false // 防止重复触发
  });

  // Scenario engine for guided mode
  const {
    currentExperiment,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep
  } = useScenarioEngine(
    linearRegressionScenarios, scenarioEnabled, false,
    (stepId) => {
      // Validate prerequisites for NEXT_BUTTON steps
      if (stepId === 'lr_step_1_add_points' && points.length < 2) {
        return '请先在画板上点击添加至少 2 个数据点！';
      }
      return null;
    }
  );

  // 测验触发逻辑
  useEffect(() => {
    if (scenarioEnabled) return; // 引导模式下不触发自习测验
    
    // 条件：添加了 >= 3 个点，且还没有答过第一个测验
    if (points.length >= 3 && !quizHistory.includes('LINEAR_STEP_1')) {
      setQuizState({ isOpen: true, quizKey: 'LINEAR_STEP_1', answeredCorrectly: false });
    }
    // 条件：Loss 开始下降后，且还没有答过第二个测验
    else if (lossHistory.length > 5 && currentLoss < 1.0 && !quizHistory.includes('LINEAR_STEP_2')) {
      setQuizState({ isOpen: true, quizKey: 'LINEAR_STEP_2', answeredCorrectly: false });
    }
    // 条件：Loss < 0.15 且还没有答过第三个测验
    else if (currentLoss < 0.15 && currentLoss > 0 && !quizHistory.includes('LINEAR_STEP_3')) {
      setQuizState({ isOpen: true, quizKey: 'LINEAR_STEP_3', answeredCorrectly: false });
    }
    // 条件：切换到推理模式
    else if (mode === 'INFERENCE' && testPoints.length === 0 && !quizHistory.includes('INFERENCE')) {
      setQuizState({ isOpen: true, quizKey: 'INFERENCE', answeredCorrectly: false });
    }
  }, [points.length, lossHistory.length, currentLoss, mode, scenarioEnabled, quizHistory]);

  // 处理测验回答
  const handleQuizAnswer = (isCorrect) => {
    setQuizState(prev => ({ ...prev, answeredCorrectly: isCorrect }));
    
    // 触发测验相关成就
    if (!achievements.includes('FIRST_QUIZ')) {
      triggerAchievement('FIRST_QUIZ', '学而不厌', '📝', 15);
    }
    if (isCorrect && !achievements.includes('CORRECT_QUIZ')) {
      triggerAchievement('CORRECT_QUIZ', '答如泉涌', '🧠', 25);
    }
  };

  // 关闭测验
  const handleQuizClose = () => {
    if (quizState.quizKey) {
      setQuizHistory(prev => [...prev, quizState.quizKey]);
    }
    setQuizState({ isOpen: false, quizKey: null, answeredCorrectly: false });
  };

  // 动画帧引用
  const reqRef = useRef();
  // 存储最新状态的ref，以供requestAnimationFrame闭包中使用
  const stateRef = useRef({ points, w, b, learningRate, isAutoTraining, scenarioEnabled });
  // 存储 nextStep 引用，以便在动画循环中使用
  const nextStepRef = useRef(nextStep);

  useEffect(() => {
    stateRef.current = { points, w, b, learningRate, isAutoTraining, scenarioEnabled };
  }, [points, w, b, learningRate, isAutoTraining, scenarioEnabled]);

  useEffect(() => {
    nextStepRef.current = nextStep;
  }, [nextStep]);

  // 添加新数据点
  const handleAddPoint = (point) => {
    if (mode === 'TRAIN') {
      setPoints(prev => [...prev, point]);
    } else {
      setTestPoints(prev => [...prev, point]);
    }
  };

  // 删除指定索引的训练点
  const handleRemovePoint = (index) => {
    setPoints(prev => prev.filter((_, i) => i !== index));
  };

  // 导入 CSV 数据集
  const handleImportCSV = (newPoints) => {
    setPoints(prev => [...prev, ...newPoints]);
  };

  // 清空所有训练数据
  const handleClearAllPoints = () => {
    setPoints([]);
    setLossHistory([]);
    setW(Math.random() * 2 - 1);
    setB(Math.random());
    setPrevW(null);
    setPrevB(null);
    setGradients({ wGradient: 0, bGradient: 0 });
  };

  // 单步训练逻辑
  const handleTrainStep = () => {
    if (points.length === 0) {
      alert("⚠️ 请先在画板上点击添加一些散布的数据点！");
      return;
    }
    // 记录训练前的 w, b（用于展示变化量）
    setPrevW(w);
    setPrevB(b);
    // 计算当前梯度（用于可视化）
    const grads = computeGradients(points, w, b);
    setGradients(grads);

    // 执行一步训练
    const { w: newW, b: newB } = gradientDescentStep(points, w, b, learningRate);
    setW(newW);
    setB(newB);
    const newLoss = computeLoss(points, newW, newB);
    setLossHistory(prev => [...prev.slice(-150), newLoss]); // 保留最后150个点
  };

  // 切换自动训练状态
  const handleAutoTrainToggle = () => {
    if (points.length === 0) {
      alert("⚠️ 请先在画板上点击添加一些散布的数据点！");
      return;
    }
    setIsAutoTraining(prev => !prev);
  };

  // 重置整个实验室环境
  const handleReset = () => {
    setPoints([]);
    setTestPoints([]);
    setW(Math.random() * 2 - 1);
    setB(Math.random());
    setLossHistory([]);
    setIsAutoTraining(false);
    setPrevW(null);
    setPrevB(null);
    setGradients({ wGradient: 0, bGradient: 0 });
  };

  const handleClearTest = () => {
    setTestPoints([]);
  }

  // 自动训练机制 (Game Loop 模式，保持平滑动画)
  useEffect(() => {
    if (!isAutoTraining) {
      // 重置收敛检测状态
      plateauStateRef.current = {
        prevLoss: null,
        prevW: null,
        prevB: null,
        plateauFrames: 0,
        hasTriggered: false
      };
      return;
    }

    let lastTime = performance.now();
    let localEpochCounter = 0;

    const loop = (time) => {
      // 限制每秒训练次数, 例如控制在大约 30 FPS
      if (time - lastTime > 30) {
        const { points: cPoints, w: cW, b: cB, learningRate: cLR, scenarioEnabled: cScenarioEnabled } = stateRef.current;

        if (cPoints.length > 0) {
          const { w: newW, b: newB } = gradientDescentStep(cPoints, cW, cB, cLR);
          const l = computeLoss(cPoints, newW, newB);

          // --- 收敛检测（直接在此循环中执行，不依赖 React 状态） ---
          if (cScenarioEnabled && !plateauStateRef.current.hasTriggered) {
            const ps = plateauStateRef.current;
            const prevLoss = ps.prevLoss;

            if (prevLoss !== null) {
              // 计算相对变化率
              const lossChange = Math.abs(prevLoss - l) / (prevLoss || 1);
              const paramChange = ps.prevW !== null
                ? Math.abs(newW - ps.prevW) + Math.abs(newB - ps.prevB)
                : 0;

              // Loss 改善不足 5% 或参数基本不变 = 进入 plateau
              const isPlateau = lossChange < 0.05 || paramChange < 0.0001;

              if (isPlateau) {
                ps.plateauFrames += 1;
              } else {
                ps.plateauFrames = 0; // 有明显改善，重置计数器
              }

              // 持续 20 帧 plateau 或训练满 30 帧后 loss 变化极小
              if (ps.plateauFrames >= 20 || (localEpochCounter >= 30 && lossChange < 0.01)) {
                ps.hasTriggered = true;
                ps.plateauFrames = 0;
                ps.prevLoss = null;
                ps.prevW = null;
                ps.prevB = null;
                // 调用 nextStep 推进剧本
                if (nextStepRef.current) nextStepRef.current();
              }
            }

            ps.prevLoss = l;
            ps.prevW = newW;
            ps.prevB = newB;
          }
          // --- 收敛检测结束 ---

          // 计算当前梯度（用于可视化梯度下降区域）
          const grads = computeGradients(cPoints, cW, cB);
          setPrevW(cW);
          setPrevB(cB);
          setGradients(grads);

          setW(newW);
          setB(newB);
          setLossHistory(prev => [...prev.slice(-150), l]); // 保留最新150条历史记录
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


  // ---- 数据质量检查 ----
  const dataQualityWarning = (() => {
    if (points.length === 0) return null;
    if (points.length === 1) return { level: 'error', text: '⚠️ 仅 1 个点，无法计算误差！' };
    if (points.length === 2) return { level: 'warn', text: '💡 2 个点太少，模型可能欠拟合，建议添加更多点。' };
    // 检查 X 值范围是否足够大
    const xVals = points.map(p => p.x);
    const xRange = Math.max(...xVals) - Math.min(...xVals);
    if (xRange < 0.1) return { level: 'error', text: '⚠️ X 值范围太小（集中在同一位置），模型无法学到有效模式！' };
    // 检查 Y 值是否太接近
    const yVals = points.map(p => p.y);
    const yRange = Math.max(...yVals) - Math.min(...yVals);
    if (yRange < 0.05) return { level: 'error', text: '⚠️ Y 值几乎相同，所有点在同一水平线上！' };
    return null;
  })();

  // ---- 智能教学向导提示文本 ----
  let stepTitle = "1️⃣ 第一步：收集数据";
  let stepDesc = "在左侧画板中随意点击，添加一些散步的点。这就好比我们在现实世界中收集的供AI学习的「大量数据」。无数据，不AI。";
  if (dataQualityWarning) {
    stepDesc = dataQualityWarning.text + ' ' + stepDesc;
    if (dataQualityWarning.level === 'error') {
      stepTitle = '⚠️ 数据质量不足';
    }
  } else if (mode === 'INFERENCE') {
    stepTitle = "🛸 开始推断 (Inference Phase)";
    stepDesc = "欢迎进入实战环节！现在你在画布上点击，放下的将不再是训练标签，而是向模型发出的一次「提问」（即给定的X坐标求Y）。看看模型生成的紫色预测点是否合理。";
  } else {
    if (points.length > 1 && lossHistory.length === 0) {
      stepTitle = "2️⃣ 第二步：理解误差 (Loss)";
      stepDesc = "绿线是模型初始随机的猜测。红线代表散点和直线的垂直距离。这叫做误差(Loss)。机器学习的目的，就是把误差降到最低。";
    } else if (lossHistory.length > 0 && currentLoss > 0.05) {
      stepTitle = "3️⃣ 第三步：梯度下降 (Gradient Descent)";
      stepDesc = "点击「自动训练」看魔法发生！系统正在背后默默用「梯度下降」算法微调那条绿色的直线。你可以看到误差值急剧下降。";
    } else if (lossHistory.length > 0 && currentLoss <= 0.05) {
      stepTitle = "🎉 第四步：训练完成！尝试推理";
      stepDesc = "看！直线已经尽可能完美地穿过所有点了！你可以切换到【🛸 预测推理】模式去考考它了。";
    }
  }

  // Compact inline gradient panel for single-page layout
  const GradientPanel = () => (
    <div className="glass-panel" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 'bold' }}>
        梯度下降
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
        <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>w = w − lr × ∂Loss/∂w</span><br/>
        <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>b = b − lr × ∂Loss/∂b</span>
      </div>
      <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(148,163,184,0.8)' }}>
        ∂w: <span style={{ color: 'var(--accent-red)' }}>{gradients?.wGradient?.toFixed(4) ?? '0.0000'}</span>
        {'  '}
        ∂b: <span style={{ color: 'var(--accent-red)' }}>{gradients?.bGradient?.toFixed(4) ?? '0.0000'}</span>
      </div>
      {prevW !== null && prevB !== null && (
        <div style={{ fontSize: '0.6rem', color: 'var(--accent-green)' }}>
          变化: w {(w - prevW) >= 0 ? '+' : ''}{(w - prevW).toFixed(4)}, b {(b - prevB) >= 0 ? '+' : ''}{(b - prevB).toFixed(4)}
        </div>
      )}
    </div>
  );

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
        flex: '0 0 360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        height: '100%'
      }}>
        <GraphCanvas
          points={points}
          testPoints={testPoints}
          w={w}
          b={b}
          onAddPoint={handleAddPoint}
          onReportClick={() => reportClick('lr-graph-canvas')}
        />
      </div>

      {/* 中列：控制面板 + Loss曲线 */}
      <div style={{
        flex: '1 1 300px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '280px',
        maxHeight: '100%',
        overflow: 'auto'
      }}>
        <ControlPanel
          mode={mode}
          setMode={setMode}
          onClearTest={handleClearTest}
          w={w}
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

      {/* 右列：梯度下降 + 数据集面板 */}
      <div style={{
        flex: '0 0 280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '240px',
        maxHeight: '100%',
        overflow: 'auto'
      }}>
        <GradientPanel />
        <DatasetPanel
          type="regression"
          points={points}
          onAddPoint={handleAddPoint}
          onRemovePoint={handleRemovePoint}
          onImportCSV={handleImportCSV}
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
              labId="LINEAR"
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

      {/* 交互式小测验 - 仅在非引导模式下显示 */}
      {!scenarioEnabled && quizState.isOpen && quizState.quizKey && (
        <QuizModal
          isOpen={quizState.isOpen}
          onClose={handleQuizClose}
          question={QUIZ_QUESTIONS[quizState.quizKey]?.question}
          options={QUIZ_QUESTIONS[quizState.quizKey]?.options}
          correctIndex={QUIZ_QUESTIONS[quizState.quizKey]?.correctIndex}
          explanation={QUIZ_QUESTIONS[quizState.quizKey]?.explanation}
          onAnswer={handleQuizAnswer}
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
