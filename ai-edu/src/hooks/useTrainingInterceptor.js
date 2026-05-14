import { useEffect, useRef } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';

/**
 * 剧本驱动的通用教学拦截器 Hook
 * @param {number} currentEpoch - 当前训练轮数
 * @param {number} currentLoss - 当前损失值
 * @param {Object} model - 可选：模型参数对象 (含 weights 数组),用于检测参数是否停止变化
 */
export const useTrainingInterceptor = (currentEpoch, currentLoss, model = null) => {
  const isSimulationPaused = usePedagogyStore(state => state.isSimulationPaused);
  const pauseSimulation = usePedagogyStore(state => state.pauseSimulation);
  const activeInterceptorRule = usePedagogyStore(state => state.activeInterceptorRule);
  const advanceStep = usePedagogyStore(state => state.advanceStep);
  const setInterceptorRule = usePedagogyStore(state => state.setInterceptorRule);
  const setSpotlight = usePedagogyStore(state => state.setSpotlight);

  // 状态缓存：用于发散检测（连续上涨的 Loss）和兜底超时（记录挂载时的 Epoch）
  const historyRef = useRef({
    lossHistory: [],
    prevParams: null,
    startEpoch: 0,
    startTime: 0,
    isActive: false
  });

  useEffect(() => {
    // 如果已经暂停或当前没有活动的拦截规则，重置状态
    if (isSimulationPaused || !activeInterceptorRule) {
      historyRef.current.isActive = false;
      return;
    }

    const previousParamsSnapshot = historyRef.current.prevParams;

    // 刚进入拦截监控状态，初始化记录
    if (!historyRef.current.isActive) {
      historyRef.current = {
        lossHistory: [currentLoss],
        prevParams: model ? { weights: [...model.weights] } : null,
        startEpoch: currentEpoch,
        startTime: Date.now(),
        isActive: true
      };
    } else {
      // 记录最近的 Loss (最多存 10 个)
      historyRef.current.lossHistory.push(currentLoss);
      if (historyRef.current.lossHistory.length > 10) {
        historyRef.current.lossHistory.shift();
      }
    }

    let conditionMet = false;
    const elapsedEpochs = currentEpoch - historyRef.current.startEpoch;

    // 1. 发散趋势检测逻辑 (Divergence Detection)
    if (activeInterceptorRule.monitor === 'loss' && activeInterceptorRule.condition === 'isNaN') {
      // 条件 1.1：直接崩成 NaN 或 Infinity
      if (isNaN(currentLoss) || !isFinite(currentLoss)) {
        conditionMet = true;
      }
      
      // 条件 1.2：连续 5 个 epoch，Loss 不断攀升（发散趋势）
      const hist = historyRef.current.lossHistory;
      if (hist.length >= 5) {
        let isDiverging = true;
        for (let i = hist.length - 1; i > hist.length - 5; i--) {
          if (hist[i] <= hist[i - 1]) {
            isDiverging = false;
            break;
          }
        }
        if (isDiverging) {
          conditionMet = true;
        }
      }
    }

    // 2. 常规的阈值检测逻辑
    if (!conditionMet && activeInterceptorRule.threshold !== undefined) {
      let valueToMonitor = activeInterceptorRule.monitor === 'loss' ? currentLoss : currentEpoch;
      const t = activeInterceptorRule.threshold;
      switch (activeInterceptorRule.condition) {
        case '>': conditionMet = valueToMonitor > t; break;
        case '<': conditionMet = valueToMonitor < t; break;
        case '>=': conditionMet = valueToMonitor >= t; break;
        case '<=': conditionMet = valueToMonitor <= t; break;
        case '===': conditionMet = valueToMonitor === t; break;
        case 'plateau': {
          // plateau: 达到最小训练轮数后，再检测 Loss 停止下降或参数停止变化
          const hist = historyRef.current.lossHistory;
          const hasEnoughEpochs = elapsedEpochs >= t;
          const hasEnoughLossSamples = hist.length >= 3;

          // 计算 Loss 变化率
          let lossChangeRate = Infinity;
          if (hasEnoughLossSamples) {
            const recent = hist.slice(-3);
            const improvement = recent.length >= 2
              ? (recent[0] - recent[recent.length - 1]) / (recent[recent.length - 1] || 1)
              : 0;
            lossChangeRate = improvement;
          }

          // 计算参数变化率（如果有模型参数）
          let paramChangeRate = 1; // 默认认为有变化
          if (model && previousParamsSnapshot && model.weights && previousParamsSnapshot.weights) {
            const prevWeights = previousParamsSnapshot.weights;
            const currWeights = model.weights;
            let totalPrev = 0;
            let totalChange = 0;
            for (let i = 0; i < Math.min(prevWeights.length, currWeights.length); i++) {
              totalPrev += Math.abs(prevWeights[i]);
              totalChange += Math.abs(currWeights[i] - prevWeights[i]);
            }
            if (totalPrev > 0) {
              paramChangeRate = totalChange / totalPrev;
            }
          }

          // 只有达到最小训练轮数后，才允许进入 plateau 判定
          const isLossPlateau = hasEnoughLossSamples && lossChangeRate >= 0 && lossChangeRate < 0.05;
          const isParamPlateau = !!(model && previousParamsSnapshot && paramChangeRate < 0.01); // 参数变化小于 1%

          if (hasEnoughEpochs && (isLossPlateau || isParamPlateau)) {
            conditionMet = true;
          }
          break;
        }
      }
    }

    // 3. 终极兜底策略 (Timeout Fallback)
    // 如果监控的是 loss 发散，且过了 300 个 epoch 或者真实时间 15 秒都没爆炸
    let isTimeoutFallback = false;
    if (!conditionMet && activeInterceptorRule.monitor === 'loss') {
      const elapsedTime = Date.now() - historyRef.current.startTime;
      
      if (elapsedEpochs > 300 || elapsedTime > 15000) {
        conditionMet = true;
        isTimeoutFallback = true;
      }
    }

    // 触发动作
    if (conditionMet) {
      pauseSimulation(); // 强制暂停画布渲染和底层计算
      setInterceptorRule(null); // 触发后清空当前规则
      
      if (isTimeoutFallback) {
        // 如果是超时兜底，我们需要临时覆盖气泡文案，提示学生运气太好，并给一个强行跳过的按钮
        setSpotlight({
          targetId: null, // 全屏提示
          message: '你的运气真好！在当前的数据下，大学习率竟然没有让模型彻底崩溃，只是在不断震荡。但在大多数情况下，这会导致灾难性的后果。',
          requireAction: false // 允许点击"明白了，下一步"强行通过
        });
        // 注意：兜底触发时不自动 advanceStep，而是通过聚光灯的 requireAction: false 让用户点击"下一步"按钮来 advanceStep
      } else {
        // 正常触发，自动推进剧本到下一步（例如反思提问弹窗）
        advanceStep();
      }
    }

    // 本轮判断结束后，再更新参数快照，避免把“当前参数”与“当前参数”做比较。
    if (model && model.weights) {
      historyRef.current.prevParams = { weights: [...model.weights] };
    }

  }, [currentEpoch, currentLoss, model, isSimulationPaused, activeInterceptorRule, pauseSimulation, advanceStep, setInterceptorRule, setSpotlight]);
};
