import React, { useState, useEffect, useRef } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import './PedagogySidebar.css';

export const PedagogySidebar = ({
  currentExperiment,
  currentStepIndex,
  labId,
  style = {},
  // 新增：引导模式专用 props
  currentGuideStep = null,
  onGuideNextStep = null,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [reportExpanded, setReportExpanded] = useState(false);
  const reflectionPanelRef = useRef(null);

  const studentAnswers = usePedagogyStore(state => state.studentAnswers);
  // 过滤出当前章节的反思记录
  const currentLabAnswers = labId
    ? studentAnswers.filter(a => a.labId === labId)
    : studentAnswers;
  const pendingReflections = usePedagogyStore(state => state.pendingReflections);
  const reflectionModeActive = usePedagogyStore(state => state.reflectionModeActive);
  const currentReflectionIndex = usePedagogyStore(state => state.currentReflectionIndex);
  const reportContent = usePedagogyStore(state => state.reportContent);
  const jumpToStep = usePedagogyStore(state => state.jumpToStep);
  const submitPendingReflection = usePedagogyStore(state => state.submitPendingReflection);
  const generateReport = usePedagogyStore(state => state.generateReport);
  const downloadReport = usePedagogyStore(state => state.downloadReport);
  const addStudentAnswer = usePedagogyStore(state => state.addStudentAnswer);

  // Get current pending reflection to display
  const currentReflection = reflectionModeActive && pendingReflections.length > 0
    ? pendingReflections[currentReflectionIndex]
    : null;

  // Auto-scroll to reflection panel when it becomes active
  useEffect(() => {
    if (reflectionModeActive) {
      setIsCollapsed(false); // Expand sidebar when entering reflection mode
      // Delay scroll to allow sidebar to render
      setTimeout(() => {
        if (reflectionPanelRef.current) {
          reflectionPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [reflectionModeActive]);

  if (!currentExperiment) return null;

  const steps = currentExperiment.steps || [];
  const progressPercent = steps.length > 0 ? (currentStepIndex / steps.length) * 100 : 0;

  const handleJumpToStep = (index) => {
    if (index < currentStepIndex) {
      jumpToStep(index);
    }
  };

  const getStepIcon = (index) => {
    if (index < currentStepIndex) return '✓';
    if (index === currentStepIndex) return '●';
    return '○';
  };

  // Collapsed state - show narrow bar with toggle button
  if (isCollapsed) {
    return (
      <aside className="pedagogy-sidebar collapsed" style={style}>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(false)}
          title="展开教学助手"
        >
          🧭
        </button>
      </aside>
    );
  }

  return (
    <aside className="pedagogy-sidebar" style={style}>
      <div className="sidebar-header">
        <h3>
          🧭 教学助手
          {reflectionModeActive && pendingReflections.length > 0 && (
            <span style={{
              marginLeft: '8px',
              fontSize: '0.7rem',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              padding: '2px 8px',
              borderRadius: '10px',
              color: '#fff'
            }}>
              反思问答中
            </span>
          )}
        </h3>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setIsCollapsed(true)}
          title="收起侧边栏"
        >
          ◀
        </button>
      </div>

      {/* Show banner when in reflection mode */}
      {reflectionModeActive && pendingReflections.length > 0 && (
        <div className="reflection-banner" style={{ background: '#4ade80', color: '#000', padding: '10px', borderRadius: '4px', marginBottom: '8px' }}>
          <p>📝 【反思问题已加载】请回答以下反思问题（共 {pendingReflections.length} 题）</p>
        </div>
      )}

      {/* 如果 reflectionModeActive 为 true 但 pendingReflections 为空，显示警告 */}
      {reflectionModeActive && pendingReflections.length === 0 && (
        <div style={{ background: '#ff4d4f', color: '#fff', padding: '10px', borderRadius: '4px', marginBottom: '8px' }}>
          ⚠️ 反思模式已启动，但待回答问题列表为空！请检查控制台日志。
        </div>
      )}

      {!reflectionModeActive && (
        <>
          <div className="current-experiment-info">
            <div className="experiment-title">{currentExperiment.title}</div>
            <div className="step-counter">步骤 {currentStepIndex + 1} / {steps.length}</div>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>

          {/* 引导模式：显示当前步骤的完整引导文案 */}
          {currentGuideStep && (
            <div className="guide-current-step">
              <div className="guide-step-content">
                <span className="guide-icon">💡</span>
                <p className="guide-message">{currentGuideStep.guidanceText}</p>
              </div>

              {/* 反思步骤显示反思输入框 */}
              {currentGuideStep.trigger === 'reflection' && (
                <div className="guide-reflection-input">
                  <textarea
                    className="reflection-textarea"
                    value={reflectionAnswer}
                    onChange={(e) => setReflectionAnswer(e.target.value)}
                    placeholder={`请输入你的反思（至少 15 字）...`}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '13px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      resize: 'none',
                      marginTop: '10px',
                    }}
                    rows="3"
                  />
                  <div style={{
                    textAlign: 'right',
                    fontSize: '11px',
                    marginTop: '4px',
                    color: reflectionAnswer.trim().length >= 15 ? '#4ade80' : '#f87171'
                  }}>
                    {reflectionAnswer.length} / 15 字
                  </div>
                </div>
              )}

              {/* 下一步按钮 */}
              {currentGuideStep.allowNextButton || currentGuideStep.trigger === 'reflection' ? (
                <button
                  className="btn btn-primary guide-next-btn"
                  onClick={() => {
                    // 如果是反思步骤，保存答案
                    if (currentGuideStep.trigger === 'reflection') {
                      if (reflectionAnswer.trim().length < 15) {
                        alert('请更深入地描述你的思考（至少 15 个字符）');
                        return;
                      }
                      addStudentAnswer({
                        labId: labId || 'DT',
                        questionId: currentGuideStep.id,
                        questionText: currentGuideStep.guidanceText,
                        answer: reflectionAnswer
                      });
                      setReflectionAnswer('');
                    }
                    onGuideNextStep?.();
                  }}
                >
                  {currentGuideStep.trigger === 'reflection' ? '提交并继续' : '下一步'}
                </button>
              ) : (
                <div className="guide-waiting-hint" style={{
                  textAlign: 'center',
                  padding: '10px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic'
                }}>
                  等待操作完成...
                </div>
              )}
            </div>
          )}

          {/* 非引导模式：显示步骤列表 */}
          {!currentGuideStep && (
            <div className="steps-list">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`step-item ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : 'future'}`}
                  onClick={() => handleJumpToStep(index)}
                  title={step.guidanceText}
                >
                  <span className="step-number">{index + 1}</span>
                  <span className="step-status">{getStepIcon(index)}</span>
                  <span className="step-preview">
                    {step.guidanceText.length > 35
                      ? step.guidanceText.slice(0, 35) + '...'
                      : step.guidanceText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reflection Input Panel - shown when reflection mode is active */}
      {currentReflection && (
        <div className="reflection-panel" ref={reflectionPanelRef}>
          <h4>💭 现象反思 <span style={{ fontSize: '0.75em', opacity: 0.7 }}>
            ({currentReflectionIndex + 1}/{pendingReflections.length})
          </span></h4>
          <p className="reflection-question">{currentReflection.questionText}</p>
          <textarea
            className="reflection-textarea"
            value={reflectionAnswer}
            onChange={(e) => setReflectionAnswer(e.target.value)}
            placeholder={`请在此输入你的反思与推导（不要害怕答错，说出你的直觉，至少 ${currentReflection.minChars} 字）...`}
          />
          <button
            className="btn btn-primary reflection-submit"
            onClick={() => {
              if (reflectionAnswer.trim().length < currentReflection.minChars) {
                alert(`请更深入地描述你的思考（至少 ${currentReflection.minChars} 个字符）。这有助于你真正理解背后的原理！`);
                return;
              }
              const allDone = submitPendingReflection(reflectionAnswer);
              setReflectionAnswer('');
            }}
          >
            {currentReflectionIndex < pendingReflections.length - 1
              ? '提交并继续下一题'
              : '提交并完成反思'}
          </button>
        </div>
      )}

      {/* Show message when all reflections are done but we're still in reflection mode */}
      {reflectionModeActive && !currentReflection && pendingReflections.length > 0 && (
        <div className="reflection-panel" style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: 'var(--accent-green)', marginBottom: '10px' }}>
            ✓ 所有反思问题已回答完毕！
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            请点击"下一步"继续...
          </p>
        </div>
      )}

      {/* Experiment Report Section */}
      <div className="report-section">
        <h4 onClick={() => {
          if (!reportContent) generateReport();
          setReportExpanded(!reportExpanded);
        }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 实验报告
          <span style={{ fontSize: '0.8em', opacity: 0.6 }}>
            {reportExpanded ? '▼' : '▶'}
          </span>
        </h4>

        {reportExpanded && (
          <div className="report-content">
            <div className="report-text">
              <pre>{reportContent || '点击展开按钮生成报告...'}</pre>
            </div>
            <div className="report-actions">
              <button
                className="btn"
                onClick={() => generateReport()}
              >
                刷新报告
              </button>
              <button
                className="btn btn-primary"
                onClick={() => downloadReport()}
              >
                下载报告
              </button>
            </div>
          </div>
        )}
      </div>

      {currentLabAnswers && currentLabAnswers.length > 0 && (
        <div className="answers-section">
          <h4>💬 反思记录</h4>
          {currentLabAnswers.slice(-3).map((answer, index) => (
            <div key={index} className="answer-card">
              <div className="question-text">
                {answer.question?.length > 50
                  ? answer.question?.slice(0, 50) + '...'
                  : answer.question}
              </div>
              <div className="answer-text">
                {answer.answer?.length > 80
                  ? answer.answer?.slice(0, 80) + '...'
                  : answer.answer}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default PedagogySidebar;
