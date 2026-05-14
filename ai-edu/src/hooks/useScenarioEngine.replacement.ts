import { useEffect } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import {
  Experiment,
  TriggerCondition,
  ScenarioStep,
  LabId,
  curriculumSequence,
  getExperimentsForLab
} from '../store/scenarioConfig';
import { generatePoisonedData } from '../utils/dataGenerators';

/**
 * Extended scenario engine that supports both:
 * 1. Single-lab guided mode (original behavior)
 * 2. Curriculum mode (linear progression across all 5 labs)
 *
 * @param experiments - Array of Experiment definitions for this lab
 * @param enabled - Whether guided mode is active
 * @param curriculumMode - Whether to run in curriculum (cross-lab) mode
 * @param validatePrerequisite - Optional function to validate prerequisites before advancing.
 *   Receives the current step ID, returns null to allow advance, or an error message string to block.
 */
export const useScenarioEngine = (
  experiments: Experiment[],
  enabled = true,
  curriculumMode = false,
  validatePrerequisite: ((stepId: string) => string | null) | null = null,
  singleLabId: string | null = null
) => {
  const {
    currentExperimentIndex,
    currentStepIndex,
    currentCurriculumIndex,
    setSpotlight,
    clearSpotlight,
    setInterceptorRule,
    unlockFeature,
    advanceStep,
    advanceCurriculum,
    setCurrentCurriculumIndex,
    setCurrentLabStepIndex,
    setSetupAction,
    setDataset,
    markLabCompleted,
    setPrerequisiteWarning,
    setCompletionChoiceMode,
    pauseSimulation,
    addPendingReflection,
    startReflectionMode,
    getPendingReflectionsCount,
    reflectionModeActive
  } = usePedagogyStore();

  // ---- Curriculum mode helpers ----
  const currentCurriculumEntry = curriculumSequence[currentCurriculumIndex];
  const currentLab: LabId | null = curriculumMode && currentCurriculumEntry
    ? currentCurriculumEntry.labId
    : null;

  const curriculumProgress = {
    current: currentCurriculumIndex + 1,
    total: curriculumSequence.length,
    currentLabTitle: currentCurriculumEntry?.title || '',
    currentLabIcon: currentCurriculumEntry?.icon || ''
  };

  // Get experiments for the current curriculum lab
  const curriculumExperiments = curriculumMode && currentCurriculumEntry
    ? getExperimentsForLab(currentCurriculumEntry.labId)
    : experiments;

  // ---- Original single-lab behavior ----
  const currentExperiment = curriculumMode
    ? curriculumExperiments[currentExperimentIndex]
    : experiments[currentExperimentIndex];
  const currentStep: ScenarioStep | undefined = currentExperiment?.steps[currentStepIndex];

  // Handle setup actions
  useEffect(() => {
    if (!enabled) return;

    if (currentExperiment && currentExperiment.setupAction === 'LOAD_POISONED_DATA') {
      const poisonedData = generatePoisonedData();
      setDataset(poisonedData);
    }
  }, [enabled, currentExperimentIndex, currentExperiment, setDataset]);

  // Handle spotlight / unlock features for current step
  useEffect(() => {
    if (!enabled) {
      clearSpotlight();
      setInterceptorRule(null);
      setSetupAction(null);
      return;
    }

    if (!currentStep) {
      clearSpotlight();
      setInterceptorRule(null);
      return;
    }

    if (currentStep.unlockFeatures) {
      currentStep.unlockFeatures.forEach((feature) => unlockFeature(feature));
    }

    if (currentStep.setupAction) {
      setSetupAction(currentStep.setupAction);
    }

    console.log(`[SCENARIO ENGINE] useEffect: setting spotlight for step: ${currentStep.id}, currentStepIndex: ${currentStepIndex}`);
    console.log(`[SCENARIO ENGINE] currentStep details:`, JSON.stringify({
      id: currentStep.id,
      targetId: currentStep.targetId,
      triggerCondition: currentStep.triggerCondition,
    }));

    const isReflection = currentStep.triggerCondition === TriggerCondition.REFLECTION_SUBMIT;
    const isAutoIntercept = currentStep.triggerCondition === TriggerCondition.AUTO_INTERCEPT;
    const isCompletionChoice = currentStep.triggerCondition === TriggerCondition.COMPLETION_CHOICE;
    const requireAction = currentStep.triggerCondition !== TriggerCondition.NEXT_BUTTON;
    console.log(`[SCENARIO ENGINE] requireAction: ${requireAction} (triggerCondition: ${currentStep.triggerCondition})`);

    if (isCompletionChoice) {
      const pendingReflections = usePedagogyStore.getState().pendingReflections;
      const pendingCount = getPendingReflectionsCount();
      if (pendingCount > 0) {
        clearSpotlight();
        startReflectionMode();
        return;
      }
      // 只有当不在反思模式时，才显示完成选择弹窗
      // 否则等用户提交完反思后，会自动触发 completionChoiceMode
      if (!reflectionModeActive) {
        clearSpotlight();
        pauseSimulation();
        setCompletionChoiceMode(true);
        return;
      }
      // 即使在反思模式中，如果反思已回答完毕（pendingCount === 0），也需要显示完成选择弹窗
      clearSpotlight();
      pauseSimulation();
      setCompletionChoiceMode(true);
      return;
    }

    if (isReflection) {
      const labId = currentLab || singleLabId || 'NN';
      addPendingReflection(currentStep.requireReflection, labId, currentStep.id);
      clearSpotlight();
      setInterceptorRule(null);
      setSetupAction(null);
      startReflectionMode();  // 触发反思模式
      advanceStep();
      return;
    }

    if (!isAutoIntercept) {
      const newSpotlight = {
        targetId: currentStep.targetId || null,
        targetIds: currentStep.targetIds || [],
        message: currentStep.guidanceText,
        requireAction,
        reflectionConfig: null,
        currentStepId: currentStep.id
      };
      console.log(`[SCENARIO ENGINE] Set spotlight for step ${currentStep.id}: targetId=${currentStep.targetId}, requireAction=${requireAction}`);
      setSpotlight(newSpotlight);
    } else {
      const newSpotlight = {
        targetId: currentStep.targetId || null,
        targetIds: currentStep.targetIds || [],
        message: currentStep.guidanceText,
        requireAction: true,
        reflectionConfig: null,
        currentStepId: currentStep.id
      };
      console.log(`[SCENARIO ENGINE] Set spotlight (AUTO) for step ${currentStep.id}: targetId=${currentStep.targetId}`);
      setSpotlight(newSpotlight);
      setInterceptorRule(currentStep.interceptorRule || null);
    }

    // Clear any stale prerequisite warnings when step changes
    setPrerequisiteWarning(null);
  }, [
    enabled,
    currentExperimentIndex,
    currentStepIndex,
    currentStep,
    setSpotlight,
    clearSpotlight,
    setInterceptorRule,
    unlockFeature,
    setSetupAction,
    setPrerequisiteWarning,
    setCompletionChoiceMode,
    pauseSimulation,
    addPendingReflection,
    startReflectionMode,
    getPendingReflectionsCount,
    advanceStep,
    currentLab,
    reflectionModeActive  // Re-run when reflection mode ends to show completion modal
  ]);

  const nextStep = () => {
    console.log('[SCENARIO ENGINE] nextStep called, currentStepIndex:', currentStepIndex);
    if (validatePrerequisite && currentStep) {
      const warning = validatePrerequisite(currentStep.id);
      if (warning) {
        setPrerequisiteWarning(warning);
        return;
      }
    }

    if (!enabled || !currentExperiment) {
      return;
    }

    // Clear any stale prerequisite warning
    setSpotlight({ ...usePedagogyStore.getState().spotlight, prerequisiteWarning: null });
    setInterceptorRule(null);
    setSetupAction(null);
    // 进入下一步时清掉残留的暂停态，避免上一章节或拦截器把新一轮训练锁住
    usePedagogyStore.getState().resumeSimulation();

    const isLastStep = currentStepIndex >= currentExperiment.steps.length - 1;

    if (isLastStep) {
      // In curriculum mode, advance to next lab
      if (curriculumMode) {
        const currentLabId = currentCurriculumEntry?.labId;
        if (currentLabId) {
          markLabCompleted(currentLabId);
        }

        if (currentCurriculumIndex < curriculumSequence.length - 1) {
          // Move to next lab in curriculum
          advanceCurriculum();
        } else {
          // Curriculum complete — go to summary/final state
          clearSpotlight();
          usePedagogyStore.getState().advanceStage('SUMMARY');
        }
        return;
      }

      // Original single-lab behavior
      if (currentExperimentIndex < experiments.length - 1) {
        usePedagogyStore.setState({
          currentExperimentIndex: currentExperimentIndex + 1,
          currentStepIndex: 0
        });
      } else {
        clearSpotlight();
        usePedagogyStore.getState().advanceStage('SUMMARY');
      }
      return;
    }

    const nextStepConfig = currentExperiment.steps[currentStepIndex + 1];
    if (nextStepConfig?.unlockFeatures) {
      nextStepConfig.unlockFeatures.forEach((feature) => unlockFeature(feature));
    }

    console.log('[SCENARIO ENGINE] Calling advanceStep(), next index:', currentStepIndex + 1);
    advanceStep();
  };

  const reportValueChange = (targetId: string, newValue: any) => {
    if (!enabled) return;
    // console.log(`[REPORT VALUE CHANGE] targetId=${targetId}, newValue=${newValue}, currentStep=${currentStep?.id}, condition=${currentStep?.triggerCondition}`);

    if (
      currentStep &&
      currentStep.triggerCondition === TriggerCondition.VALUE_CHANGE
    ) {
      // 检查 targetId 或 targetIds 数组中是否包含当前目标
      const stepTargetIds = currentStep.targetIds || (currentStep.targetId ? [currentStep.targetId] : []);
      const isTargetMatch = stepTargetIds.includes(targetId);

      if (!isTargetMatch) {
        // console.log(`[REPORT VALUE CHANGE] ❌ targetId not in [${stepTargetIds.join(', ')}]`);
        return;
      }

      // 支持 targetValueOperator 比较运算符
      const compareValue = currentStep.targetValue;
      let matched = false;

      if (currentStep.targetValueOperator) {
        const op = currentStep.targetValueOperator;
        if (op === '>') matched = newValue > compareValue;
        else if (op === '<') matched = newValue < compareValue;
        else if (op === '>=') matched = newValue >= compareValue;
        else if (op === '<=') matched = newValue <= compareValue;
        else matched = newValue === compareValue; // '==='
      } else {
        matched = newValue === compareValue;
      }

      if (matched) {
        // console.log(`[REPORT VALUE CHANGE] ✅ MATCHED - Advancing step`);
        nextStep();
      } else {
        // console.log(`[REPORT VALUE CHANGE] ❌ targetValue mismatch: expected=${currentStep.targetValue}${currentStep.targetValueOperator || '==='}${newValue}`);
      }
    }
  };

  const reportClick = (targetId: string) => {
    if (!enabled) return;
    // console.log(`[REPORT CLICK] targetId=${targetId}, currentStep=${currentStep?.id}, condition=${currentStep?.triggerCondition}, stepTargetId=${currentStep?.targetId}`);

    if (
      currentStep &&
      currentStep.triggerCondition === TriggerCondition.ON_CLICK
    ) {
      // 支持 targetIds 数组或单个 targetId
      const stepTargetIds = currentStep.targetIds || (currentStep.targetId ? [currentStep.targetId] : []);
      const isTargetMatch = stepTargetIds.includes(targetId);

      if (isTargetMatch) {
        // console.log(`[REPORT CLICK] ✅ MATCHED - Advancing step`);
        nextStep();
      }
      // else: click detected but not matching current step's trigger - this is normal
    }
  };

  return {
    currentExperiment: enabled ? currentExperiment : undefined,
    currentStep: enabled ? currentStep : undefined,
    currentStepIndex: enabled ? currentStepIndex : 0,
    nextStep,
    reportValueChange,
    reportClick,
    // Curriculum extras
    isCurriculumMode: curriculumMode,
    currentLab,
    curriculumProgress,
    currentCurriculumIndex
  };
};
