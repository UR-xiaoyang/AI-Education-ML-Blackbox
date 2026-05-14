import React, { useState, useEffect, useRef, useCallback } from 'react';
import TreeGraphCanvas from '../components/TreeGraphCanvas';
import TreeControlPanel from '../components/TreeControlPanel';
import DatasetPanel from '../components/DatasetPanel';
import useAchievementStore from '../store/achievementStore';
import { buildDecisionTree, getTreeRegions } from '../utils/treeEngine';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { decisionTreeScenarios } from '../store/scenarioConfig';
import { usePedagogyStore } from '../store/pedagogyStore';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';
import { calculateGini } from '../utils/treeEngine';

export default function DecisionTreeLab({ scenarioEnabled = false }) {
  const [points, setPoints] = useState([]);
  const [testPoints, setTestPoints] = useState([]);
  const [mode, setMode] = useState('TRAIN');
  const [maxDepth, setMaxDepth] = useState(1);
  const [treeRegions, setTreeRegions] = useState([]);
  const [actualDepth, setActualDepth] = useState(0);
  // 切分扫描动画状态
  const [currentAnimation, setCurrentAnimation] = useState(null);
  // 已完成的切分线列表
  const [completedSplits, setCompletedSplits] = useState([]);

  // 成就系统
  const { achievements, unlockAchievement } = useAchievementStore();
  const [achievementPopups, setAchievementPopups] = useState([]);

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

  // 决策树成就监测
  useEffect(() => {
    if (scenarioEnabled) return;

    // TREE_EXPLORER: 进入决策树实验室
    if (!achievements.includes('TREE_EXPLORER')) {
      triggerAchievement('TREE_EXPLORER', '决策树探索者', '🌲', 30);
    }

    // 添加第一个点
    if (points.length === 1 && !achievements.includes('TREE_FIRST_POINT')) {
      triggerAchievement('TREE_FIRST_POINT', '决策初体验', '🌱', 10);
    }

    // 第一次切分
    if (actualDepth >= 1 && !achievements.includes('TREE_FIRST_SPLIT')) {
      triggerAchievement('TREE_FIRST_SPLIT', '空间切割', '✂️', 20);
    }

    // 深度达到3
    if (maxDepth >= 3 && !achievements.includes('TREE_DEPTH_3')) {
      triggerAchievement('TREE_DEPTH_3', '深度探索', '📊', 30);
    }
  }, [scenarioEnabled, points.length, actualDepth, maxDepth, achievements]);

  const prevDepthRef = useRef(1);
  const prevPointsRef = useRef([]);
  const timeoutRef = useRef(null);

  const setLabDataSummary = usePedagogyStore((state) => state.setLabDataSummary);

  // Sync point count & class count to the global store so the App-level useScenarioEngine
  // (used by SpotlightOverlay) can validate prerequisites.
  useEffect(() => {
    const classes = new Set(points.map((p) => p.label)).size;
    setLabDataSummary({ dtPoints: points.length, dtClasses: classes });
  }, [points.length, setLabDataSummary]);

  // 场景引擎 - 与线性回归实验室相同的模式
  const {
    currentExperiment,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep
  } = useScenarioEngine(
    decisionTreeScenarios, scenarioEnabled, false,
    (stepId) => {
      if (stepId === 'dt_step_1_add_data') {
        const classes = new Set(points.map(p => p.label));
        if (classes.size < 2) {
          return '请分别用鼠标左键和右键添加两种颜色的数据点！';
        }
      }
      return null;
    }
  );

  // 深度变化处理器
  const handleDepthChange = useCallback((newDepth) => {
    setMaxDepth(newDepth);
    reportValueChange('dt-slider-max-depth', newDepth);
  }, [reportValueChange]);

  // 模式变化处理器
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    reportClick('dt-btn-mode-toggle');
  }, [reportClick]);

  // 辅助函数：从树中提取所有切分点
  const getAllSplitsFromTree = (node, splits = []) => {
    if (!node) return splits;
    if (node.splitFeature !== undefined && node.splitValue !== undefined) {
      splits.push({ feature: node.splitFeature, val: node.splitValue });
    }
    if (node.left) getAllSplitsFromTree(node.left, splits);
    if (node.right) getAllSplitsFromTree(node.right, splits);
    return splits;
  };

  // 辅助函数：计算切分的候选线（用于动画）
  const getCandidatesForSplit = (currentPoints, splitFeature, splitVal) => {
    const candidates = [];
    const features = ['x', 'y'];

    for (const feature of features) {
      const sorted = [...currentPoints].sort((a, b) => a[feature] - b[feature]);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i][feature] === sorted[i + 1][feature]) continue;
        const val = (sorted[i][feature] + sorted[i + 1][feature]) / 2;
        const left = sorted.slice(0, i + 1);
        const right = sorted.slice(i + 1);
        const giniLeft = calculateGini(left);
        const giniRight = calculateGini(right);
        const gini = (left.length * giniLeft + right.length * giniRight) / currentPoints.length;
        candidates.push({ feature, val, gini });
      }
    }

    // 找到当前切分的最佳候选位置
    const bestSplit = candidates.reduce((best, c) => c.gini < best.gini ? c : best, { gini: Infinity });
    return { candidates, bestSplit };
  };

  // 辅助函数：播放单个切分动画
  const playSplitAnimation = (split, depthLevel, onComplete) => {
    const { candidates, bestSplit } = getCandidatesForSplit(points, split.feature, split.val);

    setCurrentAnimation({
      candidates,
      bestSplit,
      depthLevel,
      phase: 'scanning',
      progress: 0
    });

    // 1.5 秒后进入确定阶段
    const t1 = setTimeout(() => {
      setCurrentAnimation(prev => ({ ...prev, phase: 'finalizing', progress: 1 }));

      // 0.5 秒后完成动画
      const t2 = setTimeout(() => {
        onComplete();
      }, 500);

      timeoutRef.current = t2;
    }, 1500);

    timeoutRef.current = t1;
  };

  // 一旦点或者深度限制发生变化，重新计算切分线并显示动画
  useEffect(() => {
    if (points.length === 0) {
      setTreeRegions([]);
      setActualDepth(0);
      setCompletedSplits([]);
      setCurrentAnimation(null);
      prevDepthRef.current = 1;
      prevPointsRef.current = [];
      return;
    }

    const classes = new Set(points.map(p => p.label));
    if (classes.size < 2 && points.length > 0) {
      setTreeRegions([{ minX: 0, maxX: 1, minY: 0, maxY: 1, label: points[0].label, depth: 0 }]);
      setActualDepth(0);
      setCompletedSplits([]);
      return;
    }

    // 重新构建树（使用引导覆盖的深度值）
    const tree = buildDecisionTree(points, 0, maxDepth);
    const regions = getTreeRegions(tree);

    // 提取所有切分
    const allSplits = getAllSplitsFromTree(tree, []);

    // 检查是数据变化还是深度变化
    const dataChanged = points.length !== prevPointsRef.current.length ||
      !points.every((p, i) => prevPointsRef.current[i] &&
        p.x === prevPointsRef.current[i].x &&
        p.y === prevPointsRef.current[i].y &&
        p.label === prevPointsRef.current[i].label);

    if (dataChanged) {
      // 数据变化：清除所有切分线，重新动画显示所有切分
      setCompletedSplits([]);
      prevDepthRef.current = 1;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 依次动画显示所有切分
      let delay = 100;
      allSplits.forEach((split, idx) => {
        setTimeout(() => {
          playSplitAnimation(split, idx + 1, () => {
            setCompletedSplits(prev => [...prev, split]);
            setCurrentAnimation(null);
          });
        }, delay * idx);
      });

      prevPointsRef.current = [...points];
      prevDepthRef.current = maxDepth;
    } else if (maxDepth !== prevDepthRef.current) {
      // 深度变化：重新计算所有切分并显示变化
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (maxDepth < prevDepthRef.current) {
        // 深度减少：显示较少的切分线
        setCompletedSplits(allSplits);
        setCurrentAnimation(null);
      } else {
        // 深度增加：显示新的切分线
        const prevSplits = getAllSplitsFromTree(buildDecisionTree(points, 0, prevDepthRef.current), []);
        const newSplits = allSplits.slice(prevSplits.length);

        // 保留之前的切分
        setCompletedSplits(prevSplits);

        // 依次动画显示新的切分
        newSplits.forEach((split, idx) => {
          setTimeout(() => {
            playSplitAnimation(split, prevSplits.length + idx + 1, () => {
              setCompletedSplits(prev => [...prev, split]);
              setCurrentAnimation(null);
            });
          }, 100 * idx);
        });
      }

      prevDepthRef.current = maxDepth;
    }

    // 计算渲染出的所有区域的最大深度作为实际深度
    const maxD = regions.reduce((max, r) => Math.max(max, r.depth || 0), 0);

    setTreeRegions(regions);
    setActualDepth(maxD);

  }, [points, maxDepth]);

  const handleAddPoint = (point) => {
    if (mode === 'TRAIN') {
      setPoints(prev => [...prev, point]);
    } else {
      // 推理模式下添加测试点
      setTestPoints(prev => [...prev, point]);
    }
    // 统一报告画布点击，供场景引导使用
    reportClick('dt-graph-canvas');
  };

  const handleReset = () => {
    setPoints([]);
    setTestPoints([]);
    setMaxDepth(1);
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
    }
    return pts;
  };

  const handleGenerateData = (type) => {
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
    setMaxDepth(1);
  };

  let stepTitle = '1️⃣ 第一步：种植两类数据';
  let stepDesc = '在画布上左键添加橙色阵营(0)，鼠标右键添加蓝色阵营(1)。与之前不同，我们将不使用数学公式，而是使用空间切割法(基于信息增益或基尼系数)。';
  if (mode === 'INFERENCE') {
    stepTitle = '🛸 开始推断 (Inference Phase)';
    stepDesc = '欢迎进入实战环节！现在降落的未知圆点，AI 会通过那一张张切割出来的长方形「滤网」，瞬间归类颜色。拉动最大树深度滑块，你可以清晰看到过拟合现象导致的推断失误。';
  } else {
    if (points.length > 3 && maxDepth === 1) {
      stepTitle = '2️⃣ 第二步：观察简单的一刀切 (深度=1)';
      stepDesc = '当前决策树的深度被限制在 1 层。它只能横着或者竖着砍一刀(一重if-else)。你可以看到它在竭力尝试将两类人分开，但往往由于性能受限无法分干净。';
    } else if (maxDepth > 1 && maxDepth <= 4) {
      stepTitle = '3️⃣ 第三步：生长的树 (加大模型容量)';
      stepDesc = '随着允许的树深度增加，相当于容许模型做更复杂的嵌套if-else。你可以看到空间被切分得越来越细（像马赛克一样）。它在尽可能地完美拟合当前的训练数据。';
    } else if (maxDepth > 4) {
      stepTitle = '⚠️ 第四步：警惕！过拟合 (Overfitting)！尝试推理';
      stepDesc = '如果深度限制放得很宽，决策树会陷入死记硬背（过拟合）。AI虽然在当前画板考试得了100分，但你可以去【🛸 预测推理】放几个测试点，看看它是不是失去了举一反三的泛化能力。';
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
        <TreeGraphCanvas
          points={points}
          testPoints={testPoints}
          treeRegions={treeRegions}
          onAddPoint={handleAddPoint}
          onReportClick={() => reportClick('dt-graph-canvas')}
          currentAnimation={currentAnimation}
          completedSplits={completedSplits}
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
        <TreeControlPanel
          mode={mode}
          setMode={handleModeChange}
          onClearTest={handleClearTest}
          maxDepth={maxDepth}
          setMaxDepth={handleDepthChange}
          actualDepth={actualDepth}
          stepTitle={stepTitle}
          stepDesc={stepDesc}
          onReset={handleReset}
          reportClick={reportClick}
          reportValueChange={reportValueChange}
        />
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
          type="tree"
          points={points}
          onAddPoint={handleAddPoint}
          onRemovePoint={handleRemovePoint}
          onImportCSV={handleImportCSV}
          onGeneratePreset={handleGenerateData}
          onClearAll={handleClearAllPoints}
        />
      </div>

      {/* 场景引导组件 - 与线性回归实验室相同的模式 */}
      {scenarioEnabled && (
        <>
          <SpotlightOverlay onNextStep={nextStep} />
          <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 10003 }}>
            <PedagogySidebar
              currentExperiment={currentExperiment}
              currentStepIndex={currentStepIndex}
              labId="TREE"
            />
          </div>
        </>
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
