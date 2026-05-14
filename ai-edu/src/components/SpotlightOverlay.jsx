import React, { useEffect, useState } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import './SpotlightOverlay.css';

export const SpotlightOverlay = ({ onNextStep, showPopover = true }) => {
  const spotlight = usePedagogyStore(state => state.spotlight);
  const clearSpotlight = usePedagogyStore(state => state.clearSpotlight);

  // 支持多个目标：targetIds 数组 + targetId 单个目标（向后兼容）
  const targetIds = (spotlight.targetIds && spotlight.targetIds.length > 0)
    ? spotlight.targetIds
    : (spotlight.targetId ? [spotlight.targetId] : []);

  // DEBUG: 打印聚焦信息
  console.log(`[SPOTLIGHT DEBUG] Step: ${spotlight.currentStepId}, Targets: [${targetIds.join(', ')}], RequireAction: ${spotlight.requireAction}, isActive: ${spotlight.isActive}`);

  const [targetRects, setTargetRects] = useState([]);

  // 测量多个目标元素的尺寸和位置
  useEffect(() => {
    if (!spotlight.isActive || targetIds.length === 0) {
      setTargetRects([]);
      return;
    }

    let animationFrameId = null;

    const measureAllTargets = () => {
      const rects = [];
      for (const id of targetIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          rects.push({
            id,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          });
          // 确保目标元素层级在遮罩之上
          el.classList.add('spotlight-target-active');
        } else {
          console.warn(`Spotlight Target ID '${id}' not found.`);
        }
      }
      setTargetRects(rects);
    };

    // 初始测量，稍微增加延迟确保条件渲染的元素（如解锁后的控件）已完成 DOM 渲染
    const timer = setTimeout(measureAllTargets, 150);

    // 监听窗口尺寸变化或滚动时重新测量
    const handleResize = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(measureAllTargets);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    // 监听可能引起布局变化的事件（如输入框变化导致宽度变化）
    const handleLayoutChange = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(measureAllTargets);
    };

    // 针对目标元素监听输入事件（可能导致宽度变化）
    targetIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', handleLayoutChange);
        // 也监听可能改变尺寸的子元素
        const inputs = el.querySelectorAll('input');
        inputs.forEach(input => input.addEventListener('input', handleLayoutChange));
      }
    });

    // 使用 MutationObserver 监听目标元素的 DOM 变化（如子元素内容变化导致布局移位）
    const observer = new MutationObserver(() => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(measureAllTargets);
    });

    targetIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el, {
          characterData: true,
          childList: true,
          subtree: true,
          attributes: true
        });
      }
    });

    return () => {
      clearTimeout(timer);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);

      // 移除事件监听
      targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.removeEventListener('input', handleLayoutChange);
          const inputs = el.querySelectorAll('input');
          inputs.forEach(input => input.removeEventListener('input', handleLayoutChange));
        }
      });

      // 移除所有目标元素的 active 类
      targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('spotlight-target-active');
        }
      });
    };
  }, [spotlight.isActive, targetIds.join(',')]);

  if (!spotlight.isActive) return null;

  // 默认如果没有找到任何目标，提供一个居中显示文案的后备模式
  if (targetRects.length === 0) {
    return (
      <div className="spotlight-overlay-fallback">
         <GuidancePopover message={spotlight.message} requireAction={spotlight.requireAction} onNext={onNextStep || clearSpotlight} />
      </div>
    );
  }

  // 计算合并的目标区域（用于定位气泡）
  // 优先使用第一个目标（主要操作目标）来定位气泡，避免气泡落在组合区域中心（可能被遮挡）
  let popoverTargetRect = null;
  if (targetRects.length >= 1) {
    // 使用第一个目标作为气泡定位参考
    popoverTargetRect = targetRects[0];
  }

  // 聚光灯周围稍微留白（padding）
  const padding = 8;

  // 使用 SVG path 语法配合 CSS clip-path 完美实现多目标挖孔（双聚焦）
  // 外层顺时针，内层逆时针，利用 non-zero 填充规则实现挖孔
  const w = window.innerWidth;
  const h = window.innerHeight;
  let pathData = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  
  targetRects.forEach(rect => {
    const x = rect.left - padding;
    const y = rect.top - padding;
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;
    // 逆时针绘制内孔
    pathData += ` M ${x} ${y} L ${x} ${y + height} L ${x + width} ${y + height} L ${x + width} ${y} Z`;
  });

  return (
    <>
      <div
        className="spotlight-overlay-mask"
        style={{
          clipPath: `path('${pathData}')`
        }}
      />

      {/* 气泡提示层：根据目标位置动态计算显示位置 */}
      {showPopover && (
        <GuidancePopover
          targetRect={popoverTargetRect}
          message={spotlight.message}
          requireAction={spotlight.requireAction}
          onNext={onNextStep || clearSpotlight}
        />
      )}
    </>
  );
};

// 内部气泡提示组件
const GuidancePopover = ({ targetRect, message, requireAction, onNext }) => {
  const spotlight = usePedagogyStore(state => state.spotlight);
  const addStudentAnswer = usePedagogyStore(state => state.addStudentAnswer);
  const currentStepIndex = usePedagogyStore(state => state.currentStepIndex);
  const clearPrerequisiteWarning = usePedagogyStore(state => state.clearSpotlight);

  const reflectionConfig = spotlight.reflectionConfig;
  const requireReflection = !!reflectionConfig;
  const prerequisiteWarning = spotlight.prerequisiteWarning;

  const [reflectionText, setReflectionText] = useState('');

  const minChars = reflectionConfig?.minChars || 10;
  const isTextValid = reflectionText.trim().length >= minChars;

  const handleSubmit = () => {
    if (isTextValid) {
      addStudentAnswer({
        stepIndex: currentStepIndex,
        question: reflectionConfig.questionText,
        answer: reflectionText,
        timestamp: Date.now()
      });
      setReflectionText('');
      onNext();
    }
  };

  // 简单计算：优先显示在目标元素的上方，如果顶部空间不够则显示在下方
  // 如果需要点击目标，则确保气泡不遮挡目标元素
  let top = '50%';
  let left = '50%';
  let transform = 'translate(-50%, -50%)';

  // 获取当前步骤ID，用于特殊定位
  const currentStepId = spotlight.currentStepId;

  // 检测是否需要强制居中显示（用于页面级引导步骤，如故障实验的第一步）
  // 这些步骤没有具体的 targetId，或者 target 可能在页面顶部之外
  const isPageLevelStep = currentStepId === 'nn1_step_1_intro' ||
                          currentStepId === 'nn1_step_2_observe_data' ||
                          currentStepId === 'llm_step_1_intro' ||
                          currentStepId === 'llm_step_2_theme_selection' ||
                          currentStepId === 'exp1_step1_intro' ||
                          currentStepId === 'exp2_step1_intro' ||
                          currentStepId === 'exp3_step1_intro' ||
                          currentStepId === 'exp4_step1_intro' ||
                          currentStepId === 'f_step_1_intro';

  // 强制居中：如果 targetRect 不存在或者是页面级步骤，则居中显示
  const forceCenter = !targetRect || isPageLevelStep;

  if (targetRect) {
    const popoverHeight = requireReflection ? 250 : 150; // 预估高度
    const popoverWidth = 320; // 预估宽度
    const popoverPadding = 20; // 气泡与目标之间的最小间距

    // 计算气泡最终位置
    let popoverTop, popoverLeft;

    // 特殊处理：观察类步骤（nn1_step_2、nn1_step_4），气泡显示在右侧
    const preferRightSide = currentStepId === 'nn1_step_2_observe_data' ||
                           currentStepId === 'nn1_step_4_observe_loss';

    if (forceCenter) {
      // 强制居中显示（用于页面级引导步骤）
      top = '50%';
      left = '50%';
      transform = 'translate(-50%, -50%)';
    } else if (preferRightSide && !requireAction) {
      // 对于观察类步骤，气泡固定显示在画布右侧
      popoverTop = targetRect.top + targetRect.height / 2;
      popoverLeft = targetRect.left + targetRect.width + popoverPadding + popoverWidth / 2;
      transform = 'translate(0, -50%)';

      // 边界检查：如果右侧空间不够，放左侧
      if (popoverLeft + popoverWidth / 2 > window.innerWidth - 10) {
        popoverLeft = targetRect.left - popoverPadding - popoverWidth / 2;
      }
      top = `${popoverTop}px`;
      left = `${popoverLeft}px`;
    } else {
      // 计算水平居中位置
      let horizontalCenter = targetRect.left + targetRect.width / 2;
      if (horizontalCenter - popoverWidth / 2 < 10) {
        horizontalCenter = popoverWidth / 2 + 10;
      } else if (horizontalCenter + popoverWidth / 2 > window.innerWidth - 10) {
        horizontalCenter = window.innerWidth - popoverWidth / 2 - 10;
      }
      popoverLeft = horizontalCenter;

      const spaceAbove = targetRect.top;
      const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);

      // 如果需要点击目标，优先选择不遮挡目标的位置
      if (requireAction) {
        // 尝试放在左侧（垂直居中，左对齐）
        if (targetRect.left > popoverWidth + popoverPadding) {
          // 左侧空间足够，放在左边
          popoverLeft = targetRect.left - popoverWidth - popoverPadding;
          popoverTop = targetRect.top + targetRect.height / 2;
          transform = 'translate(0, -50%)';
        } else if (targetRect.left + targetRect.width + popoverWidth + popoverPadding < window.innerWidth) {
          // 右侧空间足够，放在右边
          popoverLeft = targetRect.left + targetRect.width + popoverPadding;
          popoverTop = targetRect.top + targetRect.height / 2;
          transform = 'translate(0, -50%)';
        } else if (spaceBelow > popoverHeight + popoverPadding) {
          // 下方空间足够，放在下面
          popoverTop = targetRect.top + targetRect.height + popoverPadding;
          popoverLeft = Math.min(targetRect.left + targetRect.width / 2, window.innerWidth - popoverWidth / 2 - 10);
          transform = 'translate(-50%, 0)';
        } else if (spaceAbove > popoverHeight + popoverPadding) {
          // 上方空间足够，放在上面
          popoverTop = targetRect.top - popoverHeight - popoverPadding;
          popoverLeft = Math.max(popoverWidth / 2 + 10, Math.min(targetRect.left + targetRect.width / 2, window.innerWidth - popoverWidth / 2 - 10));
          transform = 'translate(-50%, 0)';
        } else {
          // 空间不足，优先居中显示，避免放角落被遮挡
          top = '50%';
          left = '50%';
          transform = 'translate(-50%, -50%)';
          return;
        }
        top = `${popoverTop}px`;
        left = `${popoverLeft}px`;
      } else {
        // 不需要点击目标，优先上方/下方
        if (spaceAbove > popoverHeight + 20) {
          top = `${targetRect.top - 20}px`;
          left = `${horizontalCenter}px`;
          transform = 'translate(-50%, -100%)';
        } else if (spaceBelow > popoverHeight + 20) {
          top = `${targetRect.top + targetRect.height + 20}px`;
          left = `${horizontalCenter}px`;
          transform = 'translate(-50%, 0)';
        } else {
          top = `${window.innerHeight - popoverHeight - 20}px`;
          left = `${horizontalCenter}px`;
          transform = 'translate(-50%, 0)';
        }
      }
    }
  }

  return (
    <div
      className="guidance-popover glass-panel"
      style={{
        position: 'fixed',
        top,
        left,
        transform,
        zIndex: 10006, // 确保在所有内容之上
        pointerEvents: 'auto',
        minWidth: '300px',
      }}
    >
      <div className="guidance-popover-arrow" />
      <div className="guidance-content">
        <span className="guidance-icon">💡</span>
        <p className="guidance-message">{requireReflection ? reflectionConfig.questionText : message}</p>
      </div>
      
      {requireReflection ? (
        <div className="mt-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              resize: 'none'
            }}
            rows="3"
            placeholder={`请输入你的观察与思考（至少 ${minChars} 个字）...`}
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
          />
          <div style={{ textAlign: 'right', fontSize: '12px', color: isTextValid ? '#4ade80' : '#f87171' }}>
            {reflectionText.length} / {minChars} 字
          </div>
          <button
            className="btn btn-primary btn-sm w-full"
            onClick={handleSubmit}
            disabled={!isTextValid}
            style={{ opacity: isTextValid ? 1 : 0.5, cursor: isTextValid ? 'pointer' : 'not-allowed' }}
          >
            提交并继续
          </button>
        </div>
      ) : !requireAction ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {prerequisiteWarning ? (
            <div style={{
              backgroundColor: 'rgba(255, 100, 100, 0.2)',
              border: '1px solid rgba(255, 100, 100, 0.5)',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '13px',
              color: '#ff9999'
            }}>
              {prerequisiteWarning}
            </div>
          ) : null}
          <button className="btn btn-primary btn-sm w-full" onClick={() => { console.log('[SPOTLIGHT] Next button clicked'); onNext(); }}>
            明白了，下一步
          </button>
        </div>
      ) : null}
    </div>
  );
};
