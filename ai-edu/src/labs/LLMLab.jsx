import React, { useEffect, useRef, useState, useCallback } from 'react';
import useLLMStore, { TRAINING_THEMES } from '../store/llmStore';
import { TOKENIZER_OPTIONS } from '../utils/miniLLMEngine';
import { llmScenarios } from '../store/scenarioConfig';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';
import LearningCompanion from '../components/LearningCompanion';
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

const DEFAULT_CLEANING_RULES = {
  parseFormat: true,
  extractText: true,
  fixEncoding: true,
  detectLanguage: true,
  ruleFilter: true,
  qualityFilter: true,
  privacyMask: true,
  safetyFilter: true,
  dedupe: true,
  qualityScore: true,
  domainClassify: true,
  samplingMix: true,
  humanReview: true,
  buildDataset: true,
};

const DATA_PIPELINE_STAGES = [
  { id: 'collect', title: '原始数据采集', fixed: true },
  { id: 'parseFormat', title: '格式解析' },
  { id: 'extractText', title: '文本抽取' },
  { id: 'fixEncoding', title: '编码/乱码修复' },
  { id: 'detectLanguage', title: '语言识别' },
  { id: 'ruleFilter', title: '规则过滤' },
  { id: 'qualityFilter', title: '低质量过滤' },
  { id: 'privacyMask', title: '隐私信息脱敏' },
  { id: 'safetyFilter', title: '安全内容过滤' },
  { id: 'dedupe', title: '去重' },
  { id: 'qualityScore', title: '质量打分' },
  { id: 'domainClassify', title: '领域分类' },
  { id: 'samplingMix', title: '采样配比' },
  { id: 'humanReview', title: '人工抽检' },
  { id: 'buildDataset', title: '生成训练集' },
];

const buildDirtySamples = (corpus) => {
  const fallback = corpus[0] || '';
  const second = corpus[1] || fallback;
  const third = corpus[2] || fallback;
  const repeatedPrefix = third.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');

  return [
    `{ "source": "forum", "lang": "zh", "domain": "qa", "content": "${fallback}", "email": "student@example.com", "url": "https://spam.example/claim 广告链接" }`,
    `<html><body><article data-lang="zh">用户输入&gt;&gt;&gt; ${second.replace(/\s+/g, '　　')} </article><aside>###广告### 点击领取奖励</aside></body></html>`,
    `来源:爬虫\n编码:UTF-8\n正文:${third} ${repeatedPrefix} ${repeatedPrefix}[重复采样]\n备注:低质水印 low-quality spam`,
  ];
};

const decodeHtmlEntities = (value) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&gt;/gi, '>')
  .replace(/&lt;/gi, '<')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

const normalizeWhitespace = (value) => value
  .replace(/[\u3000\t\r\f\v]+/g, ' ')
  .replace(/\s*\n\s*/g, '\n')
  .replace(/[ ]{2,}/g, ' ')
  .trim();

const flattenJsonText = (value) => {
  try {
    const parsed = JSON.parse(value);
    const fragments = [];
    const isNaturalText = (item) => {
      const trimmed = item.trim();
      const zhChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
      const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
      return trimmed
        && !/^https?:\/\//i.test(trimmed)
        && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed)
        && (zhChars >= 4 || tokenCount >= 3);
    };
    const walk = (item) => {
      if (typeof item === 'string' && isNaturalText(item)) fragments.push(item);
      else if (Array.isArray(item)) item.forEach(walk);
      else if (item && typeof item === 'object') Object.values(item).forEach(walk);
    };
    walk(parsed);
    return fragments.join('\n');
  } catch {
    return value;
  }
};

const removeRepeatedAdjacentTokens = (value) => {
  const tokens = value.split(/\s+/).filter(Boolean);
  const deduped = [];

  tokens.forEach((token) => {
    if (token !== deduped[deduped.length - 1]) deduped.push(token);
  });

  for (let size = Math.min(6, Math.floor(deduped.length / 2)); size >= 2; size -= 1) {
    for (let index = 0; index <= deduped.length - size * 2; index += 1) {
      const first = deduped.slice(index, index + size).join('\u0000');
      const second = deduped.slice(index + size, index + size * 2).join('\u0000');
      if (first === second) {
        deduped.splice(index + size, size);
        index -= 1;
      }
    }
  }

  return deduped.join(' ');
};

const cleanTrainingText = (rawText, rules, maxStageIndex = DATA_PIPELINE_STAGES.length - 1) => {
  const enabledRules = Object.values(rules).filter(Boolean).length;
  let text = rawText || '';
  const originalTokens = text.trim() ? text.trim().split(/\s+/).length : 0;
  let datasetSize = 1;
  let language = '未识别';
  let domain = '未分类';
  let qualityScore = 0;
  let humanReview = '未抽检';
  const stageResults = [{
    id: 'collect',
    title: '原始数据采集',
    status: 'done',
    detail: '采集 1 条原始记录',
    before: '',
    after: text,
    deltaChars: text.length,
  }];

  const applyStep = (id, label, transform) => {
    const before = text;
    text = transform(text);
    const changed = before !== text;
    stageResults.push({
      id,
      title: label,
      status: changed ? 'changed' : 'done',
      detail: changed ? '已处理并改变文本' : '通过，无需改写',
      before,
      after: text,
      deltaChars: before.length - text.length,
    });
  };

  const skipStep = (id, label) => {
    stageResults.push({ id, title: label, status: 'skipped', detail: '已关闭', before: text, after: text, deltaChars: 0 });
  };

  DATA_PIPELINE_STAGES.slice(1, maxStageIndex + 1).forEach((stage) => {
    if (!rules[stage.id]) {
      skipStep(stage.id, stage.title);
      return;
    }

    if (stage.id === 'parseFormat') {
      applyStep(stage.id, stage.title, value => normalizeWhitespace(flattenJsonText(value).replace(/\\n/g, '\n')));
      return;
    }

    if (stage.id === 'extractText') {
      applyStep(stage.id, stage.title, value => {
        const withoutHtml = value
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/用户输入&gt;&gt;&gt;|用户输入>>>/g, ' ');

        return normalizeWhitespace(withoutHtml
          .split('\n')
          .map(line => line.replace(/^(来源|编码|备注)\s*[:：].*$/i, ' '))
          .join('\n'));
      });
      return;
    }

    if (stage.id === 'fixEncoding') {
      applyStep(stage.id, stage.title, value => normalizeWhitespace(decodeHtmlEntities(value).replace(/[�]+/g, '')));
      return;
    }

    if (stage.id === 'detectLanguage') {
      const zhChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      language = zhChars > Math.max(3, text.length * 0.15) ? '中文' : '其他/混合';
      stageResults.push({ id: stage.id, title: stage.title, status: language === '中文' ? 'done' : 'changed', detail: `识别为${language}`, before: text, after: text, deltaChars: 0 });
      return;
    }

    if (stage.id === 'ruleFilter') {
      applyStep(stage.id, stage.title, value => normalizeWhitespace(value
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\b(?:source|lang|domain|url|email)\b/gi, ' ')
        .replace(/###.*?###/g, ' ')
        .replace(/点击领取奖励/g, ' ')
        .replace(/广告链接/g, ' ')
        .replace(/来源[:：][^\s]+/g, ' ')));
      return;
    }

    if (stage.id === 'qualityFilter') {
      applyStep(stage.id, stage.title, value => normalizeWhitespace(value
        .replace(/低质水印|low-quality|spam/gi, ' ')
        .replace(/\[重复采样\]/g, ' ')
        .replace(/[/｜|]+/g, ' ')));
      return;
    }

    if (stage.id === 'privacyMask') {
      applyStep(stage.id, stage.title, value => value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱已脱敏]'));
      return;
    }

    if (stage.id === 'safetyFilter') {
      applyStep(stage.id, stage.title, value => normalizeWhitespace(value.replace(/广告|奖励|spam/gi, ' ')));
      return;
    }

    if (stage.id === 'dedupe') {
      applyStep(stage.id, stage.title, removeRepeatedAdjacentTokens);
      return;
    }

    if (stage.id === 'qualityScore') {
      const tokenCount = text.split(/\s+/).filter(Boolean).length;
      const unknownPenalty = /\[邮箱已脱敏\]|https?:|###|low-quality|spam/i.test(text) ? 18 : 0;
      qualityScore = Math.max(35, Math.min(98, 62 + tokenCount * 3 - unknownPenalty));
      stageResults.push({ id: stage.id, title: stage.title, status: 'done', detail: `质量分 ${qualityScore}`, before: text, after: text, deltaChars: 0 });
      return;
    }

    if (stage.id === 'domainClassify') {
      if (/问题|回答/.test(text)) domain = '问答/知识';
      else if (/从前|故事|未来/.test(text)) domain = '故事生成';
      else domain = '技术文档';
      stageResults.push({ id: stage.id, title: stage.title, status: 'done', detail: domain, before: text, after: text, deltaChars: 0 });
      return;
    }

    if (stage.id === 'samplingMix') {
      datasetSize = qualityScore >= 85 ? 2 : 1;
      stageResults.push({ id: stage.id, title: stage.title, status: 'done', detail: `${domain} 权重 x${datasetSize}`, before: text, after: text, deltaChars: 0 });
      return;
    }

    if (stage.id === 'humanReview') {
      humanReview = qualityScore >= 70 ? '抽检通过' : '需复核';
      stageResults.push({ id: stage.id, title: stage.title, status: qualityScore >= 70 ? 'done' : 'changed', detail: humanReview, before: text, after: text, deltaChars: 0 });
      return;
    }

    if (stage.id === 'buildDataset') {
      applyStep(stage.id, stage.title, value => value.replace(/\s+/g, ' ').trim());
    }
  });

  const cleanedTokens = text ? text.split(/\s+/).length : 0;
  const removedTokens = Math.max(0, originalTokens - cleanedTokens);
  const generatedSamples = Array.from({ length: datasetSize }, (_, index) => index === 0 ? text : `${text} <EOS>`);
  const isDatasetReady = maxStageIndex >= DATA_PIPELINE_STAGES.length - 1 && rules.buildDataset;

  return {
    text,
    enabledRules,
    stageResults,
    originalTokens,
    cleanedTokens,
    removedTokens,
    removedChars: Math.max(0, rawText.length - text.length),
    language,
    domain,
    qualityScore,
    humanReview,
    generatedSamples: isDatasetReady ? generatedSamples : [],
    isDatasetReady,
  };
};

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
    currentText,
    embeddings,
    attentionWeights,
    promptTokens,
    generatedTokens,
    generationProbs,
    temperature,
    tokenizerMode,
    selectedTheme,
    config,

    // Actions
    initializeModel,
    setLearningRate,
    setIsTraining,
    setTemperature,
    setTokenizerMode,
    trainStep,
    trainSteps,
    reset,
    setMode,
    setPrompt,
    generateOneToken,
    clearGeneration,
    previewText,
    setTrainingCorpus,
    selectTheme,
  } = useLLMStore();

  // Local state
  const [prompt, setPromptInput] = useState('');
  const [trainingSpeed, setTrainingSpeed] = useState(5);
  const [selectedFlowStep, setSelectedFlowStep] = useState('data');
  const [selectedDirtyIndex, setSelectedDirtyIndex] = useState(0);
  const [cleaningRules, setCleaningRules] = useState(DEFAULT_CLEANING_RULES);
  const [pipelineCursor, setPipelineCursor] = useState(0);
  const [showTokenizerAfterCleaning, setShowTokenizerAfterCleaning] = useState(false);
  const [isDatasetConfirmed, setIsDatasetConfirmed] = useState(false);
  const [isTrainingCorpusGenerated, setIsTrainingCorpusGenerated] = useState(false);

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
      for (let i = 0; i < trainingSpeed; i++) {
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
  }, [isTraining, trainStep, trainingSpeed]);

  // Handlers
  const handleTrainStep = useCallback(() => {
    trainStep();
    if (scenarioEnabled) {
      reportClick('llm-train-step-button');
    }
  }, [trainStep, scenarioEnabled, reportClick]);

  const handleTrainBatch = useCallback((count) => {
    trainSteps(count);
    if (scenarioEnabled) {
      reportClick('llm-train-step-button');
    }
  }, [trainSteps, scenarioEnabled, reportClick]);

  const handleToggleTraining = useCallback(() => {
    setIsTraining(!isTraining);
    if (scenarioEnabled && !isTraining) {
      reportClick('llm-train-toggle-button');
    }
  }, [isTraining, setIsTraining, scenarioEnabled, reportClick]);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setSelectedFlowStep(newMode === 'inference' ? 'inference' : 'training');
    if (scenarioEnabled && newMode === 'inference') {
      reportClick('llm-mode-inference');
    }
  }, [setMode, scenarioEnabled, reportClick]);

  const handleFlowStepChange = useCallback((stepId) => {
    if ((stepId === 'training' || stepId === 'inference') && !isTrainingCorpusGenerated) {
      setSelectedFlowStep('data');
      setMode('train');
      return;
    }
    setSelectedFlowStep(stepId);
    if (stepId === 'inference' && mode !== 'inference') {
      setMode('inference');
    }
    if ((stepId === 'data' || stepId === 'training') && mode !== 'train') {
      setMode('train');
    }
  }, [mode, setMode, isTrainingCorpusGenerated]);

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

  const handleClearGeneration = useCallback(() => {
    clearGeneration();
  }, [clearGeneration]);

  const handleReset = useCallback(() => {
    reset();
    setPromptInput('');
  }, [reset]);

  const handleLearningRateChange = useCallback((newLR) => {
    setLearningRate(newLR);
    if (scenarioEnabled) {
      reportValueChange('llm-learning-rate-slider', newLR);
    }
  }, [setLearningRate, scenarioEnabled, reportValueChange]);

  const handleTemperatureChange = useCallback((newTemperature) => {
    setTemperature(newTemperature);
    if (scenarioEnabled) {
      reportValueChange('llm-temperature-slider', newTemperature);
    }
  }, [setTemperature, scenarioEnabled, reportValueChange]);

  const handleTokenizerModeChange = useCallback((newTokenizerMode) => {
    setTokenizerMode(newTokenizerMode);
    if (prompt.trim()) {
      setPrompt(prompt);
    }
    if (scenarioEnabled) {
      reportValueChange('llm-tokenizer-select', newTokenizerMode);
    }
  }, [prompt, setPrompt, setTokenizerMode, scenarioEnabled, reportValueChange]);

  const handlePipelineStep = useCallback(() => {
    setPipelineCursor(cursor => Math.min(cursor + 1, DATA_PIPELINE_STAGES.length - 1));
  }, []);

  const handlePipelineRunAll = useCallback(() => {
    setPipelineCursor(DATA_PIPELINE_STAGES.length - 1);
  }, []);

  const handlePipelineReset = useCallback(() => {
    setPipelineCursor(0);
    setShowTokenizerAfterCleaning(false);
    setIsTrainingCorpusGenerated(false);
  }, []);

  const handleTransferToTokenizer = useCallback((text) => {
    previewText(text);
    setShowTokenizerAfterCleaning(true);
  }, [previewText]);

  const handleConfirmDataset = useCallback(() => {
    setPipelineCursor(0);
    setShowTokenizerAfterCleaning(false);
    setIsTrainingCorpusGenerated(false);
    setIsDatasetConfirmed(true);
  }, []);

  const handleStartTrainingFromDataset = useCallback((samples) => {
    setTrainingCorpus(samples);
    setIsTrainingCorpusGenerated(true);
    setShowTokenizerAfterCleaning(false);
    setMode('train');
    setSelectedFlowStep('training');
  }, [setTrainingCorpus, setMode]);

  // Get current corpus info
  const currentCorpus = TRAINING_THEMES[selectedTheme]?.corpus || [];
  const dirtySamples = buildDirtySamples(currentCorpus);
  const dirtyText = dirtySamples[selectedDirtyIndex] || dirtySamples[0] || currentText || '';
  const cleaningResult = cleanTrainingText(dirtyText, cleaningRules, pipelineCursor);
  const cleanedText = cleaningResult.text;
  const currentPipelineStage = DATA_PIPELINE_STAGES[pipelineCursor];
  const currentStageResult = cleaningResult.stageResults.find(item => item.id === currentPipelineStage?.id);
  const pipelineProgress = Math.round(((pipelineCursor + 1) / DATA_PIPELINE_STAGES.length) * 100);
  const workingText = currentStageResult?.after || cleanedText || dirtyText;
  const activeScenarioStep = scenarioEnabled ? currentExperiment?.steps?.[currentStepIndex]?.id : null;
  const scenarioFlowStep = (() => {
    if (!activeScenarioStep) return null;
    if (['llm_step_3_first_train', 'llm_step_4_observe_loss', 'llm_step_5_switch_mode'].includes(activeScenarioStep)) {
      return 'training';
    }
    if (/^llm_step_(6|7|8|9|10)/.test(activeScenarioStep)) {
      return 'inference';
    }
    return null;
  })();
  const activeFlowStep = scenarioFlowStep || selectedFlowStep;
  const flowSteps = [
    {
      id: 'data',
      step: '01',
      title: '数据处理'
    },
    {
      id: 'training',
      step: '02',
      title: '模型训练'
    },
    {
      id: 'inference',
      step: '03',
      title: '推理调优'
    }
  ];

  if (!isModelInitialized) {
    return (
      <div className="llm-lab loading">
        <div className="loading-spinner">初始化模型中...</div>
      </div>
    );
  }

  return (
    <div className="llm-lab">
      <div className="llm-flow-nav" id="llm-flow-nav" role="tablist" aria-label="LLM 学习流程">
        {flowSteps.map((flowStep) => {
          const isFlowLocked = flowStep.id !== 'data' && !isTrainingCorpusGenerated;
          return (
            <button
              key={flowStep.id}
              type="button"
              className={`llm-flow-tab ${activeFlowStep === flowStep.id ? 'active' : ''} ${isFlowLocked ? 'locked' : ''}`}
              onClick={() => handleFlowStepChange(flowStep.id)}
              role="tab"
              aria-selected={activeFlowStep === flowStep.id}
              aria-disabled={isFlowLocked}
              title={isFlowLocked ? '先完成数据清理、分割，并点击开始训练生成训练语料' : undefined}
            >
              <span className="flow-tab-step">{flowStep.step}</span>
              <span className="flow-tab-copy">
                <strong>{flowStep.title}</strong>
              </span>
            </button>
          );
        })}
      </div>

      {activeFlowStep === 'data' && (
        <div className="llm-flow-page data-page">
          <div className={`flow-page-main ${isDatasetConfirmed ? 'data-work-layout' : 'dataset-selection-layout'}`}>
            {!isDatasetConfirmed && (
            <div className="training-info dataset-selection-card glass-panel" id="llm-training-info">
              <h3>选择数据集</h3>
              <p className="theme-desc">先确定训练主题和待处理原始样本。确认后这里会隐藏，进入数据清洗流水线。</p>

              <div className="theme-selector">
                <button
                  className={`theme-btn ${selectedTheme === 'qa' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('qa');
                    setPipelineCursor(0);
                    setShowTokenizerAfterCleaning(false);
                    setIsDatasetConfirmed(false);
                    setIsTrainingCorpusGenerated(false);
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  问答训练
                </button>
                <button
                  className={`theme-btn ${selectedTheme === 'story' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('story');
                    setPipelineCursor(0);
                    setShowTokenizerAfterCleaning(false);
                    setIsDatasetConfirmed(false);
                    setIsTrainingCorpusGenerated(false);
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  故事生成
                </button>
                <button
                  className={`theme-btn ${selectedTheme === 'technical' ? 'active' : ''}`}
                  onClick={() => {
                    selectTheme('technical');
                    setPipelineCursor(0);
                    setShowTokenizerAfterCleaning(false);
                    setIsDatasetConfirmed(false);
                    setIsTrainingCorpusGenerated(false);
                    if (scenarioEnabled) reportClick('llm-training-info');
                  }}
                >
                  技术文档
                </button>
              </div>

              <p className="theme-desc">{TRAINING_THEMES[selectedTheme]?.description}</p>

              <div className="dirty-sample-selector dataset-choice-list" aria-label="选择待清洗样本">
                {dirtySamples.map((sample, index) => (
                  <button
                    key={index}
                    type="button"
                    className={selectedDirtyIndex === index ? 'active' : ''}
                    onClick={() => {
                      setSelectedDirtyIndex(index);
                      setPipelineCursor(0);
                      setShowTokenizerAfterCleaning(false);
                      setIsTrainingCorpusGenerated(false);
                    }}
                  >
                    <strong>数据集 {index + 1}</strong>
                    <span>{sample.slice(0, 72)}{sample.length > 72 ? '...' : ''}</span>
                  </button>
                ))}
              </div>

              <button type="button" className="btn btn-primary confirm-dataset-button" onClick={handleConfirmDataset}>
                确认数据集，进入数据清洗
              </button>

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
            )}

            {isDatasetConfirmed && (
            <div className="flow-card-stack">
              {!showTokenizerAfterCleaning && (
              <div className="data-cleaning-card glass-panel">
                <div className="panel-header compact">
                  <h3>数据清洗</h3>
                  <span>进入分词前</span>
                </div>
                <div className={`dirty-sample-box ${pipelineCursor > 0 ? 'processed' : ''}`}>
                  <div className="working-text-header">
                    <span className="section-label">当前处理文本</span>
                    <strong>{pipelineCursor === 0 ? '原始采集状态' : `已执行到：${currentPipelineStage?.title}`}</strong>
                  </div>
                  <p>{workingText}</p>
                </div>
                <div className="pipeline-flow" aria-label="训练数据生成流程">
                  {DATA_PIPELINE_STAGES.map((stage, index) => {
                    const result = cleaningResult.stageResults.find(item => item.id === stage.id);
                    const enabled = stage.fixed || cleaningRules[stage.id];
                    const isActive = index === pipelineCursor;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        className={`pipeline-stage ${result?.status || 'pending'} ${enabled ? 'enabled' : 'disabled'} ${isActive ? 'active' : ''}`}
                        onClick={() => setPipelineCursor(index)}
                        title="点击运行到这一步"
                      >
                        <span className="stage-index">{String(index + 1).padStart(2, '0')}</span>
                        <strong>{stage.title}</strong>
                        <small>{result?.detail || (enabled ? '等待执行' : '已关闭')}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="pipeline-controls">
                  <div>
                    <span className="section-label">当前步骤</span>
                    <strong>{currentPipelineStage?.title}</strong>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handlePipelineReset} disabled={pipelineCursor === 0}>
                    重置
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handlePipelineStep} disabled={pipelineCursor >= DATA_PIPELINE_STAGES.length - 1}>
                    执行下一步
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handlePipelineRunAll}>
                    全部运行
                  </button>
                </div>
                <div className="pipeline-progress" aria-label="流水线进度">
                  <span style={{ width: `${pipelineProgress}%` }} />
                  <strong>{pipelineProgress}%</strong>
                </div>
                <div className="stage-diff-panel">
                  <div className="stage-diff-header">
                    <span>{currentStageResult?.detail || '等待执行'}</span>
                    <strong>{currentStageResult?.deltaChars > 0 ? `减少 ${currentStageResult.deltaChars} 字符` : currentStageResult?.deltaChars < 0 ? `增加 ${Math.abs(currentStageResult.deltaChars)} 字符` : '文本未改写'}</strong>
                  </div>
                  <p>上面的“当前处理文本”就是流水线的工作区。执行下一步时，它会被直接替换为该步骤处理后的版本。</p>
                </div>
                <div className="cleaning-metrics" aria-label="清洗统计">
                  <span>启用步骤 <strong>{cleaningResult.enabledRules + 1}</strong></span>
                  <span>质量分 <strong>{cleaningResult.qualityScore || '-'}</strong></span>
                  <span>语言 <strong>{cleaningResult.language}</strong></span>
                  <span>领域 <strong>{cleaningResult.domain}</strong></span>
                  <span>抽检 <strong>{cleaningResult.humanReview}</strong></span>
                  <span>词元 {cleaningResult.originalTokens} {'->'} <strong>{cleaningResult.cleanedTokens}</strong></span>
                </div>
                <div className="cleaning-preview">
                  <span className="section-label">生成训练集样例</span>
                  <p>{cleaningResult.isDatasetReady ? cleanedText : '运行到“生成训练集”后，这里会从当前处理文本产出训练样本。'}</p>
                  <div className="training-set-preview">
                    {cleaningResult.generatedSamples.length > 0 ? cleaningResult.generatedSamples.map((sample, index) => (
                      <code key={index}>{index + 1}. {sample}</code>
                    )) : <span>运行到“生成训练集”后才会产出可送训样本。</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary apply-cleaned-text"
                    onClick={() => handleTransferToTokenizer(cleanedText)}
                    disabled={!cleanedText || !cleaningResult.isDatasetReady}
                  >
                    传输至分割器
                  </button>
                </div>
              </div>
              )}

              {showTokenizerAfterCleaning && (
                <div className="tokenizer-stage-panel">
                  <div className="panel-header compact">
                    <h3>数据分割器</h3>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTokenizerAfterCleaning(false)}>
                      返回数据清洗
                    </button>
                  </div>
                  <div id="llm-tokenization">
                    <TokenizationViz tokens={currentTokens} tokenizerMode={tokenizerMode} sourceText={currentText} />
                  </div>
                  <div className="tokenizer-stage-actions glass-panel">
                    <div>
                      <span className="section-label">训练语料状态</span>
                      <strong>尚未生成。确认分割结果后点击开始训练，才写入训练语料。</strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartTrainingFromDataset(cleaningResult.generatedSamples)}
                      disabled={cleaningResult.generatedSamples.length === 0}
                    >
                      开始训练并生成训练语料
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

        </div>
      )}

      {activeFlowStep === 'training' && (
        <div className="llm-flow-page training-page">
          <div className="flow-page-main training-grid">
            <div id="llm-control-panel">
              <LLMControlPanel
                onTrainStep={handleTrainStep}
                onTrainBatch={handleTrainBatch}
                onToggleTraining={handleToggleTraining}
                onReset={handleReset}
                isTraining={isTraining}
                trainingSpeed={trainingSpeed}
                setTrainingSpeed={setTrainingSpeed}
                learningRate={learningRate}
                setLearningRate={handleLearningRateChange}
                temperature={temperature}
                setTemperature={handleTemperatureChange}
                trainingStep={trainingStep}
                lossHistory={lossHistory}
                mode={mode}
                onModeChange={handleModeChange}
                tokenizerMode={tokenizerMode}
                onTokenizerModeChange={handleTokenizerModeChange}
                tokenizerOptions={TOKENIZER_OPTIONS}
              />
            </div>

            <div className="flow-card-stack">
              <div id="llm-loss-chart">
                <LLMLossChart lossHistory={lossHistory} width={520} height={220} />
              </div>
              <div id="llm-flow-viz">
                <LLMFlowViz
                  tokens={currentTokens}
                  isTraining={isTraining}
                  trainingStep={trainingStep}
                  currentLoss={lossHistory.length > 0 ? lossHistory[lossHistory.length - 1] : null}
                />
              </div>
              <div className="training-stage-summary glass-panel">
                <h3>训练阶段关注什么？</h3>
                <p>训练时模型会不断预测下一个 Token，并用预测误差更新参数。Loss 越低，表示当前语料模式被模型掌握得越稳定。</p>
                <div className="summary-metrics">
                  <span>训练步数 <strong>{trainingStep}</strong></span>
                  <span>当前 Loss <strong>{lossHistory.length > 0 ? lossHistory[lossHistory.length - 1].toFixed(4) : '-'}</strong></span>
                  <span>学习率 <strong>{learningRate.toFixed(2)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="flow-page-actions split">
            <button className="btn btn-secondary" type="button" onClick={() => handleFlowStepChange('data')}>
              返回数据处理
            </button>
            <button className="btn btn-primary" type="button" onClick={() => handleFlowStepChange('inference')}>
              下一步：推理调优
            </button>
          </div>
        </div>
      )}

      {activeFlowStep === 'inference' && (
        <div className="llm-flow-page inference-page">
          <div className="flow-page-main inference-grid">
            <div className="flow-card-stack">
              <div id="llm-generation-panel">
                <LLMGenerationPanel
                  prompt={prompt}
                  onPromptChange={handlePromptChange}
                  onGenerate={handleGenerate}
                  onGenerateStep={handleGenerateStep}
                  onClearGeneration={handleClearGeneration}
                  generatedTokens={generatedTokens}
                  generationProbs={generationProbs}
                />
              </div>

              <div id="llm-tokenization">
                <TokenizationViz tokens={promptTokens} tokenizerMode={tokenizerMode} sourceText={currentText} />
              </div>
            </div>

            <div className="flow-card-stack">
              <div id="llm-control-panel">
                <LLMControlPanel
                  onTrainStep={handleTrainStep}
                  onTrainBatch={handleTrainBatch}
                  onToggleTraining={handleToggleTraining}
                  onReset={handleReset}
                  isTraining={isTraining}
                  trainingSpeed={trainingSpeed}
                  setTrainingSpeed={setTrainingSpeed}
                  learningRate={learningRate}
                  setLearningRate={handleLearningRateChange}
                  temperature={temperature}
                  setTemperature={handleTemperatureChange}
                  trainingStep={trainingStep}
                  lossHistory={lossHistory}
                  mode={mode}
                  onModeChange={handleModeChange}
                  tokenizerMode={tokenizerMode}
                  onTokenizerModeChange={handleTokenizerModeChange}
                  tokenizerOptions={TOKENIZER_OPTIONS}
                />
              </div>

              <div id="llm-token-embed">
                <TokenEmbedViz tokens={promptTokens} embeddings={embeddings} />
              </div>
              <div id="llm-attention-viz">
                <AttentionViz
                  tokens={promptTokens}
                  attentionWeights={attentionWeights}
                  numHeads={config.numHeads}
                />
              </div>
            </div>
          </div>

          <div className="flow-page-actions">
            <button className="btn btn-secondary" type="button" onClick={() => handleFlowStepChange('training')}>
              返回模型训练
            </button>
          </div>
        </div>
      )}

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

      {!scenarioEnabled && (
        <LearningCompanion
          pointsCount={promptTokens.length}
          lossHistoryLength={lossHistory.length}
          currentLoss={lossHistory.length > 0 ? lossHistory[lossHistory.length - 1] : null}
          isTraining={isTraining}
          mode={mode}
          labType="LLM"
        />
      )}
    </div>
  );
}
