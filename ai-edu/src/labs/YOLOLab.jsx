import React, { useMemo, useState } from 'react';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { yoloScenarios } from '../store/scenarioConfig';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';

const GT_OBJECTS = [
  { id: 'person', label: '人', color: '#fbbf24', x: 16, y: 14, w: 24, h: 50, shape: 'person' },
  { id: 'bag', label: '书包', color: '#60a5fa', x: 58, y: 50, w: 18, h: 16, shape: 'bag' }
];

const PREDICTION_TEMPLATES = [
  {
    id: 'person-main',
    label: '人',
    color: '#fbbf24',
    targetId: 'person',
    start: { x: 6, y: 10, w: 36, h: 58 },
    end: { x: 15, y: 14, w: 25, h: 50 },
    scoreStart: 0.34,
    scoreEnd: 0.93
  },
  {
    id: 'person-dup',
    label: '人',
    color: '#fb923c',
    targetId: 'person',
    start: { x: 24, y: 24, w: 28, h: 42 },
    end: { x: 17, y: 18, w: 24, h: 46 },
    scoreStart: 0.31,
    scoreEnd: 0.82
  },
  {
    id: 'bag-main',
    label: '书包',
    color: '#60a5fa',
    targetId: 'bag',
    start: { x: 49, y: 56, w: 24, h: 14 },
    end: { x: 58, y: 50, w: 18, h: 16 },
    scoreStart: 0.22,
    scoreEnd: 0.78
  },
  {
    id: 'cat-fp',
    label: '猫',
    color: '#f472b6',
    targetId: null,
    start: { x: 68, y: 18, w: 16, h: 18 },
    end: { x: 70, y: 20, w: 14, h: 16 },
    scoreStart: 0.45,
    scoreEnd: 0.09
  }
];

const LAB_STEPS = [
  {
    id: 'step-1',
    title: '1. 标注目标',
    goal: '先把人和书包都标出来，让模型知道哪里有目标。',
    hint: '没有标注，模型就不知道该朝哪个方向改框。'
  },
  {
    id: 'step-2',
    title: '2. 训练模型',
    goal: '点击训练，让主框 IoU 超过 0.7。',
    hint: '训练越多，预测框会越接近真实框。'
  },
  {
    id: 'step-3',
    title: '3. 调置信度阈值',
    goal: '拖动阈值，把低分假框过滤掉。',
    hint: '先删低分框，再做 NMS 会更高效。'
  },
  {
    id: 'step-4',
    title: '4. 理解 NMS',
    goal: '调 IoU 阈值，观察重复的人框何时被抑制。',
    hint: 'NMS 只在同类高重叠框之间做选择。'
  }
];

function interpolate(start, end, t) {
  return start + (end - start) * t;
}

function rectIoU(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const interWidth = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const interHeight = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const interArea = interWidth * interHeight;
  const union = (a.w * a.h) + (b.w * b.h) - interArea;
  return union <= 0 ? 0 : interArea / union;
}

export default function YOLOLab({ scenarioEnabled = false }) {
  const [labeledTargets, setLabeledTargets] = useState([]);
  const [trainingSteps, setTrainingSteps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4);
  const [nmsThreshold, setNmsThreshold] = useState(0.45);

  const predictions = useMemo(() => {
    return PREDICTION_TEMPLATES.map((template) => {
      const targetKnown = template.targetId ? labeledTargets.includes(template.targetId) : labeledTargets.length > 0;
      const fit = template.targetId
        ? (targetKnown ? Math.min(trainingSteps / 6, 1) : Math.min(trainingSteps / 18, 0.2))
        : Math.min(trainingSteps / 6, 1);

      const score = template.targetId
        ? interpolate(template.scoreStart, targetKnown ? template.scoreEnd : template.scoreStart + 0.08, fit)
        : interpolate(template.scoreStart, template.scoreEnd, fit);

      return {
        ...template,
        x: interpolate(template.start.x, template.end.x, fit),
        y: interpolate(template.start.y, template.end.y, fit),
        w: interpolate(template.start.w, template.end.w, fit),
        h: interpolate(template.start.h, template.end.h, fit),
        score,
        fit
      };
    });
  }, [labeledTargets, trainingSteps]);

  const withStatus = useMemo(() => {
    const sorted = [...predictions].sort((a, b) => b.score - a.score);
    const kept = [];
    const suppressed = new Set();

    sorted.forEach((box) => {
      if (box.score < confidenceThreshold) return;
      const collided = kept.some((keptBox) => (
        keptBox.label === box.label && rectIoU(keptBox, box) > nmsThreshold
      ));
      if (collided) {
        suppressed.add(box.id);
      } else {
        kept.push(box);
      }
    });

    return predictions.map((box) => {
      let status = '候选框';
      if (box.score < confidenceThreshold) status = '低于阈值';
      else if (suppressed.has(box.id)) status = '被 NMS 抑制';
      else status = '最终保留';

      const gt = GT_OBJECTS.find((item) => item.id === box.targetId);
      const iou = gt ? rectIoU(box, gt) : 0;

      return {
        ...box,
        status,
        iou
      };
    });
  }, [predictions, confidenceThreshold, nmsThreshold]);

  const mainPerson = withStatus.find((box) => box.id === 'person-main');
  const falsePositive = withStatus.find((box) => box.id === 'cat-fp');

  const completedSteps = {
    'step-1': labeledTargets.length === 2,
    'step-2': (mainPerson?.iou || 0) >= 0.7,
    'step-3': (falsePositive?.score || 1) < confidenceThreshold,
    'step-4': withStatus.some((box) => box.id === 'person-dup' && box.status === '被 NMS 抑制')
  };

  const activeStep = useMemo(() => {
    if (!completedSteps['step-1']) return 'step-1';
    if (!completedSteps['step-2']) return 'step-2';
    if (!completedSteps['step-3']) return 'step-3';
    return 'step-4';
  }, [completedSteps]);

  const isLabelStage = activeStep === 'step-1';
  const isTrainStage = activeStep === 'step-2';
  const isConfidenceStage = activeStep === 'step-3';
  const isNmsStage = activeStep === 'step-4';
  const keptCount = withStatus.filter((box) => box.status === '最终保留').length;
  const filteredCount = withStatus.filter((box) => box.status === '低于阈值').length;
  const suppressedCount = withStatus.filter((box) => box.status === '被 NMS 抑制').length;

  const {
    currentExperiment,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep
  } = useScenarioEngine(
    yoloScenarios,
    scenarioEnabled,
    false,
    (stepId) => {
      if (stepId === 'yolo_step_1_label_targets' && labeledTargets.length < 2) {
        return '请先把“人”和“书包”两个真值框都加入标注。';
      }
      if (stepId === 'yolo_step_3_observe_iou' && (mainPerson?.iou || 0) < 0.7) {
        return '请继续训练，直到主框 IoU 至少达到 0.70。';
      }
      if (stepId === 'yolo_step_6_observe_status' && !withStatus.some((box) => box.status === '被 NMS 抑制')) {
        return '请先把 NMS 阈值调低一些，直到出现“被 NMS 抑制”的重复框。';
      }
      return null;
    },
    'YOLO'
  );

  const toggleLabel = (targetId) => {
    setLabeledTargets((prev) => (
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    ));
  };

  const trainOnce = () => {
    if (labeledTargets.length === 0) return;
    setTrainingSteps((value) => value + 1);
  };

  const resetLab = () => {
    setLabeledTargets([]);
    setTrainingSteps(0);
    setConfidenceThreshold(0.4);
    setNmsThreshold(0.45);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1500px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'auto',
        paddingRight: '4px'
      }}
    >
      <style>{`
        @keyframes taskPulse {
          0% { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.35), 0 0 0 rgba(251, 191, 36, 0); }
          50% { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.8), 0 0 24px rgba(251, 191, 36, 0.25); }
          100% { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.35), 0 0 0 rgba(251, 191, 36, 0); }
        }
      `}</style>
      <section
        className="glass-panel"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          padding: '12px 14px',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
          {LAB_STEPS.map((step) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: activeStep === step.id ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.52)',
                border: `1px solid ${(completedSteps[step.id] ? '#22c55e' : activeStep === step.id ? '#fbbf24' : '#64748b')}66`,
                boxShadow: activeStep === step.id ? `0 0 0 1px ${(completedSteps[step.id] ? '#22c55e' : '#fbbf24')} inset, 0 0 22px ${(completedSteps[step.id] ? '#22c55e' : '#fbbf24')}22` : 'none',
                animation: activeStep === step.id && !completedSteps[step.id] ? 'taskPulse 1.6s ease-in-out infinite' : 'none',
                transform: activeStep === step.id ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: completedSteps[step.id] ? '#22c55e' : activeStep === step.id ? '#fbbf24' : '#64748b',
                  flexShrink: 0
                }}
              />
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>{step.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="glass-panel"
        style={{
          padding: '16px 18px',
          background:
            'radial-gradient(circle at top left, rgba(251, 191, 36, 0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 24%), rgba(11, 18, 32, 0.82)'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '14px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#fbbf24', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Interactive Lab
            </div>
            <h2 style={{ margin: '8px 0 8px', fontSize: '1.6rem', color: '#f8fafc' }}>
              YOLO 检测实验台：先标注，再出框，再去重
            </h2>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'rgba(226, 232, 240, 0.82)', fontSize: '0.92rem' }}>
              每一步只保留当前任务最需要的内容。完成标注后就进入训练页，完成训练后再进入阈值页，像翻页一样往前推进。
            </p>
            <div style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)', display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>📺 注意：预测框变化是基于模板插值的教学演示动画，非真实神经网络输出。</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {[
              { title: '已标注目标', value: `${labeledTargets.length} / 2`, color: '#f8fafc' },
              { title: '训练轮数', value: trainingSteps, color: '#fbbf24' },
              { title: '主框 IoU', value: (mainPerson?.iou || 0).toFixed(2), color: (mainPerson?.iou || 0) >= 0.7 ? '#86efac' : '#f8fafc' },
              { title: '最终框数', value: keptCount, color: '#60a5fa' }
            ].map((item) => (
              <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.56)' }}>
                <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.88)' }}>{item.title}</div>
                <div style={{ marginTop: '6px', color: item.color, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isLabelStage && (
        <section className="glass-panel" style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.72)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {[
              {
                title: '已标注目标',
                value: `${labeledTargets.length} / 2`,
                accent: '#fbbf24',
                badges: GT_OBJECTS.filter((item) => labeledTargets.includes(item.id))
              },
              { title: '训练轮数', value: trainingSteps, accent: '#fb923c' },
              { title: '主框 IoU', value: (mainPerson?.iou || 0).toFixed(2), accent: (mainPerson?.iou || 0) >= 0.7 ? '#86efac' : '#fbbf24' },
              { title: '最终保留框', value: keptCount, accent: '#60a5fa' }
            ].map((item) => (
              <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.88)' }}>{item.title}</div>
                <div style={{ marginTop: '6px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                {item.badges?.length ? (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item.badges.map((badge) => (
                      <span key={badge.id} style={{ padding: '6px 10px', borderRadius: '999px', background: `${badge.color}22`, border: `1px solid ${badge.color}66`, color: '#f8fafc', fontSize: '0.82rem' }}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {isLabelStage && (
        <section className="glass-panel" style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.78)' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button className="btn" type="button" onClick={resetLab}>
              重置实验
            </button>
          </div>

          <div id="yolo-label-panel" className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.12)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>第 1 步：先给图片做标注</h3>
            <p style={{ margin: '6px 0 0', color: 'rgba(226, 232, 240, 0.74)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              这里从零开始。只有当你把人和书包都标出来后，页面才会自动翻到训练页。
            </p>

            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px' }}>
              <div
                style={{
                  position: 'relative',
                  height: '250px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background:
                    'radial-gradient(circle at 28% 32%, rgba(251, 191, 36, 0.12), transparent 20%), radial-gradient(circle at 64% 58%, rgba(96, 165, 250, 0.14), transparent 18%), linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.92))'
                }}
              >
                <div style={{ position: 'absolute', left: '18%', top: '15%', width: '20%', height: '46%', borderRadius: '999px', background: 'rgba(226, 232, 240, 0.14)' }} />
                <div style={{ position: 'absolute', left: '60%', top: '52%', width: '16%', height: '14%', borderRadius: '10px', background: 'rgba(226, 232, 240, 0.14)' }} />

                {GT_OBJECTS.map((item) => (
                  labeledTargets.includes(item.id) ? (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        left: `${item.x}%`,
                        top: `${item.y}%`,
                        width: `${item.w}%`,
                        height: `${item.h}%`,
                        borderRadius: '12px',
                        border: `3px solid ${item.color}`,
                        boxShadow: `0 0 16px ${item.color}55`
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '-28px',
                          left: 0,
                          padding: '4px 8px',
                          borderRadius: '999px',
                          background: item.color,
                          color: '#0f172a',
                          fontSize: '0.76rem',
                          fontWeight: 700
                        }}
                      >
                        {item.label} 真值框
                      </div>
                    </div>
                  ) : null
                ))}
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {GT_OBJECTS.map((target) => {
                  const active = labeledTargets.includes(target.id);
                  return (
                    <button
                      key={target.id}
                      type="button"
                      className="btn"
                      onClick={() => { toggleLabel(target.id); reportClick('yolo-label-panel'); }}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        background: active ? `${target.color}22` : 'rgba(15, 23, 42, 0.48)',
                        borderColor: active ? `${target.color}66` : 'rgba(148, 163, 184, 0.16)'
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700 }}>{target.label}</div>
                      <div style={{ marginTop: '6px', color: 'rgba(226, 232, 240, 0.7)', fontSize: '0.82rem' }}>
                        {active ? '已加入真值框' : '点击加入标注'}
                      </div>
                    </button>
                  );
                })}

                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(2, 6, 23, 0.36)' }}>
                  <div style={{ fontSize: '0.76rem', color: '#7dd3fc' }}>为什么先标注</div>
                  <div style={{ marginTop: '8px', color: '#f8fafc', lineHeight: 1.7 }}>
                    YOLO 训练时要把预测框和真值框对齐，没有真值框就无法计算定位误差。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isTrainStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div id="yolo-training-panel" onClick={() => reportClick('yolo-training-panel')} className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>第 2 步：训练模型</h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                标注页已经收起。现在你只需要反复训练，让主框越来越贴近真值框，直到 IoU 超过 0.70。
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button id="yolo-btn-train" className="btn btn-primary" type="button" onClick={() => { trainOnce(); reportClick('yolo-btn-train'); }}>
                训练 1 轮
              </button>
              <button className="btn" type="button" onClick={resetLab}>
                重置实验
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                ['框回归损失', Math.max(18, 90 - trainingSteps * 12), '#fbbf24'],
                ['目标置信度损失', Math.max(10, 72 - trainingSteps * 9), '#fb923c'],
                ['类别分类损失', Math.max(8, 68 - trainingSteps * 8), '#60a5fa']
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#e2e8f0' }}>{label}</span>
                    <strong style={{ color }}>{value}</strong>
                  </div>
                  <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.14)', overflow: 'hidden' }}>
                    <div style={{ width: `${value}%`, height: '100%', background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div id="yolo-detection-canvas" onClick={() => reportClick('yolo-detection-canvas')} className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>候选框是怎么变化的</h3>
            <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
              当前页面只保留训练相关画布。继续训练，直到主框 IoU 达标。
            </p>

            <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
              {withStatus.map((box) => (
                <div key={box.id} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.56)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong style={{ color: box.color }}>{box.label}</strong>
                    <span style={{ color: '#e2e8f0' }}>{box.score.toFixed(2)}</span>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '12px', color: 'rgba(226, 232, 240, 0.72)', fontSize: '0.82rem' }}>
                    <span>{box.status}</span>
                    <span>{box.targetId ? `IoU ${box.iou.toFixed(2)}` : '无真值目标'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isConfidenceStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>第 3 步：调置信度阈值</h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                训练页已经收起。现在只保留筛掉低分假框所需的控件和检测画布。
              </p>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#f8fafc' }}>置信度阈值</span>
                <strong style={{ color: '#fbbf24' }}>{confidenceThreshold.toFixed(2)}</strong>
              </div>
              <input
                id="yolo-confidence-slider"
                type="range"
                min="0.1"
                max="0.9"
                step="0.01"
                value={confidenceThreshold}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setConfidenceThreshold(value);
                  reportValueChange('yolo-confidence-slider', value);
                }}
                style={{ width: '100%', marginTop: '10px' }}
              />
              <div style={{ marginTop: '8px', color: 'rgba(226, 232, 240, 0.68)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                分数低于这个值的框会被直接删掉。
              </div>
            </div>

            <button className="btn" type="button" onClick={resetLab}>
              重置实验
            </button>
          </div>

          <div id="yolo-detection-canvas" onClick={() => reportClick('yolo-detection-canvas')} className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>观察低分假框消失</h3>
            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '14px' }}>
              {/* 演示免责声明 */}
              <div style={{ gridColumn: '1 / -1', padding: '8px 14px', borderRadius: '10px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>📺 本页为教学演示动画：预测框的移动基于预设模板插值，而非真实神经网络前向传播。真实 YOLO 训练需要 GPU + 大规模数据集。</span>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: '320px',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background:
                    'radial-gradient(circle at 28% 32%, rgba(251, 191, 36, 0.12), transparent 20%), radial-gradient(circle at 64% 58%, rgba(96, 165, 250, 0.14), transparent 18%), linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.92))'
                }}
              >
                <div style={{ position: 'absolute', left: '18%', top: '15%', width: '20%', height: '46%', borderRadius: '999px', background: 'rgba(226, 232, 240, 0.14)' }} />
                <div style={{ position: 'absolute', left: '60%', top: '52%', width: '16%', height: '14%', borderRadius: '10px', background: 'rgba(226, 232, 240, 0.14)' }} />

                {withStatus.map((box) => (
                  <div
                    key={box.id}
                    style={{
                      position: 'absolute',
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.w}%`,
                      height: `${box.h}%`,
                      borderRadius: '12px',
                      border: `3px solid ${box.color}`,
                      boxShadow: box.status === '最终保留' ? `0 0 20px ${box.color}55` : 'none',
                      opacity: box.status === '低于阈值' ? 0.2 : box.status === '被 NMS 抑制' ? 0.42 : 1
                    }}
                  />
                ))}
              </div>

              <div id="yolo-status-panel" onClick={() => reportClick('yolo-status-panel')} style={{ padding: '16px', borderRadius: '18px', background: 'rgba(2, 6, 23, 0.36)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
                <div style={{ fontSize: '0.78rem', color: 'rgba(148, 163, 184, 0.9)' }}>候选框状态表</div>
                <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                  {withStatus.map((box) => (
                    <div
                      key={`${box.id}-${box.status}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.54)'
                      }}
                    >
                      <span style={{ color: '#e2e8f0' }}>{box.label}</span>
                      <strong style={{ color: box.color }}>{box.score.toFixed(2)}</strong>
                      <span style={{ color: 'rgba(226, 232, 240, 0.72)', fontSize: '0.8rem' }}>{box.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isNmsStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>第 4 步：理解 NMS</h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                现在低分框已经处理掉，页面只保留 NMS 所需控件和重复框状态。拖动阈值观察两个“人”框何时只剩一个。
              </p>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#f8fafc' }}>NMS IoU 阈值</span>
                <strong style={{ color: '#60a5fa' }}>{nmsThreshold.toFixed(2)}</strong>
              </div>
              <input
                id="yolo-nms-slider"
                type="range"
                min="0.2"
                max="0.9"
                step="0.01"
                value={nmsThreshold}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setNmsThreshold(value);
                  reportValueChange('yolo-nms-slider', value);
                }}
                style={{ width: '100%', marginTop: '10px' }}
              />
              <div style={{ marginTop: '8px', color: 'rgba(226, 232, 240, 0.68)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                同类框重叠超过这个值时，低分框会被抑制。
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ fontSize: '0.76rem', color: '#7dd3fc' }}>观察重点</div>
              <div style={{ marginTop: '8px', color: '#f8fafc', lineHeight: 1.7 }}>
                看看两个“人”框在什么时候会因为重叠太高而只保留分数更高的那个。
              </div>
            </div>

            <button className="btn" type="button" onClick={resetLab}>
              重置实验
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '14px' }}>
            <div id="yolo-detection-canvas" onClick={() => reportClick('yolo-detection-canvas')} style={{ padding: '16px', borderRadius: '18px', background: 'rgba(2, 6, 23, 0.36)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <div style={{ fontSize: '0.78rem', color: 'rgba(148, 163, 184, 0.9)' }}>检测画布</div>
              <div
                style={{
                  marginTop: '12px',
                  position: 'relative',
                  height: '320px',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background:
                    'radial-gradient(circle at 28% 32%, rgba(251, 191, 36, 0.12), transparent 20%), radial-gradient(circle at 64% 58%, rgba(96, 165, 250, 0.14), transparent 18%), linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.92))'
                }}
              >
                {/* 演示免责声明 */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>📺 演示动画</span>
                </div>
                <div style={{ position: 'absolute', left: '18%', top: '15%', width: '20%', height: '46%', borderRadius: '999px', background: 'rgba(226, 232, 240, 0.14)' }} />
                <div style={{ position: 'absolute', left: '60%', top: '52%', width: '16%', height: '14%', borderRadius: '10px', background: 'rgba(226, 232, 240, 0.14)' }} />

                {withStatus.map((box) => (
                  <div
                    key={box.id}
                    style={{
                      position: 'absolute',
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.w}%`,
                      height: `${box.h}%`,
                      borderRadius: '12px',
                      border: `3px solid ${box.color}`,
                      boxShadow: box.status === '最终保留' ? `0 0 20px ${box.color}55` : 'none',
                      opacity: box.status === '低于阈值' ? 0.2 : box.status === '被 NMS 抑制' ? 0.42 : 1
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-28px',
                        left: 0,
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: box.color,
                        color: '#0f172a',
                        fontSize: '0.76rem',
                        fontWeight: 700
                      }}
                    >
                      {box.label} {box.score.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="yolo-status-panel" onClick={() => reportClick('yolo-status-panel')} style={{ padding: '16px', borderRadius: '18px', background: 'rgba(2, 6, 23, 0.36)', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <div style={{ fontSize: '0.78rem', color: 'rgba(148, 163, 184, 0.9)' }}>候选框状态表</div>
              <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                {withStatus.map((box) => (
                  <div
                    key={`${box.id}-${box.status}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.54)'
                    }}
                  >
                    <span style={{ color: '#e2e8f0' }}>{box.label}</span>
                    <strong style={{ color: box.color }}>{box.score.toFixed(2)}</strong>
                    <span style={{ color: 'rgba(226, 232, 240, 0.72)', fontSize: '0.8rem' }}>{box.status}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                {[
                  { title: '阈值过滤', value: `${filteredCount} 个低分框`, color: '#fbbf24' },
                  { title: 'NMS', value: `${suppressedCount} 个重复框`, color: '#60a5fa' }
                ].map((item) => (
                  <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.56)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.88)' }}>{item.title}</div>
                    <div style={{ marginTop: '6px', color: item.color, fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {scenarioEnabled && (
        <>
          <SpotlightOverlay onNextStep={nextStep} />
          <div style={{ position: 'fixed', right: 16, top: 90, zIndex: 10003 }}>
            <PedagogySidebar
              currentExperiment={currentExperiment}
              currentStepIndex={currentStepIndex}
              labId="YOLO"
            />
          </div>
        </>
      )}
    </div>
  );
}
