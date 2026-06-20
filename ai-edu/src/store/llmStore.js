// LLM Lab Zustand Store
import { create } from 'zustand';
import { initLLMModel, tokenize, llmTrainStep, llmForward, llmGenerate, getVocabInfo } from '../utils/miniLLMEngine';

// ==================== 训练主题定义 ====================
export const TRAINING_THEMES = {
  qa: {
    id: 'qa',
    name: '问答训练',
    description: '学习问题和回答的对应关系',
    corpus: [
      '问题 机器学习 是什么 回答 让 计算机 自动 学习 数据 模式',
      '问题 神经网络 怎么 工作 回答 通过 前向 传播 和 反向 传播',
      '问题 什么是 梯度 下降 回答 用于 优化 模型 参数 的 算法',
      '问题 深度学习 和 机器学习 什么 区别 回答 深度学习 使用 更多 隐层',
      '问题 注意力机制 作用 什么 回答 帮助 模型 关注 重要 信息',
    ]
  },
  story: {
    id: 'story',
    name: '故事生成',
    description: '学习叙事的逻辑和词汇搭配',
    corpus: [
      '从前 有 一个 聪明 的 模型 它 学会 了 预测 未来',
      '在 数据 的 世界 里 有趣 模式 等待 被 发现',
      '机器 学习 让 人工 智能 越来越 强大',
      '神经网络 像 大脑 一样 处理 信息',
      '通过 训练 模型 学会 识别 模式',
    ]
  },
  technical: {
    id: 'technical',
    name: '技术文档',
    description: '学习技术概念的定义和解释',
    corpus: [
      '神经 网络 由 多层 神经元 组成 可以 处理 复杂 信息',
      '深度 学习 使用 多个 隐层 来 学习 高级 特征',
      '反向 传播 计算 梯度 指导 参数 更新 方向',
      'Transformer 使用 注意力 机制 替代 循环 结构',
      'Token 是 文本 的 基本 处理 单位',
    ]
  }
};

// ==================== Store ====================
const useLLMStore = create((set, get) => ({
  // 模型配置
  config: {
    vocabSize: getVocabInfo().size,
    embedDim: 32,
    numHeads: 4,
    contextLen: 32,
    ffDim: 64,
  },

  // 模型状态
  model: null,
  isModelInitialized: false,

  // 训练状态
  isTraining: false,
  trainingStep: 0,
  lossHistory: [],
  learningRate: 0.1,

  // 当前训练数据
  selectedTheme: 'qa',
  currentCorpus: TRAINING_THEMES.qa.corpus,
  currentTrainingIndex: 0,
  tokenizerMode: 'word',

  // 可视化状态
  mode: 'train',  // 'train' | 'inference'
  currentTokens: [],
  currentText: '',
  embeddings: null,
  attentionWeights: null,

  // 生成状态
  promptTokens: [],
  generatedTokens: [],
  generatedText: '',
  generationProbs: [],
  temperature: 0.8,

  // 词汇表信息
  vocabInfo: null,

  // ========== 初始化 ==========
  initializeModel: () => {
    const { config, currentCorpus, tokenizerMode } = get();
    const model = initLLMModel(config);
    const vocabInfo = getVocabInfo();

    // 设置初始 tokens 用于可视化
    const firstSample = currentCorpus[0];
    const tokens = tokenize(firstSample, tokenizerMode);
    const tokensWithEos = [...tokens, vocabInfo.vocabToId['<EOS>']];

    set({
      model,
      isModelInitialized: true,
      vocabInfo,
      lossHistory: [],
      trainingStep: 0,
      currentTokens: tokensWithEos,
      currentText: firstSample,
    });

    return model;
  },

  // ========== 训练 ==========
  setLearningRate: (lr) => set({ learningRate: lr }),

  selectTheme: (themeId) => {
    const theme = TRAINING_THEMES[themeId];
    if (theme) {
      // 更新 currentTokens 为新主题的第一个样本
      const firstSample = theme.corpus[0];
      const tokens = tokenize(firstSample, get().tokenizerMode);
      const vocabInfo = get().vocabInfo;
      const tokensWithEos = [...tokens, vocabInfo?.vocabToId['<EOS>'] ?? 3];

      set({
        selectedTheme: themeId,
        currentCorpus: theme.corpus,
        currentTrainingIndex: 0,
        lossHistory: [],
        trainingStep: 0,
        currentTokens: tokensWithEos,
        currentText: firstSample,
      });
    }
  },

  trainStep: () => {
    const { model, currentCorpus, currentTrainingIndex, learningRate, tokenizerMode } = get();
    if (!model || currentCorpus.length === 0) return null;

    // 获取当前训练样本
    const sampleText = currentCorpus[currentTrainingIndex];
    const tokens = tokenize(sampleText, tokenizerMode);

    // 添加 EOS token
    const vocabInfo = get().vocabInfo;
    const tokensWithEos = [...tokens, vocabInfo.vocabToId['<EOS>']];

    // 训练一步
    const result = llmTrainStep(tokensWithEos, model, learningRate);

    // 更新状态
    const nextIndex = (currentTrainingIndex + 1) % currentCorpus.length;

    set({
      model: result.model,
      trainingStep: get().trainingStep + 1,
      lossHistory: [...get().lossHistory.slice(-200), result.loss],
      currentTokens: tokensWithEos,
      currentText: sampleText,
      embeddings: result.embeddings,
      attentionWeights: result.attentionWeights,
      currentTrainingIndex: nextIndex,
    });

    return result;
  },

  trainSteps: (count = 10) => {
    let result = null;
    for (let i = 0; i < count; i++) {
      result = get().trainStep();
      if (!result) break;
    }
    return result;
  },

  previewText: (text) => {
    const { tokenizerMode } = get();
    const vocabInfo = get().vocabInfo || getVocabInfo();
    const tokens = tokenize(text, tokenizerMode);
    set({
      currentText: text,
      currentTokens: [...tokens, vocabInfo.vocabToId['<EOS>']],
    });
  },

  setTrainingCorpus: (corpus) => {
    const cleanedCorpus = corpus.map(text => text.replace(/<EOS>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const firstSample = cleanedCorpus[0] || '';
    const { tokenizerMode } = get();
    const vocabInfo = get().vocabInfo || getVocabInfo();
    const tokens = firstSample ? tokenize(firstSample, tokenizerMode) : [];

    set({
      currentCorpus: cleanedCorpus,
      currentTrainingIndex: 0,
      lossHistory: [],
      trainingStep: 0,
      currentText: firstSample,
      currentTokens: firstSample ? [...tokens, vocabInfo.vocabToId['<EOS>']] : [],
      embeddings: null,
      attentionWeights: null,
    });
  },

  setIsTraining: (isTraining) => set({ isTraining }),

  setTemperature: (temp) => set({ temperature: temp }),

  clearGeneration: () => set({
    generatedTokens: [],
    generatedText: '',
    generationProbs: [],
  }),

  setTokenizerMode: (tokenizerMode) => {
    const { selectedTheme, currentCorpus, vocabInfo, promptTokens, model, mode } = get();
    const vocab = vocabInfo || getVocabInfo();
    const firstSample = currentCorpus[0] || TRAINING_THEMES[selectedTheme].corpus[0];
    const trainingTokens = tokenize(firstSample, tokenizerMode);
    const tokensWithEos = [...trainingTokens, vocab.vocabToId['<EOS>']];

    const nextState = {
      tokenizerMode,
      currentTokens: tokensWithEos,
      currentText: firstSample,
      lossHistory: [],
      trainingStep: 0,
      currentTrainingIndex: 0,
      generatedTokens: [],
      generatedText: '',
      generationProbs: [],
    };

    if (mode === 'inference' && promptTokens.length > 0 && model) {
      const text = promptTokens
        .filter(id => id > 3)
        .map(id => vocab.idToVocab[id] || '')
        .join(' ');
      const nextPromptTokens = [vocab.vocabToId['<BOS>'], ...tokenize(text, tokenizerMode)];
      const forwardResult = llmForward(nextPromptTokens, model);
      Object.assign(nextState, {
        promptTokens: nextPromptTokens,
        currentTokens: nextPromptTokens,
        currentText: text,
        embeddings: forwardResult.embeddings,
        attentionWeights: forwardResult.attentionWeights,
      });
    }

    set(nextState);
  },

  // ========== 推理/生成 ==========
  setMode: (mode) => {
    set({
      mode,
      generatedTokens: [],
      generatedText: '',
      generationProbs: [],
    });
  },

  setPrompt: (text) => {
    const tokens = tokenize(text, get().tokenizerMode);
    const vocabInfo = get().vocabInfo;
    const tokensWithBos = [vocabInfo.vocabToId['<BOS>'], ...tokens];

    // 获取当前嵌入和注意力用于可视化
    const { model } = get();
    if (model) {
      const forwardResult = llmForward(tokensWithBos, model);
      set({
        promptTokens: tokensWithBos,
        currentTokens: tokensWithBos,
        currentText: text,
        embeddings: forwardResult.embeddings,
        attentionWeights: forwardResult.attentionWeights,
      });
    } else {
      set({ promptTokens: tokensWithBos, currentText: text });
    }
  },

  generate: () => {
    const { model, promptTokens, temperature } = get();
    if (!model || promptTokens.length === 0) return null;

    const result = llmGenerate(promptTokens, model, 30, temperature);

    set({
      generatedTokens: result.tokens,
      generatedText: result.text,
      generationProbs: result.probs,
    });

    return result;
  },

  generateOneToken: () => {
    const { model, promptTokens, temperature, generatedTokens } = get();
    if (!model || promptTokens.length === 0) return null;

    const currentTokens = [...promptTokens, ...generatedTokens];
    const vocabInfo = get().vocabInfo;

    // 截断到上下文长度
    const inputTokens = currentTokens.slice(-32);
    const forwardResult = llmForward(inputTokens, model);
    const lastLogits = forwardResult.logits[forwardResult.logits.length - 1];

    // Temperature sampling
    const scaledLogits = lastLogits.map(l => l / temperature);
    const maxLogit = Math.max(...scaledLogits);
    const exps = scaledLogits.map(x => Math.exp(x - maxLogit));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(e => e / sum);

    // 教学演示中只从可见词元采样，避免频繁抽到 <EOS>/<PAD> 看起来像没有生成。
    const candidateIds = probs
      .map((prob, id) => ({ id, prob }))
      .filter(item => item.id > vocabInfo.vocabToId['<EOS>']);
    const candidateProbSum = candidateIds.reduce((sum, item) => sum + item.prob, 0);
    const random = Math.random() * candidateProbSum;
    let cumulative = 0;
    let nextToken = candidateIds[0]?.id ?? vocabInfo.vocabToId['<UNK>'];

    for (const item of candidateIds) {
      cumulative += item.prob;
      if (random <= cumulative) {
        nextToken = item.id;
        break;
      }
    }

    // 更新生成结果和可视化状态
    set({
      generatedTokens: [...generatedTokens, nextToken],
      attentionWeights: forwardResult.attentionWeights,
      generationProbs: probs,
    });

    return nextToken;
  },

  // ========== 清理 ==========
  reset: () => {
    const { config } = get();
    const model = initLLMModel(config);

    set({
      model,
      isTraining: false,
      trainingStep: 0,
      lossHistory: [],
      currentTrainingIndex: 0,
      currentTokens: [],
      currentText: '',
      embeddings: null,
      attentionWeights: null,
      generatedTokens: [],
      generatedText: '',
      generationProbs: [],
    });
  },

  // ========== 获取词汇表 ==========
  getVocab: () => {
    const { vocabInfo } = get();
    if (!vocabInfo) {
      return getVocabInfo();
    }
    return vocabInfo;
  },
}));

export default useLLMStore;
