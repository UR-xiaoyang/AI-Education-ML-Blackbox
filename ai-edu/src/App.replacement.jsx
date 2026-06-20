import React, { useMemo, useState, useEffect } from 'react';
import LinearRegressionLab from './labs/LinearRegressionLab';
import LogisticRegressionLab from './labs/LogisticRegressionLab';
import DecisionTreeLab from './labs/DecisionTreeLab';
import NeuralNetworkLab from './labs/NeuralNetworkLab';
import LLMLab from './labs/LLMLab';
import YOLOLab from './labs/YOLOLab';
import TeacherDashboardLab from './labs/TeacherDashboardLab';
import { SpotlightOverlay } from './components/SpotlightOverlay';
import { CompletionChoiceModal } from './components/CompletionChoiceModal';
import { PedagogySidebar } from './components/PedagogySidebar';
import AchievementSystem from './components/AchievementSystem';
import LearningStats from './components/LearningStats';
import NewUserTour from './components/NewUserTour';
import useKeyboardShortcuts, { KeyboardShortcutsHelp } from './hooks/useKeyboardShortcuts.jsx';
import { useScenarioEngine } from './hooks/useScenarioEngine';
import { usePedagogyStore } from './store/pedagogyStore';
import { allScenarios, curriculumSequence } from './store/scenarioConfig';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { SystemManagementPage } from './pages/SystemManagementPage';
import { OrganizationManagement } from './pages/OrganizationManagement';
import OperationLogsPage from './pages/OperationLogsPage';
import useAchievementStore from './store/achievementStore';
import './index.css';
import './App.css';

const tabs = [
  {
    id: 'LINEAR',
    name: '线性回归',
    icon: '📈',
    description: '从散点和拟合直线开始，理解损失函数与梯度下降。',
    inCurriculum: true,
    difficulty: 1
  },
  {
    id: 'LOGISTIC',
    name: '逻辑回归',
    icon: '🟠🔵',
    description: '观察分类边界如何移动，理解二分类训练过程。',
    inCurriculum: true,
    difficulty: 1
  },
  {
    id: 'TREE',
    name: '决策树',
    icon: '🌲',
    description: '通过空间切分理解模型容量、泛化与过拟合。',
    inCurriculum: true,
    difficulty: 2
  },
  {
    id: 'NN',
    name: '神经网络',
    icon: '🧠',
    description: '渐进式学习神经网络：数据准备→学习率调参→网络容量→激活函数→过拟合与泛化。',
    inCurriculum: true,
    difficulty: 3
  },
  {
    id: 'LLM',
    name: 'LLM 专题',
    icon: '💬',
    description: '理解大语言模型如何做预训练、指令微调与逐词生成预测。',
    inCurriculum: false,
    difficulty: 3
  },
  {
    id: 'YOLO',
    name: 'YOLO 专题',
    icon: '🎯',
    description: '理解目标检测模型如何学习出框、分类，并在预测时完成 NMS。',
    inCurriculum: false,
    difficulty: 3
  },
];

function App() {
  const [activeTab, setActiveTab] = useState(null);

  // Auth state
  const { isAuthenticated, user, logout } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false); // 'login' | 'register' | 'profile' | 'systemManagement' | 'operationLogs' | null
  const [showTeacherDashboard, setShowTeacherDashboard] = useState(false); // 教师大屏
  const [showLearningStats, setShowLearningStats] = useState(false); // 学习数据中心
  const [showHelp, setShowHelp] = useState(false); // 快捷键帮助
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  // Curriculum mode state
  const [isCurriculumMode, setIsCurriculumMode] = useState(false);
  const [isCurriculumConfirmed, setIsCurriculumConfirmed] = useState(false);
  // 教学模式开关：true = 教学模式（引导式学习），false = 自习模式（自由模式）
  const [isTeachingMode, setIsTeachingMode] = useState(false);
  // null = 未选择模式, false = 自习模式（自由），true = 教学模式（引导）
  const [curriculumSelfStudy, setCurriculumSelfStudy] = useState(null);
  // 追踪是否完成过课程（用于自由探索时仍显示教学助手）
  const [hasCompletedCurriculum, setHasCompletedCurriculum] = useState(false);
  // 追踪是否完成过至少一个章节（用于显示"进入下一章"按钮）
  const [hasCompletedAtLeastOneLab, setHasCompletedAtLeastOneLab] = useState(false);

  const resetScenarioProgress = usePedagogyStore((state) => state.resetScenarioProgress);
  const currentCurriculumIndex = usePedagogyStore((state) => state.currentCurriculumIndex);
  const setCurrentCurriculumIndex = usePedagogyStore((state) => state.setCurrentCurriculumIndex);
  const tutorialStage = usePedagogyStore((state) => state.tutorialStage);
  const completedLabs = usePedagogyStore((state) => state.completedLabs);
  const labDataSummary = usePedagogyStore((state) => state.labDataSummary);
  const completionChoiceMode = usePedagogyStore((state) => state.completionChoiceMode);
  const setCompletionChoiceMode = usePedagogyStore((state) => state.setCompletionChoiceMode);
  const advanceCurriculum = usePedagogyStore((state) => state.advanceCurriculum);
  const resumeSimulation = usePedagogyStore((state) => state.resumeSimulation);

  const hasSelectedExperiment = activeTab !== null;

  // Achievement store state (放在组件顶层，避免 Hooks 顺序变化)
  const achievementXP = useAchievementStore((state) => state.xp);
  const achievementList = useAchievementStore((state) => state.achievements);

  // Derive which labs are unlocked in curriculum mode
  const curriculumUnlockedLabs = useMemo(() => {
    return curriculumSequence.map((entry, idx) => ({
      ...entry,
      unlocked: idx <= currentCurriculumIndex
    }));
  }, [currentCurriculumIndex]);

  // Current curriculum lab ID
  const currentCurriculumLabId = curriculumUnlockedLabs[currentCurriculumIndex]?.labId || null;

  // scenarioEnabled: true when curriculum is in 教学模式 (guided)
  // 神经网络不再有独立的模式选择，直接进入自由模式
  const scenarioEnabled = isCurriculumMode && isCurriculumConfirmed && curriculumSelfStudy;

  // In curriculum mode, force the active tab to follow curriculum progress
  useEffect(() => {
    if (isCurriculumMode && isCurriculumConfirmed && currentCurriculumLabId) {
      setActiveTab(currentCurriculumLabId);
    }
  }, [isCurriculumMode, isCurriculumConfirmed, currentCurriculumLabId]);

  // When curriculum completes, show summary
  useEffect(() => {
    if (tutorialStage === 'SUMMARY') {
      setIsCurriculumMode(false);
      setIsCurriculumConfirmed(false);
      setCurriculumSelfStudy(null);
      setHasCompletedCurriculum(true); // 标记已完成课程
    }
  }, [tutorialStage]);

  // 追踪是否完成过至少一个章节（用于显示"进入下一章"按钮）
  useEffect(() => {
    if (completionChoiceMode) {
      setHasCompletedAtLeastOneLab(true);
    }
  }, [completionChoiceMode]);

  // Build curriculum progress for display
  const curriculumProgress = useMemo(() => {
    return {
      current: currentCurriculumIndex + 1,
      total: curriculumSequence.length,
      entry: curriculumUnlockedLabs[currentCurriculumIndex],
      completedLabs
    };
  }, [currentCurriculumIndex, curriculumUnlockedLabs, completedLabs]);

  // Validate that required data has been placed before allowing "下一步" on data-canvas steps.
  // This is checked by the App-level useScenarioEngine (used by SpotlightOverlay), not by
  // the individual lab's useScenarioEngine, because SpotlightOverlay lives in App.
  const validatePrerequisite = (stepId) => {
    if (stepId === 'lr_step_1_add_points') {
      const pts = labDataSummary?.lrPoints ?? 0;
      if (pts < 2) return '请先在画布上点击添加至少 2 个数据点！';
    }
    if (stepId === 'lg_step_1_add_data') {
      const classes = labDataSummary?.lgClasses ?? 0;
      if (classes < 2) return '请分别用鼠标左键和右键添加两种颜色的数据点！';
    }
    if (stepId === 'lg_step_3_train') {
      const pts = labDataSummary?.lgPoints ?? 0;
      if (pts < 2) return '请先添加至少 2 个数据点！';
    }
    if (stepId === 'dt_step_1_add_data') {
      const classes = labDataSummary?.dtClasses ?? 0;
      if (classes < 2) return '请分别用鼠标左键和右键添加两种颜色的数据点！';
    }
    return null;
  };

  // useScenarioEngine is called with curriculumMode flag
  const {
    currentExperiment,
    currentStep,
    currentStepIndex,
    nextStep,
    isCurriculumMode: engineIsCurriculumMode,
    currentLab,
    curriculumProgress: engineProgress
  } = useScenarioEngine(allScenarios, scenarioEnabled, isCurriculumMode && isCurriculumConfirmed, validatePrerequisite);

  const activeExperiment = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) || null,
    [activeTab]
  );

  const resetNnEntryFlow = () => {
    // 神经网络模式选择已移除，无需重置
    resetScenarioProgress();
  };

  // Completion choice handlers
  const currentLabTitle = curriculumUnlockedLabs[currentCurriculumIndex]?.title || '';
  const hasNextLab = currentCurriculumIndex < curriculumSequence.length - 1;
  const nextLabTitle = hasNextLab ? curriculumSequence[currentCurriculumIndex + 1]?.title : '';

  const handleNextLab = () => {
    // 完成课程，发放所有待发放的 XP
    if (currentCurriculumLabId) {
      useAchievementStore.getState().completeLab(currentCurriculumLabId);
    }
    setCompletionChoiceMode(false);
    setHasCompletedAtLeastOneLab(false); // 重置：进入下一章后，按钮消失直到完成该章节
    setCurriculumSelfStudy(true); // 进入教学模式
    resumeSimulation();
    advanceCurriculum();
  };

  const handleFreeExplore = () => {
    // 退出教学模式时不发放 XP（用户没有完成课程）
    setCompletionChoiceMode(false);
    setCurriculumSelfStudy(false);
    resumeSimulation();
  };

  const handleRestartTutorial = () => {
    // 重启教程不发放 XP
    setCompletionChoiceMode(false);
    setHasCompletedAtLeastOneLab(false); // 重置标志
    // 重新开始教程：只重置教学进度，保留当前章节索引，不退出发教程模式
    resumeSimulation();
    resetScenarioProgress({ keepCurriculumIndex: true });
    // 恢复教学模式状态
    setCurriculumSelfStudy(true);
  };

  const handleSelectExperiment = (tabId) => {
    const selectedTab = tabs.find((tab) => tab.id === tabId);

    // In curriculum mode, only allow clicking the current unlocked lab
    if (isCurriculumMode && isCurriculumConfirmed) {
      if (!selectedTab?.inCurriculum) return;
      const entry = curriculumUnlockedLabs.find(e => e.labId === tabId);
      if (!entry?.unlocked) return; // Locked lab
    }

    // If teaching mode is enabled and not yet in curriculum mode, enter curriculum mode directly
    if (isTeachingMode && !isCurriculumMode) {
      if (!selectedTab?.inCurriculum) {
        resetNnEntryFlow();
        setActiveTab(tabId);
        return;
      }
      resetScenarioProgress();
      setCurriculumSelfStudy(true);
      setIsCurriculumMode(true);
      setIsCurriculumConfirmed(true);
      // Set the curriculum index to the clicked lab's position in the sequence
      const labIndex = curriculumSequence.findIndex(e => e.labId === tabId);
      setCurrentCurriculumIndex(labIndex);
      setActiveTab(tabId);
      return;
    }

    if (tabId !== 'NN' || activeTab !== 'NN') {
      resetNnEntryFlow();
    }
    setActiveTab(tabId);
  };

  const handleBackToExperimentPicker = () => {
    resetNnEntryFlow();
    setActiveTab(null);
  };

  const handleConfirmCurriculum = (selfStudy) => {
    resetScenarioProgress();
    setHasCompletedAtLeastOneLab(false); // 重置标志
    setCurriculumSelfStudy(selfStudy);
    setIsCurriculumMode(true);
    setIsCurriculumConfirmed(true);
    setActiveTab(curriculumSequence[0].labId);
  };

  const handleExitCurriculum = () => {
    setIsCurriculumMode(false);
    setIsCurriculumConfirmed(false);
    setCurriculumSelfStudy(null);
    setHasCompletedAtLeastOneLab(false); // 重置标志
    setActiveTab(null);
    resetScenarioProgress();
  };

  // Curriculum mode summary screen
  const showCurriculumSummary = isCurriculumMode && tutorialStage === 'SUMMARY';

  const renderLab = () => {
    if (!activeTab) return null;
    if (activeTab === 'LINEAR') return <LinearRegressionLab scenarioEnabled={scenarioEnabled} />;
    if (activeTab === 'LOGISTIC') return <LogisticRegressionLab scenarioEnabled={scenarioEnabled} />;
    if (activeTab === 'TREE') return <DecisionTreeLab scenarioEnabled={scenarioEnabled} />;
    if (activeTab === 'NN') {
      return <NeuralNetworkLab scenarioEnabled={scenarioEnabled} />;
    }
    if (activeTab === 'LLM') return <LLMLab scenarioEnabled={isTeachingMode && !isCurriculumMode} />;
    if (activeTab === 'YOLO') return <YOLOLab scenarioEnabled={isTeachingMode && !isCurriculumMode} />;
    return null;
  };

  // 键盘快捷键
  useKeyboardShortcuts({
    onSwitchLab: setActiveTab,
    onToggleTrain: () => {}, // TODO: 连接训练按钮
    onReset: () => {}, // TODO: 连接重置按钮
    onToggle3D: () => {}, // TODO: 连接3D按钮
    onToggleCompanion: () => window.dispatchEvent(new Event('toggle-learning-companion')),
    onShowHelp: () => setShowHelp(prev => !prev),
    currentLab: activeTab
  });

  // Guidance bar shown in both curriculum and single-lab guided mode
  const showGuidanceBar = scenarioEnabled && currentExperiment;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-color)'
      }}
    >
      <header
        className="glass-panel"
        style={{
          margin: '12px 16px',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          zIndex: 100
        }}
      >
        {/* 课程模式下简化 header */}
        {isCurriculumMode && isCurriculumConfirmed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn"
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
              onClick={() => {
                if (window.confirm('确定要退出课程吗？')) {
                  setIsCurriculumMode(false);
                  setIsCurriculumConfirmed(false);
                  setCurriculumSelfStudy(null);
                }
              }}
              title="退出课程"
            >
              ← 退出课程
            </button>
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
              📚 第 {curriculumProgress.current}/{curriculumProgress.total} 课 · {curriculumProgress.entry?.title}
            </span>
          </div>
        ) : (
          /* 非课程模式下显示完整 header */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.8rem' }}>🧠</div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem' }} className="text-gradient">
                  综合 AI 实验室
                </h1>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  先选择基础实验或高级专题，再进入对应交互场景
                </div>
              </div>
            </div>

            {/* User Menu / Auth Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Role badge */}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: user?.role === 'admin' ? 'rgba(239,68,68,0.2)' :
                               user?.role === 'teacher' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)',
                    color: user?.role === 'admin' ? '#fca5a5' :
                           user?.role === 'teacher' ? '#c4b5fd' : '#93c5fd',
                    border: `1px solid ${user?.role === 'admin' ? 'rgba(239,68,68,0.3)' :
                                          user?.role === 'teacher' ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`
                  }}>
                    {user?.role === 'admin' ? '👑 系统管理员' : user?.role === 'teacher' ? '👨‍🏫 教师' : '🎓 学生'}
                  </span>

                  {/* User dropdown */}
                  <button
                    className="btn"
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0,0,0,0.3)'
                    }}
                    onClick={() => setShowAuthModal('profile')}
                    title="个人中心"
                  >
                    <span style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.9rem' }}>{user?.displayName || user?.username}</span>
                  </button>

                  {/* System management for admin */}
                  {user?.role === 'admin' && (
                    <button
                      className="btn"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setShowAuthModal('systemManagement')}
                      title="系统管理"
                    >
                      ⚙️
                    </button>
                  )}

                  {/* Organization management for admin/teacher */}
                  {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <button
                      className="btn"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setShowAuthModal('organizationManagement')}
                      title="组织管理"
                    >
                      🏫
                    </button>
                  )}

                  {/* Operation logs for admin */}
                  {user?.role === 'admin' && (
                    <button
                      className="btn"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setShowAuthModal('operationLogs')}
                      title="操作日志"
                    >
                      📋
                    </button>
                  )}

                  {/* Teacher dashboard for teacher only */}
                  {user?.role === 'teacher' && (
                    <button
                      className="btn"
                      style={{ padding: '8px 12px' }}
                      onClick={() => setShowTeacherDashboard(true)}
                      title="教师大屏"
                    >
                      🧭
                    </button>
                  )}

                  {/* Logout */}
                  <button
                    className="btn"
                    style={{
                  padding: '8px 12px',
                  color: '#fca5a5',
                  borderColor: 'rgba(239,68,68,0.3)'
                }}
                onClick={() => {
                  if (window.confirm('确定要退出登录吗？')) {
                    logout();
                  }
                }}
                title="退出登录"
              >
                🚪
              </button>
            </div>
          ) : (
            <button
              className="btn"
              style={{ padding: '8px 16px' }}
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal('login');
              }}
            >
              登录
            </button>
          )}
        </div>
        </>
        )}

        {hasSelectedExperiment ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {isCurriculumMode && (
              <button
                className="btn"
                style={{ color: '#fbbf24', padding: '8px 14px', borderColor: 'rgba(251,191,36,0.3)' }}
                onClick={handleExitCurriculum}
              >
                退出课程
              </button>
            )}
            <button
              className="btn"
              style={{ color: 'var(--text-secondary)', padding: '8px 14px' }}
              onClick={handleBackToExperimentPicker}
            >
              {isCurriculumMode ? '返回实验选择' : '返回实验选择'}
            </button>
            {tabs.map((tab) => {
              // In curriculum mode, dim locked tabs
              const curriculumEntry = curriculumUnlockedLabs.find(e => e.labId === tab.id);
              const isLocked = isCurriculumMode && (!tab.inCurriculum || !curriculumEntry?.unlocked);
              const isActive = activeTab === tab.id;
              const lockTitle = !tab.inCurriculum
                ? '高级专题不纳入基础课程进度，请先退出课程模式后学习'
                : isLocked
                  ? `完成第 ${curriculumEntry ? curriculumSequence.indexOf(curriculumEntry) + 1 : ''} 课后解锁`
                  : '';
              return (
                <button
                  key={tab.id}
                  className="btn"
                  style={{
                    background: isActive ? 'rgba(0,0,0,0.4)' : 'transparent',
                    borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: isActive ? '#fff' : isLocked ? 'rgba(255,255,255,0.3)' : 'var(--text-secondary)',
                    opacity: isActive ? 1 : (isLocked ? 0.5 : 0.72),
                    boxShadow: isActive ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none',
                    padding: '8px 12px',
                    fontSize: '0.88rem',
                    cursor: isLocked ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => handleSelectExperiment(tab.id)}
                  title={isLocked ? lockTitle : ''}
                >
                  <span style={{ marginRight: '6px' }}>{tab.icon}</span>
                  {tab.name}
                  {isLocked && ' 🔒'}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {/* Curriculum Progress Bar */}
      {isCurriculumMode && isCurriculumConfirmed && !showCurriculumSummary && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(251,191,36,0.12) 0%, rgba(56,189,248,0.08) 100%)',
            borderBottom: '1px solid rgba(251,191,36,0.2)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            color: '#fbbf24'
          }}
        >
          <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            📚 课程进度：第 {curriculumProgress.current}/{curriculumProgress.total} 课
          </span>
          <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
            {curriculumUnlockedLabs.map((entry, idx) => {
              const isDone = completedLabs.includes(entry.labId);
              const isCurrent = idx === currentCurriculumIndex;
              return (
                <div
                  key={entry.labId}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: isDone
                      ? '#22c55e'
                      : isCurrent
                        ? '#fbbf24'
                        : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.3s',
                    boxShadow: isCurrent ? '0 0 8px rgba(251,191,36,0.5)' : 'none'
                  }}
                  title={`${entry.icon} ${entry.title} ${isDone ? '✓' : isCurrent ? '(进行中)' : '(未开始)'}`}
                />
              );
            })}
          </div>
          <span style={{ fontSize: '0.85rem', opacity: 0.85 }}>
            {curriculumProgress.entry?.icon} {curriculumProgress.entry?.title}
          </span>
        </div>
      )}

      {/* Guidance bar for active guided session */}
      {showGuidanceBar && (
        <div
          style={{
            background: 'rgba(255, 215, 0, 0.08)',
            borderBottom: '1px solid rgba(255, 215, 0, 0.18)',
            padding: '8px 24px',
            color: '#fbbf24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <strong>
              {isCurriculumMode
                ? `📚 ${curriculumProgress.entry?.icon} ${curriculumProgress.entry?.title}：`
                : `🎬 ${currentExperiment.title}`}
            </strong>
            <span style={{ marginLeft: '12px', fontSize: '0.85rem', opacity: 0.8 }}>
              {currentExperiment.description}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {isCurriculumMode
              ? `${currentCurriculumIndex + 1} / ${currentExperiment?.steps?.length ?? curriculumSequence.length}`
              : `${currentStepIndex + 1} / ${currentExperiment?.steps?.length ?? 1}`
            }
          </div>
        </div>
      )}

      {!hasSelectedExperiment ? (
        <main className="experiment-picker-shell">
          <section className="experiment-picker-panel glass-panel">
            <div className="experiment-picker-copy">
              <span className="experiment-picker-kicker">Experiment Flow</span>
              <h2>先选择你想进入的实验或专题</h2>
              <p>
                首页不再直接进入某个实验，而是先从下方选择基础实验或高级专题。进入后仍可在顶部切换，方便课堂演示、自由探索与专题讲解。
              </p>
            </div>

            {/* Curriculum entry — toggle switch on homepage */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '20px',
              background: 'rgba(251,191,36,0.06)',
              borderRadius: '16px',
              border: '1px solid rgba(251,191,36,0.25)',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.4rem' }}>📚</span>
                <span style={{ fontSize: '1rem', fontWeight: '600', color: '#f8fafc' }}>基础课程学习</span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(148,163,184,0.6)' }}>
                  依次完成基础课程 5 个实验
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    color: !isTeachingMode ? '#22c55e' : 'rgba(148,163,184,0.4)',
                    fontWeight: !isTeachingMode ? '600' : '400',
                    transition: 'color 0.3s'
                  }}>自习模式</span>

                  <button
                    type="button"
                    onClick={() => setIsTeachingMode(!isTeachingMode)}
                    style={{
                      position: 'relative',
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isTeachingMode ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(148,163,184,0.3)',
                      transition: 'background 0.3s',
                      outline: 'none'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: isTeachingMode ? '22px' : '2px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.3s',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                    }} />
                  </button>

                  <span style={{
                    fontSize: '0.85rem',
                    color: isTeachingMode ? '#6366f1' : 'rgba(148,163,184,0.4)',
                    fontWeight: isTeachingMode ? '600' : '400',
                    transition: 'color 0.3s'
                  }}>教学模式</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{
                  fontSize: '0.8rem',
                  color: 'rgba(148,163,184,0.6)',
                  margin: 0,
                  flex: 1,
                  minWidth: '200px'
                }}>
                  {isTeachingMode
                    ? '💡 教学模式：基础课程按章节引导；LLM 和 YOLO 专题也会进入同款分步教学模式。'
                    : '🎈 自习模式：自由探索基础实验与高级专题，不显示分步聚光灯引导。'}
                </p>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', flexShrink: 0 }}
                  onClick={() => handleConfirmCurriculum(isTeachingMode)}
                >
                  开始{isTeachingMode ? '教学模式' : '自习模式'}
                </button>
              </div>
            </div>

            {/* Individual lab cards */}
            <div className="experiment-grid">
              {tabs.map((tab) => {
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className="experiment-card"
                    onClick={() => handleSelectExperiment(tab.id)}
                    style={{
                      position: 'relative',
                      border: isTeachingMode && tab.inCurriculum ? '2px solid var(--accent-blue)' : undefined,
                      boxShadow: isTeachingMode && tab.inCurriculum ? '0 0 12px rgba(99, 102, 241, 0.3)' : undefined,
                    }}
                  >
                    {isTeachingMode && tab.inCurriculum && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        fontSize: '0.7rem',
                        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: '600'
                      }}>
                        教学模式
                      </div>
                    )}
                    {!tab.inCurriculum && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        fontSize: '0.7rem',
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: '600'
                      }}>
                        高级专题
                      </div>
                    )}
                    <div className="experiment-card-icon">{tab.icon}</div>
                    <div className="experiment-card-name">{tab.name}</div>
                    {/* 难度星级 */}
                    <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                      {[1, 2, 3].map((star) => (
                        <span key={star} style={{ fontSize: '0.65rem', color: star <= tab.difficulty ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}>★</span>
                      ))}
                      <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', marginLeft: '4px' }}>
                        {tab.difficulty === 1 ? '入门' : tab.difficulty === 2 ? '进阶' : '高级'}
                      </span>
                    </div>
                    <div className="experiment-card-desc">{tab.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        hasSelectedExperiment && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <main
              style={{
                flex: 1,
                padding: '0 16px 16px',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {renderLab()}
            </main>
          </div>
        )
      )}

      {/* Pedagogy Sidebar — rendered at same level as modals for proper z-index stacking */}
      {/* Only render App-level sidebar when NOT in a Lab tab during curriculum mode */}
      {(scenarioEnabled || (hasCompletedCurriculum && hasSelectedExperiment)) && (
        activeTab === 'NN' && (
          <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 10003 }}>
            <PedagogySidebar
              currentExperiment={currentExperiment || { title: '反思环节', steps: [] }}
              currentStepIndex={currentStepIndex}
              labId="NN"
            />
          </div>
        )
      )}

      {/* Curriculum Summary — rendered when tutorialStage reaches SUMMARY (useEffect resets isCurriculumMode to false) */}
      {tutorialStage === 'SUMMARY' && (
        <main className="experiment-picker-shell">
          <section className="experiment-picker-panel glass-panel">
            <div className="experiment-picker-copy">
              <span className="experiment-picker-kicker" style={{ color: '#22c55e', background: 'rgba(34,197,94,0.12)' }}>🎉</span>
              <h2>课程全部完成！</h2>
              <p>
                恭喜你完成了从线性回归到故障实验台的全部基础课程学习旅程！
                {curriculumSelfStudy
                  ? '你已经完成了引导式学习，可以自由操作任意实验室，并继续学习 LLM、YOLO 等高级专题。'
                  : '你已经完成了自由探索，可以尝试挑战教学模式，系统会继续引导你完成全部 5 个基础实验。'}
              </p>
            </div>

            <div className="guide-confirm-panel">
              {curriculumSequence.map((entry) => (
                <div
                  key={entry.labId}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(34,197,94,0.25)',
                    background: 'rgba(34,197,94,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>{entry.icon}</span>
                  <span style={{ color: '#22c55e', fontSize: '0.95rem' }}>
                    ✓ {entry.title} 已完成
                  </span>
                </div>
              ))}

              <div className="guide-confirm-actions">
                <button className="btn btn-primary" onClick={handleExitCurriculum}>
                  {curriculumSelfStudy ? '开始自由探索' : '继续探索其他实验'}
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* NN mode picker and guide confirm removed - now goes directly to lab */}

      {scenarioEnabled && (
        <>
          {/* Only render App-level spotlight when NOT in a Lab tab during curriculum mode */}
          {/* In curriculum mode, Lab tabs (LINEAR, LOGISTIC, etc.) have their own Lab-level spotlight */}
          {activeTab === 'NN' && (
            <SpotlightOverlay onNextStep={nextStep} />
          )}
          {completionChoiceMode && (
            <CompletionChoiceModal
              currentLabTitle={currentLabTitle}
              hasNextLab={hasNextLab}
              nextLabTitle={nextLabTitle}
              onNextLab={handleNextLab}
              onFreeExplore={handleFreeExplore}
              onRestartTutorial={handleRestartTutorial}
            />
          )}
        </>
      )}

      {/* 浮动"进入下一章"按钮：完成章节后选择自由探索时仍可进入下一章 */}
      {hasCompletedAtLeastOneLab && !completionChoiceMode && hasNextLab && isCurriculumMode && isCurriculumConfirmed && (
        <button
          id="next-lab-float-btn"
          className="btn btn-primary"
          onClick={handleNextLab}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 10002,
            padding: '12px 24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>📚</span>
          <span>进入下一章：{nextLabTitle}</span>
          <span>→</span>
        </button>
      )}

            {/* Auth Modals */}
      {showAuthModal === 'login' && (
        <LoginPage
          onSwitchToRegister={() => {
            setAuthMode('register');
            setShowAuthModal('register');
          }}
          onClose={() => setShowAuthModal(null)}
        />
      )}

      {showAuthModal === 'register' && (
        <RegisterPage
          onSwitchToLogin={() => {
            setAuthMode('login');
            setShowAuthModal('login');
          }}
          onClose={() => setShowAuthModal(null)}
        />
      )}

      {showAuthModal === 'profile' && (
        <ProfilePage onClose={() => setShowAuthModal(null)} />
      )}

      {showAuthModal === 'systemManagement' && (
        <SystemManagementPage onClose={() => setShowAuthModal(null)} />
      )}

      {showAuthModal === 'organizationManagement' && (
        <div className="org-fullscreen">
          <button
            className="teacher-dashboard-close"
            onClick={() => setShowAuthModal(null)}
            title="关闭"
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 10001 }}
          >
            ✕
          </button>
          <OrganizationManagement />
        </div>
      )}

      {showAuthModal === 'operationLogs' && (
        <div className="org-fullscreen">
          <button
            className="teacher-dashboard-close"
            onClick={() => setShowAuthModal(null)}
            title="关闭"
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 10001 }}
          >
            ✕
          </button>
          <OperationLogsPage />
        </div>
      )}

      {/* Teacher Dashboard */}
      {showTeacherDashboard && (
        <div className="teacher-dashboard-overlay">
          <button
            className="teacher-dashboard-close"
            onClick={() => setShowTeacherDashboard(false)}
            title="关闭"
          >
            ✕
          </button>
          <TeacherDashboardLab />
        </div>
      )}

      {/* 成就系统 - 游戏化学习 (仅登录用户显示) */}
      <AchievementSystem
        xp={achievementXP}
        achievements={achievementList}
        currentLab={activeTab}
        onStatsClick={() => setShowLearningStats(true)}
      />

      {/* 学习数据中心 (仅登录用户显示) */}
      <LearningStats
        isVisible={showLearningStats}
        onClose={() => setShowLearningStats(false)}
      />

      {/* 键盘快捷键帮助 */}
      <KeyboardShortcutsHelp
        isVisible={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* 新手引导 Tour */}
      <NewUserTour />
    </div>
  );
}

export default App;
