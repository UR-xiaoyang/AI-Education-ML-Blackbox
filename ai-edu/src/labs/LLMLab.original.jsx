import React, { useMemo, useState } from 'react';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { llmScenarios } from '../store/scenarioConfig';
import { SpotlightOverlay } from '../components/SpotlightOverlay';
import { PedagogySidebar } from '../components/PedagogySidebar';

const BASE_TOKENIZER_VOCAB = [
  '<BOS>',
  '<EOS>',
  '机器学习',
  '神经网络',
  '大模型',
  '预训练',
  '微调',
  '为什么',
  '如何',
  '回答',
  '问题',
  '模型',
  '学习',
  '语言',
  '帮助',
  '高效',
  '复杂',
  '模式',
  '能够',
  '理解',
  '上下文',
  '分词',
  '因为',
  'AI',
  '先',
  '更',
  '让',
  '切成',
  '拟合',
  '擅长'
];

const PRETRAIN_CORPUS = [
  { id: 'p1', title: '科技新闻', text: 'AI 让 学习 更 高效' },
  { id: 'p2', title: '课堂总结', text: '神经网络 擅长 拟合 复杂 模式' },
  { id: 'p3', title: '模型介绍', text: '大模型 能够 理解 上下文' },
  { id: 'p4', title: '教程语料', text: '预训练 帮助 模型 学习 语言' }
];

const SFT_CORPUS = [
  { id: 's1', title: '问答样本 1', text: '问题 为什么 要 预训练 回答 因为' },
  { id: 's2', title: '问答样本 2', text: '问题 为什么 要 分词 回答 因为' },
  { id: 's3', title: '问答样本 3', text: '问题 模型 如何 预测 回答 先' }
];

const PROMPT_PRESETS = [
  { id: 'pre-1', label: 'AI 让 学习', text: 'AI 让 学习', answer: '更' },
  { id: 'pre-2', label: '大模型 能够', text: '大模型 能够', answer: '理解' },
  { id: 'sft-1', label: '问题 为什么 要 预训练 回答', text: '问题 为什么 要 预训练 回答', answer: '因为' },
  { id: 'sft-2', label: '问题 模型 如何 预测 回答', text: '问题 模型 如何 预测 回答', answer: '先' }
];

const LAB_STEPS = [
  {
    id: 'step-1',
    title: '1. 收集语料',
    goal: '至少把 2 条预训练语料加入训练集。',
    hint: '先别急着训练，模型必须先看到文本。'
  },
  {
    id: 'step-2',
    title: '2. 做预训练',
    goal: '点击训练，让“正确下一个词”的概率超过 55%。',
    hint: '你会看到概率柱逐渐向正确答案倾斜。'
  },
  {
    id: 'step-3',
    title: '3. 加入指令样本',
    goal: '至少加入 1 条 SFT 样本，并做 2 轮微调。',
    hint: '这一步会把“纯续写”变成“按问题回答”。'
  },
  {
    id: 'step-4',
    title: '4. 做推理',
    goal: '调整温度并尝试生成，观察输出如何变化。',
    hint: '温度越高，随机性通常越强。'
  }
];

function TokenChip({ token, active = false, accent = '#3b82f6' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '999px',
        background: active ? `${accent}22` : 'rgba(15, 23, 42, 0.62)',
        border: `1px solid ${active ? `${accent}66` : 'rgba(148, 163, 184, 0.16)'}`,
        color: '#f8fafc',
        fontSize: '0.9rem'
      }}
    >
      {token}
    </span>
  );
}

function normalizeWeights(rawScores, temperature) {
  const safeTemperature = Math.max(0.2, temperature);
  const weighted = rawScores.map(([token, score]) => [token, Math.pow(Math.max(score, 0.01), 1 / safeTemperature)]);
  const total = weighted.reduce((sum, [, score]) => sum + score, 0) || 1;
  return weighted.map(([token, score]) => [token, Math.round((score / total) * 1000) / 10]);
}

function sampleToken(distribution) {
  const threshold = Math.random() * 100;
  let cumulative = 0;
  for (const [token, percent] of distribution) {
    cumulative += percent;
    if (threshold <= cumulative) return token;
  }
  return distribution[0]?.[0] || '';
}

function tokenizeText(text, lexicon) {
  const sortedLexicon = [...new Set(lexicon)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const source = (text || '').trim();
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const currentChar = source[index];

    if (/\s/.test(currentChar)) {
      index += 1;
      continue;
    }

    const asciiMatch = source.slice(index).match(/^[A-Za-z0-9_-]+/);
    if (asciiMatch) {
      tokens.push(asciiMatch[0]);
      index += asciiMatch[0].length;
      continue;
    }

    const matched = sortedLexicon.find((token) => token !== '<BOS>' && token !== '<EOS>' && source.startsWith(token, index));
    if (matched) {
      tokens.push(matched);
      index += matched.length;
      continue;
    }

    tokens.push(currentChar);
    index += 1;
  }

  return tokens;
}

function buildCounts(corpusItems, repeat) {
  const transitions = new Map();
  const unigram = new Map();

  corpusItems.forEach((item) => {
    for (let round = 0; round < repeat; round += 1) {
      const sequence = ['<BOS>', ...item.tokens, '<EOS>'];
      sequence.forEach((token, index) => {
        unigram.set(token, (unigram.get(token) || 0) + 1);
        if (index === sequence.length - 1) return;
        const current = sequence[index];
        const next = sequence[index + 1];
        if (!transitions.has(current)) transitions.set(current, new Map());
        const bucket = transitions.get(current);
        bucket.set(next, (bucket.get(next) || 0) + 1);
      });
    }
  });

  return { transitions, unigram };
}

function buildTrainingPairs(corpusItems) {
  const pairs = [];

  corpusItems.forEach((item) => {
    const sequence = ['<BOS>', ...item.tokens, '<EOS>'];

    for (let index = 0; index < sequence.length - 1; index += 1) {
      pairs.push({
        pairId: `${item.id}-${index}`,
        title: item.title,
        sequence,
        inputToken: sequence[index],
        targetToken: sequence[index + 1],
        contextTokens: sequence.slice(0, index + 1),
        focusIndex: index
      });
    }
  });

  return pairs;
}

function buildTokenFeatureMatrix(tokens, pretrainEpochs, featureCount = 6) {
  return tokens.map((token, rowIndex) => (
    Array.from({ length: featureCount }, (_, columnIndex) => {
      const seed = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const wave = Math.abs(Math.sin((seed + rowIndex * 17 + columnIndex * 13 + pretrainEpochs * 7) / 18));
      return Math.round((0.18 + wave * 0.82) * 100) / 100;
    })
  ));
}

function buildAttentionMatrix(tokens, pretrainEpochs) {
  return tokens.map((_, rowIndex) => {
    const raw = tokens.map((__, columnIndex) => {
      const distanceBias = 1 / (1 + Math.abs(rowIndex - columnIndex));
      const recencyBias = columnIndex === tokens.length - 1 ? 0.45 : 0;
      const epochBias = ((pretrainEpochs + rowIndex + columnIndex) % 3) * 0.04;
      return distanceBias + recencyBias + epochBias;
    });
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    return raw.map((value) => Math.round((value / total) * 100) / 100);
  });
}

function buildProjectionMatrix(distribution, featureCount = 6) {
  return Array.from({ length: featureCount }, (_, rowIndex) => (
    distribution.map(([token, percent], columnIndex) => {
      const seed = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const wave = Math.abs(Math.cos((seed + rowIndex * 11 + columnIndex * 19) / 21));
      const strength = 0.18 + (percent / 100) * 0.6 + wave * 0.22;
      return Math.round(Math.min(strength, 1) * 100) / 100;
    })
  ));
}

function buildFitSeries(totalEpochs, pairIndex, pairCycleLength, pairHitCount, currentProbability) {
  if (totalEpochs <= 0 || pairCycleLength <= 0) return [];

  const startEpoch = Math.max(1, totalEpochs - 7);
  return Array.from({ length: totalEpochs - startEpoch + 1 }, (_, offset) => {
    const epoch = startEpoch + offset;
    const hits = epoch - 1 < pairIndex ? 0 : Math.floor((epoch - 1 - pairIndex) / pairCycleLength) + 1;
    const clampedHits = Math.max(0, Math.min(hits, pairHitCount));
    const base = 6;
    const estimated = clampedHits === 0
      ? base
      : base + ((currentProbability - base) * clampedHits) / Math.max(pairHitCount, 1);
    return {
      epoch,
      probability: Math.round(Math.max(base, estimated) * 10) / 10
    };
  });
}

export default function LLMLab({ scenarioEnabled = false }) {
  const [selectedPretrain, setSelectedPretrain] = useState([]);
  const [selectedSft, setSelectedSft] = useState([]);
  const [customPretrainTitle, setCustomPretrainTitle] = useState('学生语料');
  const [customPretrainText, setCustomPretrainText] = useState('');
  const [customPretrainCorpus, setCustomPretrainCorpus] = useState([]);
  const [customSftTitle, setCustomSftTitle] = useState('学生问答');
  const [customSftText, setCustomSftText] = useState('');
  const [customSftCorpus, setCustomSftCorpus] = useState([]);
  const [customLexiconInput, setCustomLexiconInput] = useState('大语言模型,逐词生成,指令微调');
  const [pretrainEpochs, setPretrainEpochs] = useState(0);
  const [sftEpochs, setSftEpochs] = useState(0);
  const [selectedPromptId, setSelectedPromptId] = useState('pre-1');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('问题 为什么 要 预训练 回答');
  const [temperature, setTemperature] = useState(0.8);
  const [generatedTokens, setGeneratedTokens] = useState([]);

  const tokenizerLexicon = useMemo(() => {
    const customTokens = customLexiconInput
      .split(/[\n,，、\s]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    return [...new Set([...BASE_TOKENIZER_VOCAB, ...customTokens])];
  }, [customLexiconInput]);

  const allPretrainCorpus = useMemo(
    () => [...PRETRAIN_CORPUS, ...customPretrainCorpus].map((item) => ({ ...item, tokens: tokenizeText(item.text, tokenizerLexicon) })),
    [customPretrainCorpus, tokenizerLexicon]
  );

  const allSftCorpus = useMemo(
    () => [...SFT_CORPUS, ...customSftCorpus].map((item) => ({ ...item, tokens: tokenizeText(item.text, tokenizerLexicon) })),
    [customSftCorpus, tokenizerLexicon]
  );

  const promptPresets = useMemo(
    () => PROMPT_PRESETS.map((item) => ({ ...item, tokens: tokenizeText(item.text, tokenizerLexicon) })),
    [tokenizerLexicon]
  );

  const selectedPretrainCorpus = allPretrainCorpus.filter((item) => selectedPretrain.includes(item.id));
  const selectedSftCorpus = allSftCorpus.filter((item) => selectedSft.includes(item.id));
  const selectedPresetPrompt = promptPresets.find((item) => item.id === selectedPromptId) || promptPresets[0];
  const customPromptTokens = useMemo(() => tokenizeText(customPromptText, tokenizerLexicon), [customPromptText, tokenizerLexicon]);
  const currentPrompt = useCustomPrompt && customPromptTokens.length > 0
    ? { id: 'custom', label: '自定义 Prompt', text: customPromptText, tokens: customPromptTokens, answer: null }
    : selectedPresetPrompt;

  const pretrainCounts = useMemo(
    () => buildCounts(selectedPretrainCorpus, pretrainEpochs),
    [selectedPretrainCorpus, pretrainEpochs]
  );

  const sftCounts = useMemo(
    () => buildCounts(selectedSftCorpus, sftEpochs),
    [selectedSftCorpus, sftEpochs]
  );

  const vocabulary = useMemo(() => {
    const tokens = new Set();
    [...allPretrainCorpus, ...allSftCorpus].forEach((item) => item.tokens.forEach((token) => tokens.add(token)));
    currentPrompt.tokens.forEach((token) => tokens.add(token));
    tokens.add('<EOS>');
    return [...tokens];
  }, [allPretrainCorpus, allSftCorpus, currentPrompt.tokens]);

  const currentDistribution = useMemo(() => {
    const lastToken = [...currentPrompt.tokens, ...generatedTokens].slice(-1)[0] || '<BOS>';
    const pretrainBucket = pretrainCounts.transitions.get(lastToken);
    const sftBucket = sftCounts.transitions.get(lastToken);
    const merged = new Map();

    vocabulary.forEach((token) => merged.set(token, 0.03));
    if (pretrainBucket) pretrainBucket.forEach((count, token) => merged.set(token, (merged.get(token) || 0) + count));
    if (sftBucket) sftBucket.forEach((count, token) => merged.set(token, (merged.get(token) || 0) + count * 1.6));

    const raw = [...merged.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([token]) => token !== '<BOS>')
      .slice(0, 6);

    return normalizeWeights(raw, temperature);
  }, [currentPrompt.tokens, generatedTokens, pretrainCounts.transitions, sftCounts.transitions, temperature, vocabulary]);

  const expectedTokenRank = currentPrompt.answer
    ? currentDistribution.findIndex(([token]) => token === currentPrompt.answer)
    : -1;
  const expectedProbability = currentPrompt.answer
    ? currentDistribution.find(([token]) => token === currentPrompt.answer)?.[1] || 0
    : 0;
  const selectedCorpusTokenCount = [...selectedPretrainCorpus, ...selectedSftCorpus]
    .reduce((sum, item) => sum + item.tokens.length, 0);
  const previewTokenSource = customPretrainText || currentPrompt.text;
  const previewTokens = tokenizeText(previewTokenSource, tokenizerLexicon);
  const pretrainPairs = useMemo(() => buildTrainingPairs(selectedPretrainCorpus), [selectedPretrainCorpus]);
  const activePretrainPair = pretrainPairs.length > 0
    ? pretrainPairs[Math.max(0, pretrainEpochs - 1) % pretrainPairs.length]
    : null;
  const activePairBucket = activePretrainPair
    ? pretrainCounts.transitions.get(activePretrainPair.inputToken)
    : null;
  const activePairRawDistribution = useMemo(() => {
    if (!activePretrainPair) return [];

    const rawMap = new Map();
    vocabulary.forEach((token) => rawMap.set(token, 0.03));
    if (activePairBucket) {
      activePairBucket.forEach((count, token) => rawMap.set(token, (rawMap.get(token) || 0) + count));
    }

    return [...rawMap.entries()]
      .filter(([token]) => token !== '<BOS>')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [activePairBucket, activePretrainPair, vocabulary]);
  const activePairDistribution = useMemo(
    () => normalizeWeights(activePairRawDistribution, 1),
    [activePairRawDistribution]
  );
  const activePairTargetProbability = activePretrainPair
    ? activePairDistribution.find(([token]) => token === activePretrainPair.targetToken)?.[1] || 0
    : 0;
  const activePairLoss = activePairTargetProbability > 0
    ? -Math.log(Math.max(activePairTargetProbability / 100, 0.001))
    : 0;
  const activePairTargetCount = activePretrainPair && activePairBucket
    ? activePairBucket.get(activePretrainPair.targetToken) || 0
    : 0;
  const activePairTopThree = activePairDistribution.slice(0, 3);
  const activePairConnectionBefore = Math.min(26 + activePairTargetCount * 14, 84);
  const activePairConnectionAfter = Math.min(26 + (activePretrainPair ? activePairTargetCount + 1 : 0) * 14, 96);
  const activeContextTokens = activePretrainPair ? activePretrainPair.contextTokens.slice(-4) : [];
  const tokenFeatureMatrix = useMemo(
    () => buildTokenFeatureMatrix(activeContextTokens, pretrainEpochs),
    [activeContextTokens, pretrainEpochs]
  );
  const attentionMatrix = useMemo(
    () => buildAttentionMatrix(activeContextTokens, pretrainEpochs),
    [activeContextTokens, pretrainEpochs]
  );
  const projectionMatrix = useMemo(
    () => buildProjectionMatrix(activePairTopThree),
    [activePairTopThree]
  );
  const activePairIndex = activePretrainPair
    ? pretrainPairs.findIndex((item) => item.pairId === activePretrainPair.pairId)
    : -1;
  const fitSeries = useMemo(
    () => buildFitSeries(pretrainEpochs, activePairIndex, pretrainPairs.length, activePairTargetCount, activePairTargetProbability),
    [pretrainEpochs, activePairIndex, pretrainPairs.length, activePairTargetCount, activePairTargetProbability]
  );

  const completedSteps = {
    'step-1': selectedPretrain.length >= 2,
    'step-2': expectedProbability >= 55,
    'step-3': selectedSft.length >= 1 && sftEpochs >= 2,
    'step-4': generatedTokens.length >= 1
  };

  const activeStep = useMemo(() => {
    if (!completedSteps['step-1']) return 'step-1';
    if (!completedSteps['step-2']) return 'step-2';
    if (!completedSteps['step-3']) return 'step-3';
    return 'step-4';
  }, [completedSteps]);

  const isCorpusStage = activeStep === 'step-1';
  const isPretrainStage = activeStep === 'step-2';
  const isSftStage = activeStep === 'step-3';
  const isGenerateStage = activeStep === 'step-4';

  const {
    currentExperiment,
    currentStep,
    currentStepIndex,
    reportClick,
    reportValueChange,
    nextStep
  } = useScenarioEngine(
    llmScenarios,
    scenarioEnabled,
    false,
    (stepId) => {
      if (stepId === 'llm_step_1_pick_corpus' && selectedPretrain.length < 2) {
        return '请至少选择 2 条预训练语料，或先加入你自己的语料。';
      }
      if (stepId === 'llm_step_4_observe_distribution' && pretrainEpochs < 2) {
        return '请先至少完成 2 轮预训练，再观察概率分布变化。';
      }
      if (stepId === 'llm_step_5_add_sft' && selectedSft.length < 1) {
        return '请至少选择 1 条指令微调语料。';
      }
      if (stepId === 'llm_step_7_prompt' && currentPrompt.tokens.length < 1) {
        return '请先输入或选择一个 prompt。';
      }
      return null;
    },
    'LLM'
  );

  const togglePretrainSample = (sampleId) => {
    setSelectedPretrain((prev) => (
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    ));
    setGeneratedTokens([]);
  };

  const toggleSftSample = (sampleId) => {
    setSelectedSft((prev) => (
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    ));
    setGeneratedTokens([]);
  };

  const addCustomPretrainCorpus = () => {
    const trimmed = customPretrainText.trim();
    if (!trimmed) return;
    const newId = `cp-${Date.now()}`;
    const item = {
      id: newId,
      title: customPretrainTitle.trim() || '学生语料',
      text: trimmed
    };
    setCustomPretrainCorpus((prev) => [...prev, item]);
    setSelectedPretrain((prev) => [...prev, newId]);
    setCustomPretrainText('');
    setGeneratedTokens([]);
  };

  const addCustomSftCorpus = () => {
    const trimmed = customSftText.trim();
    if (!trimmed) return;
    const newId = `cs-${Date.now()}`;
    const item = {
      id: newId,
      title: customSftTitle.trim() || '学生问答',
      text: trimmed
    };
    setCustomSftCorpus((prev) => [...prev, item]);
    setSelectedSft((prev) => [...prev, newId]);
    setCustomSftText('');
    setGeneratedTokens([]);
  };

  const handleTrainOnce = () => {
    if (selectedPretrain.length === 0) return;
    setPretrainEpochs((value) => value + 1);
  };

  const handleSftOnce = () => {
    if (selectedSft.length === 0) return;
    setSftEpochs((value) => value + 1);
  };

  const handleGenerateNext = () => {
    const nextToken = sampleToken(currentDistribution);
    if (!nextToken) return;
    setGeneratedTokens((prev) => [...prev, nextToken]);
  };

  const handleReset = () => {
    setSelectedPretrain([]);
    setSelectedSft([]);
    setCustomPretrainCorpus([]);
    setCustomSftCorpus([]);
    setCustomPretrainText('');
    setCustomSftText('');
    setCustomLexiconInput('大语言模型,逐词生成,指令微调');
    setPretrainEpochs(0);
    setSftEpochs(0);
    setSelectedPromptId('pre-1');
    setUseCustomPrompt(false);
    setCustomPromptText('问题 为什么 要 预训练 回答');
    setTemperature(0.8);
    setGeneratedTokens([]);
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
          0% { box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 0 0 rgba(56, 189, 248, 0); }
          50% { box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.8), 0 0 24px rgba(56, 189, 248, 0.25); }
          100% { box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 0 0 rgba(56, 189, 248, 0); }
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
                border: `1px solid ${(completedSteps[step.id] ? '#22c55e' : activeStep === step.id ? '#38bdf8' : '#64748b')}66`,
                boxShadow: activeStep === step.id ? `0 0 0 1px ${(completedSteps[step.id] ? '#22c55e' : '#38bdf8')} inset, 0 0 22px ${(completedSteps[step.id] ? '#22c55e' : '#38bdf8')}22` : 'none',
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
                  background: completedSteps[step.id] ? '#22c55e' : activeStep === step.id ? '#38bdf8' : '#64748b',
                  flexShrink: 0
                }}
              />
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>{step.title}</span>
            </div>
          ))}
        </div>
      </section>

      {!isCorpusStage && (
        <section className="glass-panel" style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.72)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {[
              { title: '已选预训练语料', value: `${selectedPretrain.length} 条`, accent: '#38bdf8', chips: selectedPretrainCorpus.slice(0, 4).map((item) => ({ key: item.id, label: item.title, accent: '#3b82f6' })) },
              { title: '语料 token 总量', value: selectedCorpusTokenCount, accent: '#14b8a6' },
              { title: '当前 prompt', value: currentPrompt.label, accent: '#7dd3fc' },
              { title: '已选微调样本', value: `${selectedSft.length} 条`, accent: '#a78bfa', chips: selectedSftCorpus.slice(0, 3).map((item) => ({ key: item.id, label: item.title, accent: '#a78bfa' })) }
            ].map((item) => (
              <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.9)' }}>{item.title}</div>
                <div style={{ marginTop: '8px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                {item.chips?.length ? (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item.chips.map((chip) => <TokenChip key={chip.key} token={chip.label} accent={chip.accent} />)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {isCorpusStage && (
        <section className="glass-panel" style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.78)' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button className="btn" type="button" onClick={handleReset}>
              重置实验
            </button>
          </div>

          <h3 style={{ margin: 0, color: '#f8fafc' }}>第 1 步：收集语料并确认分词</h3>
          <p style={{ margin: '6px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.6, fontSize: '0.9rem' }}>
            先从零开始准备语料。只有当你至少选中 2 条预训练语料后，页面才会自动翻到训练阶段。
          </p>

          <div id="llm-corpus-panel" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ color: '#7dd3fc', fontSize: '0.8rem' }}>预训练语料</div>
              {allPretrainCorpus.map((item) => {
                const active = selectedPretrain.includes(item.id);
                return (
                  <div key={item.id} style={{ display: 'grid', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => { togglePretrainSample(item.id); reportClick('llm-corpus-panel'); }}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        background: active ? 'rgba(56, 189, 248, 0.14)' : 'rgba(15, 23, 42, 0.48)',
                        borderColor: active ? 'rgba(56, 189, 248, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700 }}>{item.title}</div>
                      <div style={{ marginTop: '6px', color: 'rgba(226, 232, 240, 0.7)', lineHeight: 1.6 }}>
                        {item.text}
                      </div>
                    </button>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.tokens.map((token) => <TokenChip key={`${item.id}-${token}`} token={token} />)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(2, 6, 23, 0.36)' }}>
                <div style={{ color: '#7dd3fc', fontSize: '0.8rem' }}>学生输入预训练语料</div>
                <input
                  value={customPretrainTitle}
                  onChange={(e) => setCustomPretrainTitle(e.target.value)}
                  placeholder="语料标题"
                  style={{ width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc' }}
                />
                <textarea
                  value={customPretrainText}
                  onChange={(e) => setCustomPretrainText(e.target.value)}
                  placeholder="输入一句或多句原始文本，例如：大语言模型 通过 预训练 学习 语言 规律"
                  rows={3}
                  style={{ width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc', resize: 'vertical' }}
                />
                <button className="btn" type="button" onClick={() => { addCustomPretrainCorpus(); reportClick('llm-corpus-panel'); }} style={{ marginTop: '10px' }}>
                  加入预训练语料
                </button>
              </div>

              <div id="llm-lexicon-panel" onClick={() => reportClick('llm-lexicon-panel')} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(2, 6, 23, 0.36)' }}>
                <div style={{ color: '#f8fafc' }}>分词词库</div>
                <textarea
                  value={customLexiconInput}
                  onChange={(e) => setCustomLexiconInput(e.target.value)}
                  rows={2}
                  style={{ width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc', resize: 'vertical' }}
                />
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {tokenizerLexicon.slice(0, 18).map((token) => <TokenChip key={`lex-${token}`} token={token} accent="#14b8a6" />)}
                </div>
              </div>

              <div id="llm-token-preview" onClick={() => reportClick('llm-token-preview')} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(2, 6, 23, 0.36)' }}>
                <div style={{ color: '#f8fafc', marginBottom: '8px' }}>分词预览</div>
                <div style={{ color: 'rgba(226, 232, 240, 0.68)', lineHeight: 1.7 }}>
                  当前预览文本：{previewTokenSource || '请先输入语料'}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {previewTokens.map((token, index) => <TokenChip key={`${token}-${index}`} token={token} active={index === previewTokens.length - 1} accent="#14b8a6" />)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {isPretrainStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>第 2 步：做预训练</h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                这里不只看结果，而是拆开一次训练内部到底做了什么。这个迷你实验把预训练简化成“看到当前 token，预测下一个 token”。
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button id="llm-btn-pretrain" className="btn btn-primary" type="button" onClick={() => { handleTrainOnce(); reportClick('llm-btn-pretrain'); }}>
                预训练 1 轮
              </button>
              <button className="btn" type="button" onClick={handleReset}>
                重置实验
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { title: '已选语料', value: selectedPretrain.length, accent: '#38bdf8' },
                { title: '预训练轮数', value: pretrainEpochs, accent: '#60a5fa' },
                { title: '正确词排名', value: expectedTokenRank === -1 ? '未上榜' : `第 ${expectedTokenRank + 1} 名`, accent: '#86efac' }
              ].map((item) => (
                <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                  <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.9)' }}>{item.title}</div>
                  <div style={{ marginTop: '8px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div id="llm-token-preview" onClick={() => reportClick('llm-token-preview')} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ color: '#f8fafc', marginBottom: '8px' }}>本轮训练样本是怎么构造的</div>
              {activePretrainPair ? (
                <>
                  <div style={{ color: '#7dd3fc', fontSize: '0.82rem' }}>来源语料：{activePretrainPair.title}</div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {activePretrainPair.sequence.map((token, index) => (
                      <TokenChip
                        key={`${token}-${index}`}
                        token={token}
                        active={index === activePretrainPair.focusIndex || index === activePretrainPair.focusIndex + 1}
                        accent={index === activePretrainPair.focusIndex + 1 ? '#22c55e' : '#14b8a6'}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { title: '模型输入', value: activePretrainPair.inputToken, accent: '#38bdf8' },
                      { title: '真实下一个 token', value: activePretrainPair.targetToken, accent: '#22c55e' }
                    ].map((item) => (
                      <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                        <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.9)' }}>{item.title}</div>
                        <div style={{ marginTop: '8px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                  先至少选择 2 条预训练语料，系统才会生成训练样本。
                </div>
              )}
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ color: '#f8fafc', marginBottom: '10px' }}>一次预训练的内部流动</div>
              {activePretrainPair ? (
                <svg viewBox="0 0 760 300" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <defs>
                    <linearGradient id="llmFlowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                    <linearGradient id="llmScoreBar" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#7dd3fc" />
                    </linearGradient>
                    <linearGradient id="llmTargetBar" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#86efac" />
                    </linearGradient>
                    <filter id="llmGlow">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <text x="24" y="28" fill="#7dd3fc" fontSize="13">训练样本窗口</text>
                  {activePretrainPair.contextTokens.slice(-4).map((token, index) => (
                    <g key={`ctx-${token}-${index}`} transform={`translate(${24 + index * 78}, 44)`}>
                      <rect width="68" height="32" rx="16" fill={index === activePretrainPair.contextTokens.slice(-4).length - 1 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.86)'} stroke={index === activePretrainPair.contextTokens.slice(-4).length - 1 ? 'rgba(56, 189, 248, 0.46)' : 'rgba(148, 163, 184, 0.16)'} />
                      <text x="34" y="21" textAnchor="middle" fill="#f8fafc" fontSize="13">{token}</text>
                    </g>
                  ))}

                  <text x="170" y="122" fill="#7dd3fc" fontSize="13">当前输入</text>
                  <rect x="160" y="134" width="92" height="42" rx="18" fill="rgba(56, 189, 248, 0.18)" stroke="rgba(56, 189, 248, 0.45)" />
                  <text x="206" y="160" textAnchor="middle" fill="#f8fafc" fontSize="16" fontWeight="700">{activePretrainPair.inputToken}</text>

                  <line x1="252" y1="155" x2="330" y2="155" stroke="url(#llmFlowLine)" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
                  <circle cx="272" cy="155" r="5" fill="#7dd3fc" filter="url(#llmGlow)">
                    <animate attributeName="cx" values="252;330" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" repeatCount="indefinite" />
                  </circle>

                  <text x="300" y="102" fill="#7dd3fc" fontSize="13">黑盒内部表示</text>
                  <circle cx="372" cy="155" r="44" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(125, 211, 252, 0.34)" strokeWidth="2" />
                  <circle cx="372" cy="155" r="30" fill="none" stroke="rgba(56, 189, 248, 0.32)" strokeWidth="6" strokeDasharray="8 10">
                    <animateTransform attributeName="transform" type="rotate" from="0 372 155" to="360 372 155" dur="10s" repeatCount="indefinite" />
                  </circle>
                  <text x="372" y="150" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700">上下文</text>
                  <text x="372" y="168" textAnchor="middle" fill="rgba(226, 232, 240, 0.68)" fontSize="11">隐藏状态</text>

                  <line x1="416" y1="155" x2="492" y2="155" stroke="url(#llmFlowLine)" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
                  <circle cx="436" cy="155" r="5" fill="#86efac" filter="url(#llmGlow)">
                    <animate attributeName="cx" values="416;492" dur="1.8s" begin="0.35s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin="0.35s" repeatCount="indefinite" />
                  </circle>

                  <rect x="492" y="122" width="96" height="66" rx="18" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(125, 211, 252, 0.3)" />
                  <text x="540" y="148" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700">logits</text>
                  <text x="540" y="166" textAnchor="middle" fill="rgba(226, 232, 240, 0.68)" fontSize="11">softmax</text>

                  <text x="610" y="28" fill="#7dd3fc" fontSize="13">候选下一个 token</text>
                  {activePairTopThree.map(([token, percent], index) => {
                    const y = 68 + index * 52;
                    const isTarget = token === activePretrainPair.targetToken;
                    return (
                      <g key={`dist-${token}`} transform={`translate(606, ${y})`}>
                        <text x="0" y="14" fill={isTarget ? '#86efac' : '#e2e8f0'} fontSize="12">{token}</text>
                        <text x="114" y="14" textAnchor="end" fill={isTarget ? '#86efac' : '#cbd5e1'} fontSize="12">{percent.toFixed(1)}%</text>
                        <rect x="0" y="22" width="116" height="10" rx="999" fill="rgba(148, 163, 184, 0.14)" />
                        <rect x="0" y="22" width={Math.max(6, percent)} height="10" rx="999" fill={isTarget ? 'url(#llmTargetBar)' : 'url(#llmScoreBar)'}>
                          <animate attributeName="width" values={`6;${Math.max(6, percent)}`} dur="1.2s" repeatCount="1" />
                        </rect>
                        {isTarget ? (
                          <circle cx="122" cy="27" r="6" fill="none" stroke="#86efac" strokeWidth="2">
                            <animate attributeName="r" values="6;12;6" dur="1.8s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.8s" repeatCount="indefinite" />
                          </circle>
                        ) : null}
                      </g>
                    );
                  })}

                  <line x1="588" y1="228" x2="650" y2="228" stroke="rgba(244, 114, 182, 0.45)" strokeWidth="3" strokeDasharray="6 6" />
                  <circle cx="604" cy="228" r="5" fill="#f472b6">
                    <animate attributeName="cx" values="588;650" dur="1.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;1;0" dur="1.3s" repeatCount="indefinite" />
                  </circle>
                  <rect x="652" y="204" width="80" height="48" rx="16" fill="rgba(244, 114, 182, 0.12)" stroke="rgba(244, 114, 182, 0.3)" />
                  <text x="692" y="223" textAnchor="middle" fill="#f9a8d4" fontSize="12">loss</text>
                  <text x="692" y="241" textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="700">{activePairLoss.toFixed(2)}</text>
                </svg>
              ) : (
                <div style={{ color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                  先至少选择 2 条预训练语料，系统才会生成训练样本。
                </div>
              )}
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ color: '#f8fafc', marginBottom: '10px' }}>矩阵计算如何逐步拟合到数据</div>
              {activePretrainPair ? (
                <svg viewBox="0 0 760 350" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <defs>
                    <linearGradient id="llmFitLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>

                  <text x="24" y="28" fill="#7dd3fc" fontSize="13">Token x 特征矩阵</text>
                  {tokenFeatureMatrix.map((row, rowIndex) => (
                    row.map((value, columnIndex) => (
                      <g key={`feat-${rowIndex}-${columnIndex}`} transform={`translate(${24 + columnIndex * 30}, ${44 + rowIndex * 30})`}>
                        <rect width="24" height="24" rx="5" fill={`rgba(56, 189, 248, ${0.12 + value * 0.56})`} stroke="rgba(125, 211, 252, 0.12)" />
                        {columnIndex === 0 ? (
                          <text x="-6" y="16" textAnchor="end" fill="#e2e8f0" fontSize="11">{activeContextTokens[rowIndex]}</text>
                        ) : null}
                      </g>
                    ))
                  ))}
                  <text x="24" y="186" fill="rgba(226, 232, 240, 0.7)" fontSize="11">每一行是一个 token 的向量表示，深色说明该维度被激活得更强。</text>

                  <text x="272" y="28" fill="#7dd3fc" fontSize="13">注意力权重矩阵</text>
                  {attentionMatrix.map((row, rowIndex) => (
                    row.map((value, columnIndex) => (
                      <g key={`attn-${rowIndex}-${columnIndex}`} transform={`translate(${272 + columnIndex * 34}, ${44 + rowIndex * 34})`}>
                        <rect width="28" height="28" rx="6" fill={`rgba(34, 197, 94, ${0.1 + value * 0.8})`} stroke={columnIndex === row.length - 1 ? 'rgba(134, 239, 172, 0.45)' : 'rgba(148, 163, 184, 0.12)'} />
                        <text x="14" y="18" textAnchor="middle" fill="#f8fafc" fontSize="10">{Math.round(value * 100)}</text>
                        {rowIndex === 0 ? (
                          <text x="14" y="-8" textAnchor="middle" fill="rgba(226, 232, 240, 0.7)" fontSize="10">{activeContextTokens[columnIndex]}</text>
                        ) : null}
                        {columnIndex === 0 ? (
                          <text x="-6" y="18" textAnchor="end" fill="rgba(226, 232, 240, 0.7)" fontSize="10">{activeContextTokens[rowIndex]}</text>
                        ) : null}
                      </g>
                    ))
                  ))}
                  <text x="272" y="186" fill="rgba(226, 232, 240, 0.7)" fontSize="11">每个格子表示“当前 token 看其它 token 看了多少”。越接近右下角，说明越关注最近上下文。</text>

                  <text x="510" y="28" fill="#7dd3fc" fontSize="13">输出投影矩阵</text>
                  {projectionMatrix.map((row, rowIndex) => (
                    row.map((value, columnIndex) => {
                      const token = activePairTopThree[columnIndex]?.[0];
                      const isTarget = token === activePretrainPair.targetToken;
                      return (
                        <g key={`proj-${rowIndex}-${columnIndex}`} transform={`translate(${510 + columnIndex * 50}, ${44 + rowIndex * 24})`}>
                          <rect width="40" height="18" rx="4" fill={isTarget ? `rgba(34, 197, 94, ${0.16 + value * 0.7})` : `rgba(59, 130, 246, ${0.12 + value * 0.62})`} stroke={isTarget ? 'rgba(134, 239, 172, 0.35)' : 'rgba(148, 163, 184, 0.12)'} />
                          {rowIndex === 0 ? (
                            <text x="20" y="-8" textAnchor="middle" fill={isTarget ? '#86efac' : 'rgba(226, 232, 240, 0.7)'} fontSize="10">{token}</text>
                          ) : null}
                        </g>
                      );
                    })
                  ))}
                  <text x="510" y="186" fill="rgba(226, 232, 240, 0.7)" fontSize="11">隐藏状态再乘输出矩阵后，最匹配真实标签的那一列会逐渐更亮。</text>

                  <text x="24" y="224" fill="#7dd3fc" fontSize="13">拟合训练数据的过程</text>
                  <line x1="42" y1="314" x2="282" y2="314" stroke="rgba(148, 163, 184, 0.28)" />
                  <line x1="42" y1="314" x2="42" y2="246" stroke="rgba(148, 163, 184, 0.28)" />
                  {[0, 20, 40, 60, 80].map((tick) => (
                    <g key={`tick-${tick}`}>
                      <line x1="38" y1={314 - tick * 0.8} x2="42" y2={314 - tick * 0.8} stroke="rgba(148, 163, 184, 0.28)" />
                      <text x="32" y={318 - tick * 0.8} textAnchor="end" fill="rgba(226, 232, 240, 0.55)" fontSize="10">{tick}</text>
                    </g>
                  ))}
                  {fitSeries.length > 1 ? (
                    <>
                      <polyline
                        fill="none"
                        stroke="url(#llmFitLine)"
                        strokeWidth="4"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={fitSeries.map((point, index) => `${42 + index * (240 / Math.max(fitSeries.length - 1, 1))},${314 - point.probability * 0.8}`).join(' ')}
                      />
                      {fitSeries.map((point, index) => (
                        <g key={`fit-${point.epoch}`}>
                          <circle cx={42 + index * (240 / Math.max(fitSeries.length - 1, 1))} cy={314 - point.probability * 0.8} r={index === fitSeries.length - 1 ? 6 : 4} fill={index === fitSeries.length - 1 ? '#86efac' : '#7dd3fc'} />
                          <text x={42 + index * (240 / Math.max(fitSeries.length - 1, 1))} y="330" textAnchor="middle" fill="rgba(226, 232, 240, 0.55)" fontSize="10">{point.epoch}</text>
                        </g>
                      ))}
                    </>
                  ) : null}
                  <text x="42" y="340" fill="rgba(226, 232, 240, 0.7)" fontSize="11">横轴是训练轮数，纵轴是真实标签概率。曲线抬升说明模型在拟合训练数据。</text>

                  <text x="360" y="224" fill="#7dd3fc" fontSize="13">当前样本如何贴近数据</text>
                  <rect x="360" y="244" width="148" height="22" rx="11" fill="rgba(148, 163, 184, 0.14)" />
                  <rect x="360" y="244" width={Math.max(12, activePairTargetProbability * 1.48)} height="22" rx="11" fill="rgba(34, 197, 94, 0.78)">
                    <animate attributeName="width" values={`12;${Math.max(12, activePairTargetProbability * 1.48)}`} dur="1.1s" repeatCount="1" />
                  </rect>
                  <text x="434" y="260" textAnchor="middle" fill="#f8fafc" fontSize="12">真实标签命中率 {activePairTargetProbability.toFixed(1)}%</text>

                  <rect x="360" y="284" width="148" height="18" rx="9" fill="rgba(148, 163, 184, 0.14)" />
                  <rect x="360" y="284" width={Math.max(8, activePairConnectionAfter * 1.48)} height="18" rx="9" fill="rgba(56, 189, 248, 0.78)">
                    <animate attributeName="width" values={`8;${Math.max(8, activePairConnectionAfter * 1.48)}`} dur="1.1s" repeatCount="1" />
                  </rect>
                  <text x="514" y="297" fill="#7dd3fc" fontSize="11">输入到目标连接更粗</text>

                  <rect x="554" y="238" width="176" height="74" rx="16" fill="rgba(15, 23, 42, 0.74)" stroke="rgba(148, 163, 184, 0.12)" />
                  <text x="570" y="258" fill="#f8fafc" fontSize="12">当前拟合对象</text>
                  <text x="570" y="280" fill="#7dd3fc" fontSize="12">输入：{activePretrainPair.inputToken}</text>
                  <text x="570" y="298" fill="#86efac" fontSize="12">目标：{activePretrainPair.targetToken}</text>
                </svg>
              ) : (
                <div style={{ color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                  先至少选择 2 条预训练语料，系统才会生成矩阵和拟合视图。
                </div>
              )}
            </div>
          </div>

          <div id="llm-distribution-panel" onClick={() => reportClick('llm-distribution-panel')} className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>观察这一次训练如何推动分布</h3>
            <div id="llm-prompt-panel" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {promptPresets.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelectedPromptId(item.id);
                    setUseCustomPrompt(false);
                    setGeneratedTokens([]);
                    reportClick('llm-prompt-panel');
                  }}
                  style={{
                    padding: '8px 12px',
                    background: selectedPromptId === item.id ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.48)',
                    borderColor: selectedPromptId === item.id ? 'rgba(56, 189, 248, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { title: '真实词当前概率', value: `${activePairTargetProbability.toFixed(1)}%`, accent: activePairTargetProbability >= 55 ? '#22c55e' : '#f59e0b' },
                { title: '简化损失', value: activePretrainPair ? activePairLoss.toFixed(2) : '-', accent: '#f472b6' },
                { title: '这条连接强度', value: activePretrainPair ? `${activePairTargetCount} -> ${activePairTargetCount + 1}` : '-', accent: '#60a5fa' }
              ].map((item) => (
                <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                  <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.9)' }}>{item.title}</div>
                  <div style={{ marginTop: '8px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {activePretrainPair ? (
                activePretrainPair.contextTokens.map((token, index) => (
                  <TokenChip key={`${token}-${index}`} token={token} active={index === activePretrainPair.contextTokens.length - 1} />
                ))
              ) : (
                currentPrompt.tokens.map((token, index) => (
                  <TokenChip key={`${token}-${index}`} token={token} active={index === currentPrompt.tokens.length - 1} />
                ))
              )}
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              {(activePretrainPair ? activePairDistribution : currentDistribution).map(([token, percent], index) => (
                <div key={token}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ color: activePretrainPair && token === activePretrainPair.targetToken ? '#86efac' : '#e2e8f0' }}>
                      {token}{activePretrainPair && token === activePretrainPair.targetToken ? ' ← 真实标签' : ''}
                    </span>
                    <strong style={{ color: index === 0 ? '#7dd3fc' : '#cbd5e1' }}>{percent.toFixed(1)}%</strong>
                  </div>
                  <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.14)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: activePretrainPair && token === activePretrainPair.targetToken
                          ? 'linear-gradient(90deg, #22c55e, #86efac)'
                          : 'linear-gradient(90deg, #3b82f6, #7dd3fc)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ fontSize: '0.78rem', color: '#7dd3fc' }}>这轮训练把哪条连接加粗了</div>
              {activePretrainPair ? (
                <svg viewBox="0 0 760 140" style={{ width: '100%', height: 'auto', display: 'block', marginTop: '10px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.5)' }}>
                  <defs>
                    <linearGradient id="llmConnBefore" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#64748b" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="llmConnAfter" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#86efac" />
                    </linearGradient>
                    <filter id="llmConnGlow">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect x="28" y="42" width="112" height="42" rx="20" fill="rgba(56, 189, 248, 0.16)" stroke="rgba(56, 189, 248, 0.34)" />
                  <text x="84" y="68" textAnchor="middle" fill="#f8fafc" fontSize="16" fontWeight="700">{activePretrainPair.inputToken}</text>

                  <rect x="620" y="42" width="112" height="42" rx="20" fill="rgba(34, 197, 94, 0.16)" stroke="rgba(34, 197, 94, 0.34)" />
                  <text x="676" y="68" textAnchor="middle" fill="#f8fafc" fontSize="16" fontWeight="700">{activePretrainPair.targetToken}</text>

                  <text x="182" y="44" fill="rgba(226, 232, 240, 0.68)" fontSize="12">更新前</text>
                  <line x1="182" y1="58" x2="578" y2="58" stroke="url(#llmConnBefore)" strokeWidth="8" strokeLinecap="round" opacity="0.9">
                    <animate attributeName="stroke-width" values="8;8;8" dur="1s" repeatCount="indefinite" />
                  </line>
                  <circle cx="210" cy="58" r="5" fill="#94a3b8">
                    <animate attributeName="cx" values="182;578" dur="2.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.8;0.8;0" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                  <text x="588" y="63" fill="#cbd5e1" fontSize="12">{activePairTargetCount}</text>

                  <text x="182" y="103" fill="rgba(226, 232, 240, 0.68)" fontSize="12">更新后</text>
                  <line x1="182" y1="117" x2="578" y2="117" stroke="url(#llmConnAfter)" strokeWidth="14" strokeLinecap="round" opacity="0.98" filter="url(#llmConnGlow)">
                    <animate attributeName="stroke-width" values="10;16;10" dur="1.8s" repeatCount="indefinite" />
                  </line>
                  <circle cx="222" cy="117" r="6" fill="#86efac" filter="url(#llmConnGlow)">
                    <animate attributeName="cx" values="182;578" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;1;1;0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text x="588" y="122" fill="#86efac" fontSize="12">{activePairTargetCount + 1}</text>
                </svg>
              ) : (
                <div style={{ marginTop: '8px', color: 'rgba(226, 232, 240, 0.72)' }}>等待样本</div>
              )}
            </div>
          </div>
        </section>
      )}

      {isSftStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: '16px' }}>
          <div id="llm-sft-panel" className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>第 3 步：加入指令样本</h3>
            <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
              现在不再展示采集语料页面，只保留预训练摘要。当前页面只关注“怎样让模型学会回答”。
            </p>

            <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
              {allSftCorpus.map((item) => {
                const active = selectedSft.includes(item.id);
                return (
                  <div key={item.id} style={{ display: 'grid', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => { toggleSftSample(item.id); reportClick('llm-sft-panel'); }}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        background: active ? 'rgba(167, 139, 250, 0.14)' : 'rgba(15, 23, 42, 0.48)',
                        borderColor: active ? 'rgba(167, 139, 250, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                      }}
                    >
                      <div style={{ color: '#f8fafc', fontWeight: 700 }}>{item.title}</div>
                      <div style={{ marginTop: '6px', color: 'rgba(226, 232, 240, 0.7)', lineHeight: 1.6 }}>
                        {item.text}
                      </div>
                    </button>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.tokens.map((token) => <TokenChip key={`${item.id}-${token}`} token={token} accent="#a78bfa" />)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '14px', padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ color: '#a78bfa', fontSize: '0.8rem' }}>学生输入指令样本</div>
              <input
                value={customSftTitle}
                onChange={(e) => setCustomSftTitle(e.target.value)}
                placeholder="样本标题"
                style={{ width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc' }}
              />
              <textarea
                value={customSftText}
                onChange={(e) => setCustomSftText(e.target.value)}
                placeholder="输入问答格式，例如：问题 什么 是 分词 回答 把 文本 切成 token"
                rows={3}
                style={{ width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button className="btn" type="button" onClick={() => { addCustomSftCorpus(); reportClick('llm-sft-panel'); }}>
                  加入微调语料
                </button>
                <button id="llm-btn-sft" className="btn btn-primary" type="button" onClick={() => { handleSftOnce(); reportClick('llm-btn-sft'); }} disabled={selectedSft.length === 0}>
                  微调 1 轮
                </button>
                <button className="btn" type="button" onClick={handleReset}>
                  重置实验
                </button>
              </div>
            </div>
          </div>

          <div id="llm-distribution-panel" onClick={() => reportClick('llm-distribution-panel')} className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>观察“回答”位置的变化</h3>
            <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
              建议切到问答类 prompt，观察微调后 `回答` 后面的词是否更倾向于规范答案。
            </p>
            <div id="llm-prompt-panel" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {promptPresets.slice(2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelectedPromptId(item.id);
                    setUseCustomPrompt(false);
                    setGeneratedTokens([]);
                    reportClick('llm-prompt-panel');
                  }}
                  style={{
                    padding: '8px 12px',
                    background: selectedPromptId === item.id ? 'rgba(167, 139, 250, 0.18)' : 'rgba(15, 23, 42, 0.48)',
                    borderColor: selectedPromptId === item.id ? 'rgba(167, 139, 250, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
              {[
                { title: '已选样本', value: selectedSft.length, accent: '#a78bfa' },
                { title: '微调轮数', value: sftEpochs, accent: '#a78bfa' },
                { title: '正确词概率', value: `${expectedProbability.toFixed(1)}%`, accent: expectedProbability >= 55 ? '#86efac' : '#7dd3fc' }
              ].map((item) => (
                <div key={item.title} style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.58)', border: `1px solid ${item.accent}22` }}>
                  <div style={{ fontSize: '0.76rem', color: 'rgba(148, 163, 184, 0.9)' }}>{item.title}</div>
                  <div style={{ marginTop: '8px', color: item.accent, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              {currentDistribution.map(([token, percent], index) => (
                <div key={token}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ color: token === currentPrompt.answer ? '#86efac' : '#e2e8f0' }}>
                      {token}{token === currentPrompt.answer ? ' ← 正确答案' : ''}
                    </span>
                    <strong style={{ color: index === 0 ? '#7dd3fc' : '#cbd5e1' }}>{percent.toFixed(1)}%</strong>
                  </div>
                  <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.14)', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #c4b5fd)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isGenerateStage && (
        <section style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>第 4 步：做推理</h3>
              <p style={{ margin: '8px 0 0', color: 'rgba(226, 232, 240, 0.72)', lineHeight: 1.7 }}>
                现在只保留推理要用到的模块。你可以切换 prompt、调温度、逐词生成，观察模型如何一步步往后接。
              </p>
            </div>

            <div id="llm-prompt-panel" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {promptPresets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelectedPromptId(item.id);
                    setUseCustomPrompt(false);
                    setGeneratedTokens([]);
                    reportClick('llm-prompt-panel');
                  }}
                  style={{
                    padding: '8px 12px',
                    background: selectedPromptId === item.id ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.48)',
                    borderColor: selectedPromptId === item.id ? 'rgba(56, 189, 248, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setUseCustomPrompt(true);
                  setGeneratedTokens([]);
                  reportClick('llm-prompt-panel');
                }}
                style={{
                  padding: '8px 12px',
                  background: useCustomPrompt ? 'rgba(20, 184, 166, 0.18)' : 'rgba(15, 23, 42, 0.48)',
                  borderColor: useCustomPrompt ? 'rgba(20, 184, 166, 0.36)' : 'rgba(148, 163, 184, 0.16)'
                }}
              >
                自定义 Prompt
              </button>
            </div>

            <textarea
              id="llm-custom-prompt"
              value={customPromptText}
              onChange={(e) => {
                setCustomPromptText(e.target.value);
                setUseCustomPrompt(true);
                setGeneratedTokens([]);
                reportClick('llm-custom-prompt');
              }}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.56)', color: '#f8fafc', resize: 'vertical' }}
            />

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center' }}>
                <span style={{ color: '#f8fafc' }}>温度</span>
                <strong style={{ color: '#7dd3fc' }}>{temperature.toFixed(1)}</strong>
              </div>
              <input
                id="llm-temperature-slider"
                type="range"
                min="0.2"
                max="1.8"
                step="0.1"
                value={temperature}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setTemperature(value);
                  reportValueChange('llm-temperature-slider', value);
                }}
                style={{ width: '100%', marginTop: '10px' }}
              />
              <div style={{ marginTop: '8px', color: 'rgba(226, 232, 240, 0.68)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                温度低时更保守，温度高时更容易选到次优词。
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button id="llm-btn-generate" className="btn btn-primary" type="button" onClick={() => { handleGenerateNext(); reportClick('llm-btn-generate'); }}>
                生成下一个 token
              </button>
              <button className="btn" type="button" onClick={handleReset}>
                重置实验
              </button>
            </div>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(15, 23, 42, 0.58)' }}>
              <div style={{ fontSize: '0.78rem', color: 'rgba(148, 163, 184, 0.9)' }}>当前上下文</div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentPrompt.tokens.map((token, index) => (
                  <TokenChip key={`${token}-${index}`} token={token} active={index === currentPrompt.tokens.length - 1} />
                ))}
                {generatedTokens.map((token, index) => (
                  <TokenChip key={`${token}-gen-${index}`} token={token} active={index === generatedTokens.length - 1} accent="#22c55e" />
                ))}
              </div>
            </div>
          </div>

          <div id="llm-distribution-panel" onClick={() => reportClick('llm-distribution-panel')} className="glass-panel" style={{ padding: '18px', background: 'rgba(15, 23, 42, 0.78)' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>当前下一个词分布</h3>
            <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
              {currentDistribution.map(([token, percent], index) => (
                <div key={token}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                    <span style={{ color: '#e2e8f0' }}>{token}</span>
                    <strong style={{ color: index === 0 ? '#7dd3fc' : '#cbd5e1' }}>{percent.toFixed(1)}%</strong>
                  </div>
                  <div style={{ height: '12px', borderRadius: '999px', background: 'rgba(148, 163, 184, 0.14)', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #7dd3fc)' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', padding: '14px', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.36)' }}>
              <div style={{ fontSize: '0.78rem', color: '#7dd3fc' }}>生成建议</div>
              <div style={{ marginTop: '8px', color: '#f8fafc', lineHeight: 1.7 }}>
                先保持低温度生成几次，再把温度拉高，比较模型在同一个问题上会不会更发散。
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
              labId="LLM"
            />
          </div>
        </>
      )}
    </div>
  );
}
