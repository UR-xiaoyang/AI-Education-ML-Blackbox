import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';

/**
 * ============================================================
 * 决策树 5 段式引导剧本 - 状态机实现
 * ============================================================
 *
 * 设计原则：
 * 1. 状态与事件分离 - 状态只存储当前阶段，事件驱动转换
 * 2. 清晰的过渡条件 - 每个 step 有明确的触发条件
 * 3. 受控组件模式 - 通过 props 控制外部状态 (maxDepth, mode)
 *
 * 状态流转：
 *   MAKE_DATA → ONE_CUT → OVERFITTING → INFERENCE → PRUNING → COMPLETE
 */

// ============================================================
// 类型定义
// ============================================================

export const DTGuideStep = Object.freeze({
  MAKE_DATA: 'MAKE_DATA',
  ONE_CUT: 'ONE_CUT',
  OVERFITTING: 'OVERFITTING',
  INFERENCE: 'INFERENCE',
  PRUNING: 'PRUNING',
  COMPLETE: 'COMPLETE'
});

// Step 配置接口
interface StepConfig {
  id: string;
  guidanceText: string;
  targetIds: string[];
  sliderLocked: boolean;
  sliderForceValue: number | null;
  modeToggleLocked: boolean;
  targetMode: string | null;
  trigger: 'dataCount' | 'nextButton' | 'sliderMax' | 'inferencePoint' | 'sliderValue' | 'modeSwitch' | 'reflection' | 'none';
  triggerThreshold?: number;
  allowNextButton: boolean;
  reflectionQuestion?: {
    questionText: string;
    minChars?: number;
  };
}

// Step 配置表 - 6 个教学场景 + 3 道反思题
// ============================================================

export const DTGuideSteps: StepConfig[] = [
  {
    id: DTGuideStep.MAKE_DATA,
    guidanceText: '欢迎来到决策树实验室！首先，请你在左侧画布上，随手点几下，制造一些橙色和蓝色的"阵营"。',
    targetIds: ['dt-graph-canvas'],
    sliderLocked: true,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'dataCount',
    triggerThreshold: 5,
    allowNextButton: true
  },
  {
    id: DTGuideStep.ONE_CUT,
    guidanceText: '现在，我们将最大深度设置为 1。看！算法像切蛋糕一样横竖切了一刀。想一想，它为什么切在这里？因为这一刀能让两边的颜色最"纯粹"。',
    targetIds: ['dt-graph-canvas', 'dt-actual-depth'],
    sliderLocked: true,
    sliderForceValue: 1,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'nextButton',
    allowNextButton: true
  },
  // 反思题 1
  {
    id: 'DT_REFLECTION_1',
    guidanceText: '💭 思考题：算法在选择"从哪里切"的时候，背后的判断标准是什么？',
    targetIds: ['dt-graph-canvas'],
    sliderLocked: true,
    sliderForceValue: 1,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'reflection',
    allowNextButton: false
  },
  {
    id: DTGuideStep.OVERFITTING,
    guidanceText: '只有一刀似乎分不干净？现在，请将滑块拉到最大！看看那些为了迎合单个孤立点而切出来的"小方块"，模型是不是在"死记硬背"？',
    targetIds: ['dt-graph-canvas', 'dt-slider-max-depth'],
    sliderLocked: false,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'sliderMax',
    triggerThreshold: 4,
    allowNextButton: false
  },
  {
    id: 'SWITCH_MODE',
    guidanceText: '死记硬背的模型能考高分吗？让我们进入【预测推理】模式。请点击切换到预测推理。',
    targetIds: ['dt-btn-mode-toggle'],
    sliderLocked: true,
    sliderForceValue: null,
    modeToggleLocked: false,
    targetMode: 'INFERENCE',
    trigger: 'modeSwitch',
    triggerThreshold: 0,
    allowNextButton: false
  },
  {
    id: DTGuideStep.INFERENCE,
    guidanceText: '成功切换到预测推理模式！现在，请在画布上放置一个测试点，看看模型在复杂区域的表现。',
    targetIds: ['dt-graph-canvas'],
    sliderLocked: true,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: 'INFERENCE',
    trigger: 'inferencePoint',
    allowNextButton: false
  },
  // 反思题 2
  {
    id: 'DT_REFLECTION_2',
    guidanceText: '💭 观察题：把测试点放到过拟合的小方块区域，模型会怎么预测？',
    targetIds: ['dt-graph-canvas'],
    sliderLocked: true,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'reflection',
    allowNextButton: false
  },
  {
    id: DTGuideStep.PRUNING,
    guidanceText: '为了不让模型死记硬背，我们需要限制它的容量。现在，把深度滑块退回到 2 看看。恭喜你掌握了"剪枝"的奥秘！',
    targetIds: ['dt-slider-max-depth'],
    sliderLocked: false,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'sliderValue',
    triggerThreshold: 2,
    allowNextButton: false
  },
  // 反思题 3
  {
    id: 'DT_REFLECTION_3',
    guidanceText: '💭 总结题：剪枝后的模型虽然"考试"分数可能降低，但它的泛化能力（举一反三的能力）是变强了还是变弱了？',
    targetIds: ['dt-slider-max-depth'],
    sliderLocked: false,
    sliderForceValue: null,
    modeToggleLocked: true,
    targetMode: null,
    trigger: 'reflection',
    allowNextButton: false
  }
];

// ============================================================
// Hook 接口
// ============================================================

interface UseDecisionTreeGuideOptions {
  enabled: boolean;
  points: Array<{ x: number; y: number; label: number }>;
  mode: 'TRAIN' | 'INFERENCE';
  maxDepth: number;
  onMaxDepthChange: (value: number) => void;
  onModeChange: (mode: 'TRAIN' | 'INFERENCE') => void;
}

interface GuideReturn {
  // 状态
  currentStepIndex: number;
  isGuideActive: boolean;
  isComplete: boolean;

  // 配置（用于受控组件禁用/锁定）
  sliderConfig: { locked: boolean; forceValue: number | null };
  modeConfig: { locked: boolean };

  // 反思提交处理器（供 TutorialModal 调用）
  handleReflectionSubmit: (answer: string) => void;

  // 事件报告函数（解耦业务逻辑）
  handleDataChange: (pointCount: number) => void;
  handleDepthChange: (newDepth: number) => void;
  handleModeChange: (newMode: string) => void;
  handleInferencePoint: () => void;
  handleNextButton: () => void;

  // 重置
  reset: () => void;
}

// ============================================================
// 状态机 Hook 实现
// ============================================================

export const useDecisionTreeGuide = ({
  enabled,
  points,
  mode,
  maxDepth,
  onMaxDepthChange,
  onModeChange
}: UseDecisionTreeGuideOptions): GuideReturn => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // 用于同步跟踪 mode 变化的 ref（解决 React state 延迟更新的问题）
  const modeRef = useRef(mode);

  // Store actions
  const setSpotlight = usePedagogyStore(s => s.setSpotlight);
  const clearSpotlight = usePedagogyStore(s => s.clearSpotlight);
  const addStudentAnswer = usePedagogyStore(s => s.addStudentAnswer);

  // 当前步骤
  const currentStep = isComplete ? null : DTGuideSteps[stepIndex];

  // 计算是否允许进入下一步
  const canProceed = useCallback((step: StepConfig): boolean => {
    switch (step.trigger) {
      case 'dataCount':
        return points.length >= (step.triggerThreshold || 5);
      case 'nextButton':
        return true; // 由用户点击触发
      case 'sliderMax':
        return maxDepth >= (step.triggerThreshold || 4);
      case 'sliderValue':
        return maxDepth === step.triggerThreshold;
      case 'modeSwitch':
        return mode === step.targetMode;
      case 'inferencePoint':
        return modeRef.current === 'INFERENCE' && step.targetMode === 'INFERENCE';
      case 'reflection':
        return false; // 需要用户提交反思答案
      default:
        return false;
    }
  }, [points.length, maxDepth, mode]);

  // 进入下一步
  const goToNextStep = useCallback(() => {
    if (isComplete) return;

    const nextIndex = stepIndex + 1;

    if (nextIndex >= DTGuideSteps.length) {
      // 引导完成
      setIsComplete(true);
      clearSpotlight();
      return;
    }

    const nextStep = DTGuideSteps[nextIndex];
    setStepIndex(nextIndex);

    // 执行下一步的强制设置
    if (nextStep.sliderForceValue !== null) {
      onMaxDepthChange(nextStep.sliderForceValue);
    }
    // 注意：不自动切换模式，让用户自己点击按钮
  }, [isComplete, stepIndex, clearSpotlight, onMaxDepthChange]);

  // 检查并尝试自动转换
  const checkAutoTransition = useCallback(() => {
    if (!enabled || isComplete || !currentStep) return;
    if (currentStep.allowNextButton) return; // 需要用户点击
    if (currentStep.trigger === 'modeSwitch') return; // 需要用户切换模式
    if (canProceed(currentStep)) {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, canProceed, goToNextStep]);

  // 同步 modeRef（用于 handleInferencePoint 在 state 更新前获取当前模式）
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ============================================================
  // Spotlight 更新
  // ============================================================

  useEffect(() => {
    if (!enabled || isComplete || !currentStep) {
      clearSpotlight();
      return;
    }

    // 对于 'reflection' 触发器，guidanceText 就是反思问题
    const reflectionConfig = currentStep.trigger === 'reflection'
      ? { questionText: currentStep.guidanceText, minChars: 15 }
      : currentStep.reflectionQuestion || null;

    setSpotlight({
      targetIds: currentStep.targetIds,
      message: currentStep.guidanceText,
      requireAction: !currentStep.allowNextButton && currentStep.trigger !== 'none',
      reflectionConfig,
      currentStepId: currentStep.id
    });
  }, [enabled, isComplete, currentStep?.id, setSpotlight, clearSpotlight]);

  // ============================================================
  // 事件处理函数（供外部调用）
  // ============================================================

  const handleDataChange = useCallback((pointCount: number) => {
    if (!enabled || isComplete || !currentStep) return;
    if (currentStep.trigger === 'dataCount' && pointCount >= (currentStep.triggerThreshold || 5)) {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, goToNextStep]);

  const handleDepthChange = useCallback((newDepth: number) => {
    if (!enabled || isComplete || !currentStep) return;

    if (currentStep.trigger === 'sliderMax' && newDepth >= (currentStep.triggerThreshold || 4)) {
      goToNextStep();
    } else if (currentStep.trigger === 'sliderValue' && newDepth === currentStep.triggerThreshold) {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, goToNextStep]);

  const handleModeChange = useCallback((newMode: string) => {
    // 同步更新 modeRef，解决 React state 延迟问题
    modeRef.current = newMode as 'TRAIN' | 'INFERENCE';
    if (!enabled || isComplete || !currentStep) return;
    // 当用户切换到目标模式时触发
    if (currentStep.trigger === 'modeSwitch' && currentStep.targetMode && newMode === currentStep.targetMode) {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, goToNextStep]);

  const handleInferencePoint = useCallback(() => {
    if (!enabled || isComplete || !currentStep) return;
    // 使用 modeRef.current 解决 React state 延迟更新问题
    if (currentStep.trigger === 'inferencePoint' && modeRef.current === 'INFERENCE') {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, goToNextStep]);

  const handleNextButton = useCallback(() => {
    if (!enabled || isComplete || !currentStep) return;

    // 反思步骤也允许通过 handleNextButton 触发（由 SpotlightOverlay 的提交按钮调用）
    if (currentStep.allowNextButton || currentStep.trigger === 'reflection') {
      goToNextStep();
    }
  }, [enabled, isComplete, currentStep, goToNextStep]);

  // ============================================================
  // 反思模式处理
  // ============================================================

  // 当用户提交反思答案时调用（由 TutorialModal 调用）
  const handleReflectionSubmit = useCallback((answer: string) => {
    if (!enabled || isComplete || !currentStep) return;
    if (currentStep.trigger !== 'reflection') return;

    // 保存反思答案
    addStudentAnswer({
      labId: 'DT',
      questionId: currentStep.id,
      questionText: currentStep.guidanceText,
      answer
    });

    // 进入下一步
    goToNextStep();
  }, [enabled, isComplete, currentStep, addStudentAnswer, goToNextStep]);

  // 重置
  const reset = useCallback(() => {
    setStepIndex(0);
    setIsComplete(false);
  }, []);

  // ============================================================
  // 返回值
  // ============================================================

  return {
    currentStepIndex: stepIndex,
    isGuideActive: enabled && !isComplete,
    isComplete,

    sliderConfig: {
      locked: isComplete ? false : (currentStep?.sliderLocked ?? false),
      forceValue: isComplete ? null : (currentStep?.sliderForceValue ?? null)
    },
    modeConfig: {
      locked: isComplete ? false : (currentStep?.modeToggleLocked ?? false)
    },

    // 反思提交处理器（由 TutorialModal 调用）
    handleReflectionSubmit,

    handleDataChange,
    handleDepthChange,
    handleModeChange,
    handleInferencePoint,
    handleNextButton,

    reset
  };
};
