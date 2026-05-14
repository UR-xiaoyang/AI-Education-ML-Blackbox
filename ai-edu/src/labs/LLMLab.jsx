import React, { useEffect, useRef, useState, useCallback } from 'react';
import useLLMStore, { TRAINING_THEMES } from '../store/llmStore';
import { llmScenarios } from '../store/scenarioConfig';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';
import {
  TokenEmbedViz,
  AttentionViz,
  LLMFlowViz,
  LLMLossChart,
  LLMControlPanel,
  LLMGenerationPanel,
  TokenizationViz,
} from '../components/LLMViz';
import './LLMLab.css';

export default function LLMLab({ scenarioEnabled = false }) {
  const {
    // State
    isModelInitialized,
    isTraining,
    trainingStep,
    lossHistory,
    learningRate,
    mode,
    currentTokens,
    embeddings,
    attentionWeights,
    promptTokens,
    generatedTokens,
    generationProbs,
    temperature,
    selectedTheme,
    config,

    // Actions
    initializeModel,
    setLearningRate,
    setIsTraining,
    setTemperature,
    trainStep,
    reset,
    setMode,
    setPrompt,
    generateOneToken,
    selectTheme,
  } = useLLMStore();

  // Local state
  const [prompt, setPromptInput] = useState('');

  // Scenario engine
  const {
    currentExperiment,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep,
  } = useScenarioEngine(llmScenarios, scenarioEnabled, false, null, 'LLM');

  // Animation refs
  const animationRef = useRef(null);
  const lastTrainingStep = useRef(trainingStep);

  // Initialize model on mount
  useEffect(() => {
    if (!isModelInitialized) {
      initializeModel();
    }
  }, [isModelInitialized, initializeModel]);

  // Track training completion for AUTO_INTERCEPT
  useEffect(() => {
    if (scenarioEnabled && !isTraining && trainingStep > lastTrainingStep.current) {
      lastTrainingStep.current = trainingStep;
    }
  }, [trainingStep, isTraining, scenarioEnabled]);

  // Training animation loop
  useEffect(() => {
    if (!isTraining) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      for (let i = 0; i < 5; i++) {
        trainStep();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isTraining, trainStep]);

  // Handlers
  const handleTrainStep = useCallback(() => {
    trainStep();
    if (scenarioEnabled) {
      reportClick('llm-loss-chart');
    }
  }, [trainStep, scenarioEnabled, reportClick]);

  const handleToggleTraining = useCallback(() => {
    setIsTraining(!isTraining);
    if (scenarioEnabled && !isTraining) {
      reportClick('llm-loss-chart');
    }
  }, [isTraining, setIsTraining, scenarioEnabled, reportClick]);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
  }, [setMode]);

  const handlePromptChange = useCallback((text) => {
    setPromptInput(text);
    if (text.trim()) {
      setPrompt(text);
    }
  }, [setPrompt]);

  const handleGenerate = useCallback(() => {
    if (prompt.trim()) {
      setPrompt(prompt);
    }
    for (let i = 0; i < 10; i++) {
      const nextToken = generateOneToken();
      if (nextToken === null) break;
    }
    if (scenarioEnabled) {
      reportClick('llm-generation-panel');
    }
  }, [prompt, setPrompt, generateOneToken, scenarioEnabled, reportClick]);

  const handleGenerateStep = useCallback(() => {
    if (prompt.trim()) {
      setPrompt(prompt);
    }
    generateOneToken();
  }, [prompt, setPrompt, generateOneToken]);

  const handleReset = useCallback(() => {
    reset();
    setPromptInput('');
  }, [reset]);

  const handleLearningRateChange = useCallback((newLR) => {
    setLearningRate(newLR);
    if (scenarioEnabled) {
      reportValueChange(newLR);
    }
  }, [setLearningRate, scenarioEnabled, reportValueChange]);

  // Get current corpus info
  const currentCorpus = TRAINING_THEMES[selectedTheme]?.corpus || [];

  if (!isModelInitialized) {
    return (
      <div className="llm-lab loading">
        <div className="loading-spinner">初始化模型中...</div>
      </div>
    );
  }

  return (
    <div className="llm-lab">
      {/* Main Layout */}
      <div className="llm-lab-layout">
        {/* Left Column - Training Visualization */}
        <div className="llm-lab-column left-column">
          {mode === 'train' ? (
            <>
              <div id="llm-tokenization">
                <TokenizationViz tokens={currentTokens} />
              </div>
              <div id="llm-loss-chart">
                <LLMLossChart
                  lossHistory={lossHistory}
                  width={350}
                  height={180}
                />
              </div>
              <div id="llm-flow-viz">
                <LLMFlowViz
                  tokens={currentTokens}
                  isTraining={isTraining}
                />
              </div>
            </>
          ) : (
            <>
              <div id="llm-tokenization">
                <TokenizationViz tokens={promptTokens} />
              </div>
              <div id="llm-token-embed">
                <TokenEmbedViz
                  tokens={promptTokens}
                  embeddings={embeddings}
                />
              </div>
              <div id="llm-attention-viz">
                <AttentionViz
                  tokens={promptTokens}
                  attentionWeights={attentionWeights}
                  numHeads={config.numHeads}
                />
              </div>
            </>
          )}
        </div>

        {/* Center Column - Content */}
        <div className="llm-lab-column center-column">
          {mode === 'train' ? (
            <div className="training-info glass-panel" id="llm-training-info">
              <h3>训练主题: {TRAINING_THEMES[selectedTheme]?.name}</h3>

              {/* 主题选择按钮 */}
              <div className="theme-selector">
                <button
                  className={`theme-btn ${selectedTheme === 'qa' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('qa');
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  问答训练
                </button>
                <button
                  className={`theme-btn ${selectedTheme === 'story' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('story');
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  故事生成
                </button>
                <button
                  className={`theme-btn ${selectedTheme === 'technical' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('technical');
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  技术文档
                </button>
              </div>

              <p className="theme-desc">{TRAINING_THEMES[selectedTheme]?.description}</p>

              <div className="corpus-preview">
                <span className="section-label">训练语料 ({currentCorpus.length} 条):</span>
                <div className="corpus-list">
                  {currentCorpus.map((text, i) => (
                    <div key={i} className="corpus-item">
                      {text.slice(0, 30)}
                      {text.length > 30 ? '...' : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className="model-stats">
                <div className="stat">
                  <span className="stat-label">词表大小</span>
                  <span className="stat-value">{config.vocabSize}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">嵌入维度</span>
                  <span className="stat-value">{config.embedDim}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">注意力头</span>
                  <span className="stat-value">{config.numHeads}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">上下文长度</span>
                  <span className="stat-value">{config.contextLen}</span>
                </div>
              </div>
            </div>
          ) : (
            <div id="llm-generation-panel">
              <LLMGenerationPanel
                prompt={prompt}
                onPromptChange={handlePromptChange}
                onGenerate={handleGenerate}
                onGenerateStep={handleGenerateStep}
                generatedTokens={generatedTokens}
                generationProbs={generationProbs}
              />
            </div>
          )}
        </div>

        {/* Right Column - Controls */}
        <div className="llm-lab-column right-column">
          <div id="llm-control-panel">
            <LLMControlPanel
              onTrainStep={handleTrainStep}
              onToggleTraining={handleToggleTraining}
              onReset={handleReset}
              isTraining={isTraining}
              learningRate={learningRate}
              setLearningRate={handleLearningRateChange}
              temperature={temperature}
              setTemperature={setTemperature}
              trainingStep={trainingStep}
              lossHistory={lossHistory}
              mode={mode}
              onModeChange={handleModeChange}
            />
          </div>
        </div>
      </div>

      {/* Footer explanation */}
      <div className="llm-lab-footer">
        <div className="explanation-card glass-panel">
          <h4>LLM 是如何工作的？</h4>
          <div className="explanation-grid">
            <div className="explanation-item">
              <span className="step">1</span>
              <div>
                <strong>Token 嵌入</strong>
                <p>将每个词转换为向量表示</p>
              </div>
            </div>
            <div className="explanation-item">
              <span className="step">2</span>
              <div>
                <strong>位置编码</strong>
                <p>添加序列位置信息</p>
              </div>
            </div>
            <div className="explanation-item">
              <span className="step">3</span>
              <div>
                <strong>自注意力</strong>
                <p>计算词与词之间的关联</p>
              </div>
            </div>
            <div className="explanation-item">
              <span className="step">4</span>
              <div>
                <strong>输出预测</strong>
                <p>预测下一个最可能的词</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pedagogy Overlay */}
      {scenarioEnabled && (
        <>
          <SpotlightOverlay onNextStep={nextStep} />
          <div className="pedagogy-sidebar-container">
            <PedagogySidebar
              currentExperiment={currentExperiment}
              currentStepIndex={currentStepIndex}
              labId="LLM"
            />
          </div>
        </>
      )}
    </div>
  );
}