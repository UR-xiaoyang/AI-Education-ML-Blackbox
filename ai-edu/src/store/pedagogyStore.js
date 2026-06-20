import { create } from 'zustand';

export const TutorialStages = {
  INTRO: 'INTRO',
  LEARNING_RATE_TRAP: 'LEARNING_RATE_TRAP',
  OVERFITTING_OBSERVATION: 'OVERFITTING_OBSERVATION',
  CHALLENGE_MODE: 'CHALLENGE_MODE',
  SUMMARY: 'SUMMARY'
};

export const usePedagogyStore = create((set, get) => ({
  tutorialStage: TutorialStages.LEARNING_RATE_TRAP,
  isSimulationPaused: false,
  studentAnswers: [],

  // Reflection state - managed by sidebar instead of modal
  pendingReflections: [],      // [{ questionText, minChars, labId, stepId }] - 待回答的反思问题
  reflectionModeActive: false,  // 是否在统一回答反思模式
  currentReflectionIndex: 0,   // 当前正在回答的反思索引
  reportContent: null,         // Generated experiment report content

  dataset: [],
  setDataset: (newData) => set({ dataset: newData }),

  useRelu: true,
  setUseRelu: (value) => set({ useRelu: value }),

  unlocks: {
    showLearningRate: false,
    showHiddenLayers: true,
    showActivation: false,
    showRegularization: false
  },

  currentExperimentIndex: 0,
  currentStepIndex: 0,
  activeInterceptorRule: null,
  activeSetupAction: null,

  // Curriculum progress state
  currentCurriculumIndex: 0,
  currentLabStepIndex: 0,
  isCurriculumMode: false,
  completedLabs: [],

  setCurriculumMode: (enabled) => set({ isCurriculumMode: enabled }),
  setCurrentCurriculumIndex: (index) => set({ currentCurriculumIndex: index }),
  setCurrentLabStepIndex: (index) => set({ currentLabStepIndex: index }),
  advanceCurriculum: () => set((state) => ({
    currentCurriculumIndex: state.currentCurriculumIndex + 1,
    currentLabStepIndex: 0,
    currentExperimentIndex: 0,
    currentStepIndex: 0,
    // Clear pending reflections when switching labs
    pendingReflections: [],
    reflectionModeActive: false,
    currentReflectionIndex: 0,
  })),
  markLabCompleted: (labId) => set((state) => ({
    completedLabs: [...state.completedLabs, labId]
  })),

  // Lightweight summary of current lab's data — used by the App-level
  // useScenarioEngine to validate prerequisites without needing to reach
  // into individual lab component state.
  // Shape: { lrPoints: number, lrClasses: number, lgPoints: number, lgClasses: number, dtPoints: number, dtClasses: number }
  labDataSummary: null,
  setLabDataSummary: (summary) => set({ labDataSummary: summary }),

  // Completion choice modal state
  completionChoiceMode: false,
  setCompletionChoiceMode: (enabled) => set({ completionChoiceMode: enabled }),
  handleCompletionChoice: (action) => {
    set({ completionChoiceMode: false });
    // The actual action handling is done in the component that calls this
  },

  spotlight: {
    isActive: false,
    targetId: null,         // Single target ID (for backward compatibility)
    targetIds: [],          // Array of target IDs (for multi-spotlight support)
    message: '',
    requireAction: false,
    reflectionConfig: null,
    prerequisiteWarning: null
  },

  pauseSimulation: () => set({ isSimulationPaused: true }),
  resumeSimulation: () => set({ isSimulationPaused: false }),
  advanceStage: (nextStage) => set({ tutorialStage: nextStage }),
  advanceStep: () => set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),
  jumpToStep: (stepIndex) => set({ currentStepIndex: stepIndex }),
  setInterceptorRule: (rule) => set({ activeInterceptorRule: rule }),
  setSetupAction: (action) => set({ activeSetupAction: action }),

  setSpotlight: (config) => set((state) => ({
    spotlight: {
      ...state.spotlight,
      ...config,
      isActive: true,
      // Preserve any existing prerequisite warning — it should only be cleared
      // by validatePrerequisite validation (when nextStep is called again with
      // a changed step), NOT by setSpotlight overwriting it with undefined.
      prerequisiteWarning: config.prerequisiteWarning !== undefined
        ? config.prerequisiteWarning
        : state.spotlight.prerequisiteWarning
    }
  })),

  clearSpotlight: () => set((state) => ({
    spotlight: {
      ...state.spotlight,
      isActive: false,
      targetId: null,
      targetIds: [],
      message: '',
      prerequisiteWarning: null
    }
  })),

  setPrerequisiteWarning: (msg) => set((state) => ({
    spotlight: { ...state.spotlight, prerequisiteWarning: msg }
  })),

  resetScenarioProgress: (options = {}) => set((state) => ({
    tutorialStage: TutorialStages.LEARNING_RATE_TRAP,
    isSimulationPaused: false,
    currentExperimentIndex: 0,
    currentStepIndex: 0,
    activeInterceptorRule: null,
    activeSetupAction: null,
    // 选项性保留当前章节索引（用于"重新开始教程"按钮）
    currentCurriculumIndex: options.keepCurriculumIndex ? state.currentCurriculumIndex : 0,
    currentLabStepIndex: 0,
    // 选项性保留教学模式状态
    isCurriculumMode: options.keepCurriculumMode !== undefined ? options.keepCurriculumMode : state.isCurriculumMode,
    completedLabs: options.keepCurriculumIndex ? state.completedLabs : [],
    labDataSummary: null,
    completionChoiceMode: false,
    pendingReflections: [],
    reflectionModeActive: false,
    currentReflectionIndex: 0,
    reportContent: null,
    spotlight: {
      ...state.spotlight,
      isActive: false,
      targetId: null,
      targetIds: [],
      message: '',
      requireAction: false,
      reflectionConfig: null
    }
  })),

  addStudentAnswer: (answerRecord) => set((state) => ({
    studentAnswers: [...state.studentAnswers, answerRecord]
  })),

  unlockFeature: (featureKey) => set((state) => ({
    unlocks: { ...state.unlocks, [featureKey]: true }
  })),

  // Add a pending reflection question (called when encountering a REFLECTION_SUBMIT step)
  addPendingReflection: (config, labId, stepId) => {
    if (!config || !config.questionText) {
      console.error('[🟡 Store] ❌ addPendingReflection: config无效或questionText为空');
      return;
    }
    set((state) => {
      return {
        pendingReflections: [...state.pendingReflections, {
          questionText: config.questionText,
          minChars: config.minChars || 15,
          type: config.type || 'text',
          options: config.options || [],
          explanation: config.explanation || '',
          labId: labId,
          stepId: stepId
        }]
      };
    });
  },

  // Start the reflection answering mode (after experiment completion)
  startReflectionMode: () => {
    set({
      reflectionModeActive: true,
      currentReflectionIndex: 0
    });
  },

  // Submit the current pending reflection answer
  submitPendingReflection: (answer) => {
    const state = get();
    const { pendingReflections, currentReflectionIndex, studentAnswers } = state;

    if (currentReflectionIndex >= pendingReflections.length) return;

    const currentReflection = pendingReflections[currentReflectionIndex];
    const newAnswer = {
      stage: 'SCENARIO_REFLECTION',
      question: currentReflection.questionText,
      answer: answer.trim(),
      labId: currentReflection.labId,
      stepId: currentReflection.stepId,
      timestamp: new Date().toISOString()
    };

    // Check if there are more reflections to answer
    if (currentReflectionIndex >= pendingReflections.length - 1) {
      // All reflections answered - end reflection mode and show completion modal
      set({
        studentAnswers: [...studentAnswers, newAnswer],
        reflectionModeActive: false,
        currentReflectionIndex: 0,
        pendingReflections: [],
        completionChoiceMode: true
      });
      return true; // Return true to indicate all reflections are done
    } else {
      // Move to next reflection
      set({
        studentAnswers: [...studentAnswers, newAnswer],
        currentReflectionIndex: currentReflectionIndex + 1
      });
      return false;
    }
  },

  // Get the current pending reflection
  getCurrentPendingReflection: () => {
    const state = get();
    const { pendingReflections, currentReflectionIndex } = state;
    return pendingReflections[currentReflectionIndex] || null;
  },

  // Get total pending reflections count
  getPendingReflectionsCount: () => {
    const state = get();
    return state.pendingReflections.length;
  },

  // Clear all pending reflections without answering
  clearPendingReflections: () => set({
    pendingReflections: [],
    reflectionModeActive: false,
    currentReflectionIndex: 0
  }),

  // 本地生成简单报告（当 AI 不可用时使用）
  generateLocalReport: () => {
    const state = get();
    const { studentAnswers, completedLabs } = state;

    const labTitles = {
      'LINEAR': '线性回归',
      'LOGISTIC': '逻辑回归',
      'TREE': '决策树',
      'DT': '决策树',
      'NN': '神经网络',
      'FAULT': '故障实验台'
    };

    const answersByLab = {};
    studentAnswers.forEach(answer => {
      const labId = answer.labId || 'NN';
      if (!answersByLab[labId]) {
        answersByLab[labId] = [];
      }
      answersByLab[labId].push(answer);
    });

    const now = new Date().toLocaleString('zh-CN');
    let report = `=====================================\n`;
    report += `        AI 实验室学习实验报告\n`;
    report += `=====================================\n`;
    report += `生成时间：${now}\n`;
    report += `=====================================\n\n`;

    if (completedLabs && completedLabs.length > 0) {
      report += `【已完成的实验模块】\n`;
      completedLabs.forEach(labId => {
        report += `  • ${labTitles[labId] || labId}\n`;
      });
      report += `\n`;
    }

    report += `【反思记录】\n`;
    report += `总计反思题：${studentAnswers.length} 题\n\n`;

    Object.keys(answersByLab).forEach(labId => {
      const labAnswers = answersByLab[labId];
      report += `--------------------------------------\n`;
      report += `【${labTitles[labId] || labId}】\n`;
      report += `--------------------------------------\n\n`;

      labAnswers.forEach((answer, index) => {
        const question = answer.question || answer.questionText || '';
        report += `问题 ${index + 1}：\n${question}\n\n`;
        report += `你的回答：\n${answer.answer}\n\n`;
      });
    });

    report += `=====================================\n`;
    report += `          报告结束\n`;
    report += `=====================================\n`;

    set({ reportContent: report });
    return report;
  },

  // Generate AI-powered experiment report
  generateReport: () => {
    const state = get();
    const { studentAnswers, completedLabs, labDataSummary } = state;

    // 如果没有答案，使用本地生成
    if (studentAnswers.length === 0) {
      const report = "暂无实验记录，无法生成报告。";
      set({ reportContent: report });
      return Promise.resolve(report);
    }

    // 检查是否已登录
    const authData = localStorage.getItem('ai-edu-auth');
    const authState = authData ? JSON.parse(authData) : null;
    const token = authState?.state?.token;

    // 如果已登录且有 token，调用 AI 生成报告
    if (token) {
      return fetch('/api/ai-chat/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          studentAnswers,
          completedLabs,
          labDataSummary
        })
      })
        .then(res => {
          if (!res.ok) throw new Error(`生成报告失败: ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.success && data.report) {
            set({ reportContent: data.report });
            return data.report;
          } else {
            throw new Error(data.error || '报告格式错误');
          }
        })
        .catch(err => {
          console.warn('AI 报告生成失败，使用本地报告:', err);
          return get().generateLocalReport();
        });
    } else {
      // 未登录，使用本地生成
      console.info('用户未登录，使用本地报告生成');
      return Promise.resolve(get().generateLocalReport());
    }
  },

  // Download report as a text file
  downloadReport: async () => {
    const state = get();
    let report = state.reportContent;

    // 如果没有缓存的报告，先生成
    if (!report) {
      report = await state.generateReport();
    }

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI实验室实验报告_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}));
