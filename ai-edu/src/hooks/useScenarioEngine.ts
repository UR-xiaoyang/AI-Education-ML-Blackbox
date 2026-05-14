import { useEffect } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import { Experiment, TriggerCondition, ScenarioStep } from '../store/scenarioConfig';
import { generatePoisonedData } from '../utils/dataGenerators';

const useScenarioEngineLegacy = (experiments: Experiment[]) => {
  const {
    currentExperimentIndex,
    currentStepIndex,
    setSpotlight,
    clearSpotlight,
    setInterceptorRule,
    unlockFeature,
    advanceStep,
    setSetupAction,
    setDataset
  } = usePedagogyStore();

  const currentExperiment = experiments[currentExperimentIndex];
  const currentStep: ScenarioStep | undefined = currentExperiment?.steps[currentStepIndex];

  // 模块三：实验级别的 setupAction 监听
  useEffect(() => {
    if (currentExperiment && currentExperiment.setupAction === 'LOAD_POISONED_DATA') {
      const poisonedData = generatePoisonedData();
      setDataset(poisonedData);
    }
  }, [currentExperimentIndex, currentExperiment, setDataset]);

  // 驱动引擎：当实验步骤切换时，解析该步骤的配置并转化为全局状态副作用
  useEffect(() => {
    if (!currentStep) {
      clearSpotlight();
      setInterceptorRule(null);
      return;
    }

    // 1. 解锁面板功能（如果剧本要求）
    if (currentStep.unlockFeatures) {
      currentStep.unlockFeatures.forEach(feature => unlockFeature(feature));
    }

    // 2. 触发特定副作用动作（如重置数据、禁用激活函数等）
    if (currentStep.setupAction) {
      setSetupAction(currentStep.setupAction);
    }

    // 3. 配置聚光灯与气泡提示
    const isReflection = currentStep.triggerCondition === TriggerCondition.REFLECTION_SUBMIT;
    const isAutoIntercept = currentStep.triggerCondition === TriggerCondition.AUTO_INTERCEPT;
    
    // 对于拦截器状态和反思状态，气泡可能以弹窗形式展现，不需要"下一步"按钮
    const requireAction = currentStep.triggerCondition !== TriggerCondition.NEXT_BUTTON;

    if (!isReflection && !isAutoIntercept) {
      setSpotlight({
        targetId: currentStep.targetId || null,
        message: currentStep.guidanceText,
        requireAction,
        reflectionConfig: null
      });
    } else if (isAutoIntercept) {
      // 如果是在等待拦截器，我们可能展示一个弱提示或全屏暗化但显示监控状态
      setSpotlight({
        targetId: currentStep.targetId || null,
        message: currentStep.guidanceText,
        requireAction: true, // 等待拦截器自动触发，不需要按钮
        reflectionConfig: null
      });
      // 挂载拦截规则
      setInterceptorRule(currentStep.interceptorRule || null);
    } else if (isReflection) {
      // 触发弹窗显示
      setSpotlight({
        targetId: currentStep.targetId || null, // 改为支持指向特定元素
        message: currentStep.guidanceText,
        requireAction: true,
        reflectionConfig: currentStep.requireReflection
      });
    }

  }, [currentExperimentIndex, currentStepIndex, currentStep, setSpotlight, clearSpotlight, setInterceptorRule, unlockFeature, setSetupAction]);

  // 提供给组件调用的手动推下一步方法
  const nextStep = () => {
    if (!currentExperiment) return;
    
    // 清理上一级的拦截规则和副作用标记
    setInterceptorRule(null);
    setSetupAction(null);

    const isLastStep = currentStepIndex >= currentExperiment.steps.length - 1;
    if (isLastStep) {
      // 进入下一个实验
      if (currentExperimentIndex < experiments.length - 1) {
        usePedagogyStore.setState({ 
          currentExperimentIndex: currentExperimentIndex + 1,
          currentStepIndex: 0 
        });
      } else {
        // 所有实验完成
        clearSpotlight();
        usePedagogyStore.getState().advanceStage('SUMMARY');
      }
    } else {
      // 实验内的下一步
      const nextStepConfig = currentExperiment.steps[currentStepIndex + 1];
      
      // 在推进 currentStepIndex 之前，提前解锁下一步需要的 UI，确保 DOM 能够被渲染
      if (nextStepConfig && nextStepConfig.unlockFeatures) {
        nextStepConfig.unlockFeatures.forEach(feature => unlockFeature(feature));
      }
      
      advanceStep();
    }
  };

  // 提供给受控组件（如滑块）汇报值变化的接口
  const reportValueChange = (targetId: string, newValue: any) => {
    if (
      currentStep &&
      currentStep.triggerCondition === TriggerCondition.VALUE_CHANGE &&
      currentStep.targetId === targetId
    ) {
      // 如果没有指定具体目标值，或者达到了目标值，推进剧本
      if (currentStep.targetValue === undefined || currentStep.targetValue === newValue) {
        nextStep();
      }
    }
  };

  // 提供给可点击元素的接口
  const reportClick = (targetId: string) => {
    if (
      currentStep &&
      currentStep.triggerCondition === TriggerCondition.ON_CLICK &&
      currentStep.targetId === targetId
    ) {
      nextStep();
    }
  };

  return {
    currentExperiment,
    currentStep,
    nextStep,
    reportValueChange,
    reportClick
  };
};

export { useScenarioEngine } from './useScenarioEngine.replacement';
