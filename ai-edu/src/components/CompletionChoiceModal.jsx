import React, { useState, useCallback } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import './TutorialModal.css';

/**
 * 实验完成选择界面
 * 让学生选择进入下一章或自由探索模式，并生成实验报告
 */
export const CompletionChoiceModal = ({
  currentLabTitle,
  hasNextLab,
  nextLabTitle,
  onNextLab,
  onFreeExplore,
  onRestartTutorial
}) => {
  const completionChoiceMode = usePedagogyStore(state => state.completionChoiceMode);
  const reportContent = usePedagogyStore(state => state.reportContent);
  const generateReport = usePedagogyStore(state => state.generateReport);
  const downloadReport = usePedagogyStore(state => state.downloadReport);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const handleGenerateReport = useCallback(async () => {
    if (isGenerating || !completionChoiceMode) return;

    setIsGenerating(true);
    try {
      await generateReport();
      setShowReport(true);
    } catch (err) {
      console.error('生成报告失败:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, completionChoiceMode, generateReport]);

  const handleDownloadReport = useCallback(async () => {
    if (!reportContent) {
      setShowReport(true);
      await handleGenerateReport();
    }
    await downloadReport();
  }, [reportContent, downloadReport, handleGenerateReport]);

  const toggleReport = useCallback(() => {
    setShowReport(prev => !prev);
  }, []);

  if (!completionChoiceMode) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10006 }}>
      <div className="modal-content glass-panel completion-modal">
        <div className="completion-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="url(#completionGradient)" strokeWidth="3" fill="none"/>
            <path d="M20 32L28 40L44 24" stroke="url(#completionGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="completionGradient" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#00d9ff"/>
                <stop offset="100%" stopColor="#00ff88"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="modal-title text-gradient">"{currentLabTitle}" 完成!</h2>
        <p className="completion-message">
          太棒了！你已经掌握了本章节的核心概念。
        </p>

        {/* 实验报告区域 */}
        <div className="completion-report-section">
          <div
            className="report-toggle-btn"
            onClick={toggleReport}
          >
            <span className="report-icon">📋</span>
            <span className="report-label">实验报告</span>
            {reportContent && <span className="report-badge">已生成</span>}
            <span className="report-arrow">{showReport ? '▼' : '▶'}</span>
          </div>

          {showReport && (
            <div className="report-preview">
              {isGenerating ? (
                <div className="report-loading">
                  <div className="loading-spinner"></div>
                  <span>AI 正在生成个性化实验报告...</span>
                </div>
              ) : reportContent ? (
                <div className="report-content-wrapper">
                  <pre className="report-text">{reportContent}</pre>
                </div>
              ) : (
                <div className="report-empty">
                  <p>点击下方按钮生成你的专属学习报告</p>
                </div>
              )}

              <div className="report-actions">
                {!reportContent ? (
                  <button
                    className="btn btn-primary report-btn"
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                  >
                    {isGenerating ? '生成中...' : '✨ 生成 AI 实验报告'}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn report-btn"
                      onClick={handleGenerateReport}
                      disabled={isGenerating}
                    >
                      🔄 重新生成
                    </button>
                    <button
                      className="btn btn-primary report-btn"
                      onClick={handleDownloadReport}
                    >
                      📥 下载报告
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="completion-choices">
          {hasNextLab && (
            <button
              className="btn btn-primary completion-btn"
              onClick={onNextLab}
            >
              <span className="btn-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="btn-text">
                <span className="btn-label">进入下一章</span>
                <span className="btn-sublabel">{nextLabTitle}</span>
              </span>
            </button>
          )}

          <button
            className="btn completion-btn"
            onClick={onFreeExplore}
          >
            <span className="btn-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="btn-text">
              <span className="btn-label">自由探索</span>
              <span className="btn-sublabel">继续在这个实验室自由实验</span>
            </span>
          </button>

          <button
            className="btn completion-btn completion-btn-secondary"
            onClick={onRestartTutorial}
          >
            <span className="btn-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10C4 6.68629 6.68629 4 10 4C12.2208 4 14.1599 5.21171 15.1973 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 10C16 13.3137 13.3137 16 10 16C7.77915 16 5.84008 14.7883 4.80269 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M15 4V7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 16V13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="btn-text">
              <span className="btn-label">重新开始</span>
              <span className="btn-sublabel">再次跟随教程学习</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};