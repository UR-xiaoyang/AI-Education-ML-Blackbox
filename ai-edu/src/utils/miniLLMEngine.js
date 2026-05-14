// Mini LLM Engine - 简化的 Transformer 语言模型
// 用于浏览器内实时训练和可视化

// ==================== 词表定义 ====================
export const VOCAB = [
  '<PAD>', '<UNK>', '<BOS>', '<EOS>',
  // ML 核心术语
  '机器学习', '神经网络', '深度学习', '模型', '训练', '预测', '数据',
  '学习', '算法', '参数', '权重', '梯度', '损失', '优化',
  '输入', '输出', '层', '神经元', '激活', '函数', '前向', '反向',
  // 常用词
  '是', '的', '在', '和', '与', '可以', '帮助', '理解', '能力',
  '通过', '使用', '进行', '实现', '完成', '得到', '达到', '产生',
  '一个', '两个', '多个', '重要', '主要', '基本', '简单', '复杂',
  '因为', '所以', '如果', '那么', '但是', '虽然', '因此', '然后',
  // 问答相关
  '问题', '什么', '如何', '为什么', '哪个', '哪些', '怎样', '多少',
  '回答', '答案', '解释', '说明', '定义', '概念', '原理', '方法',
  // AI/LLM 相关
  '人工智能', '自然语言', '语言模型', '注意力', 'Transformer',
  'Token', '嵌入', '向量', '特征', '表示', '上下文', '语境',
  // 技术概念
  '卷积', '循环', '编码器', '解码器', '自回归', '预训练', '微调',
  '监督', '无监督', '半监督', '强化学习', '迁移学习',
  // 其他
  '计算机', '自动', '模式', '任务', '智能', '系统', '网络',
  '信息', '处理', '计算', '分析', '识别', '分类', '生成',
];

// 创建词表映射
const VOCAB_TO_ID = {};
const ID_TO_VOCAB = {};
VOCAB.forEach((token, id) => {
  VOCAB_TO_ID[token] = id;
  ID_TO_VOCAB[id] = token;
});

// ==================== 工具函数 ====================
const XavierInit = (fanIn, fanOut) => {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  return Math.random() * 2 * limit - limit;
};

const clip = (value, min, max) => Math.max(min, Math.min(max, value));

// Softmax with numerical stability
const softmax = (arr) => {
  const maxVal = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
};

// 交叉熵损失
const crossEntropy = (logits, targetId) => {
  const maxLogit = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(e => e / sum);

  const prob = Math.max(probs[targetId], 1e-10);
  return -Math.log(prob);
};

// ==================== 模型初始化 ====================
export function initLLMModel(config = {}) {
  const {
    vocabSize = VOCAB.length,
    embedDim = 32,
    numHeads = 4,
    contextLen = 32,
    ffDim = 64,
  } = config;

  const headDim = embedDim / numHeads;

  if (embedDim % numHeads !== 0) {
    throw new Error(`embedDim (${embedDim}) 必须能被 numHeads (${numHeads}) 整除`);
  }

  // 词嵌入矩阵 [vocabSize, embedDim]
  const tokenEmbedding = Array(vocabSize).fill(0).map(() =>
    Array(embedDim).fill(0).map(() => XavierInit(vocabSize, embedDim))
  );

  // 位置编码矩阵 [contextLen, embedDim]
  const positionEmbedding = Array(contextLen).fill(0).map((_, pos) =>
    Array(embedDim).fill(0).map((_, i) => {
      const angle = pos / Math.pow(10000, (2 * i) / embedDim);
      return i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
    })
  );

  // 多头注意力参数
  const attentionParams = {
    Wq: Array(embedDim).fill(0).map(() => Array(embedDim).fill(0).map(() => XavierInit(embedDim, embedDim))),
    Wk: Array(embedDim).fill(0).map(() => Array(embedDim).fill(0).map(() => XavierInit(embedDim, embedDim))),
    Wv: Array(embedDim).fill(0).map(() => Array(embedDim).fill(0).map(() => XavierInit(embedDim, embedDim))),
    Wo: Array(embedDim).fill(0).map(() => Array(embedDim).fill(0).map(() => XavierInit(embedDim, embedDim))),
  };

  // 前馈网络参数
  const ffParams = {
    W1: Array(embedDim).fill(0).map(() => Array(ffDim).fill(0).map(() => XavierInit(embedDim, ffDim))),
    b1: Array(ffDim).fill(0).map(() => 0.1),
    W2: Array(ffDim).fill(0).map(() => Array(embedDim).fill(0).map(() => XavierInit(ffDim, embedDim))),
    b2: Array(embedDim).fill(0).map(() => 0.0),
  };

  // 层归一化参数
  const lnParams = {
    gamma1: Array(embedDim).fill(0).map(() => 1.0),
    beta1: Array(embedDim).fill(0).map(() => 0.0),
    gamma2: Array(embedDim).fill(0).map(() => 1.0),
    beta2: Array(embedDim).fill(0).map(() => 0.0),
  };

  // 语言模型头 [embedDim, vocabSize]
  const lmHead = Array(embedDim).fill(0).map(() =>
    Array(vocabSize).fill(0).map(() => XavierInit(embedDim, vocabSize) * 0.1)
  );

  return {
    vocabSize,
    embedDim,
    numHeads,
    headDim,
    contextLen,
    ffDim,
    tokenEmbedding,
    positionEmbedding,
    attentionParams,
    ffParams,
    lnParams,
    lmHead,
  };
}

// ==================== 分词 ====================
export function tokenize(text) {
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  return tokens.map(token => {
    const id = VOCAB_TO_ID[token];
    return id !== undefined ? id : VOCAB_TO_ID['<UNK>'];
  });
}

export function detokenize(tokenIds) {
  return tokenIds
    .filter(id => id > 3)
    .map(id => ID_TO_VOCAB[id] || '<UNK>')
    .join(' ');
}

// ==================== 矩阵运算 ====================
const matMul = (matrix, vector) => {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  return result;
};

const matMul2D = (A, B) => {
  const rows = A.length;
  const cols = B[0].length;
  const inner = A[0].length;
  const result = Array(rows).fill(0).map(() => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
};

// ==================== 层归一化 ====================
const layerNorm = (x, gamma, beta, eps = 1e-6) => {
  const dim = x.length;
  const mean = x.reduce((sum, val) => sum + val, 0) / dim;
  const variance = x.reduce((sum, val) => sum + (val - mean) ** 2, 0) / dim;
  const normalized = x.map(val => (val - mean) / Math.sqrt(variance + eps));
  return normalized.map((val, i) => gamma[i] * val + beta[i]);
};

const transpose = (matrix) => {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array(cols).fill(0).map(() => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
};

// ==================== 多头注意力 ====================
export function multiHeadAttention(query, key, value, model) {
  const { numHeads, headDim } = model;
  const seqLen = query.length;

  const Q = matMul2D(model.attentionParams.Wq, transpose(query));
  const K = matMul2D(model.attentionParams.Wk, transpose(key));
  const V = matMul2D(model.attentionParams.Wv, transpose(value));

  const heads = [];
  const attentionWeights = [];

  for (let h = 0; h < numHeads; h++) {
    const start = h * headDim;
    const end = start + headDim;

    const Qh = Q.map(row => row.slice(start, end));
    const Kh = K.map(row => row.slice(start, end));
    const Vh = V.map(row => row.slice(start, end));

    const scale = Math.sqrt(headDim);
    const scores = [];
    for (let i = 0; i < seqLen; i++) {
      scores[i] = [];
      for (let j = 0; j < seqLen; j++) {
        let dot = 0;
        for (let k = 0; k < headDim; k++) {
          dot += Qh[i][k] * Kh[j][k];
        }
        scores[i][j] = dot / scale;
      }
    }

    const attnWeights = scores.map(row => softmax(row));
    attentionWeights.push(attnWeights);

    const output = [];
    for (let i = 0; i < seqLen; i++) {
      output[i] = Array(headDim).fill(0);
      for (let j = 0; j < seqLen; j++) {
        for (let k = 0; k < headDim; k++) {
          output[i][k] += attnWeights[i][j] * Vh[j][k];
        }
      }
    }
    heads.push(transpose(output));
  }

  const concatenated = [];
  for (let i = 0; i < seqLen; i++) {
    concatenated[i] = [];
    for (let h = 0; h < numHeads; h++) {
      concatenated[i] = concatenated[i].concat(heads[h][i]);
    }
  }

  const projected = matMul2D(model.attentionParams.Wo, transpose(concatenated));

  return {
    output: transpose(projected),
    attentionWeights
  };
}

// ==================== 前馈网络 ====================
const feedForward = (x, model) => {
  const hidden = Array(x.length).fill(0).map((_, i) => {
    const z = matMul(model.ffParams.W1, x[i]);
    return z.map((val, j) => Math.max(0, val + model.ffParams.b1[j]));
  });

  const output = Array(hidden.length).fill(0).map((_, i) => {
    return matMul(model.ffParams.W2, hidden[i]).map((val, j) => val + model.ffParams.b2[j]);
  });

  return output;
};

// ==================== Transformer 层 ====================
export function transformerLayer(x, model) {
  const residual = x.map(row => [...row]);

  const { output: attnOut, attentionWeights } = multiHeadAttention(x, x, x, model);

  let normed = [];
  for (let i = 0; i < x.length; i++) {
    const added = residual[i].map((val, j) => val + attnOut[i][j]);
    normed.push(layerNorm(added, model.lnParams.gamma1, model.lnParams.beta1));
  }

  const ffOut = feedForward(normed, model);

  const output = [];
  for (let i = 0; i < normed.length; i++) {
    const added = normed[i].map((val, j) => val + ffOut[i][j]);
    output.push(layerNorm(added, model.lnParams.gamma2, model.lnParams.beta2));
  }

  return { output, attentionWeights };
}

// ==================== 完整前向传播 ====================
export function llmForward(tokenIds, model) {
  const { vocabSize, embedDim, contextLen } = model;

  const truncatedIds = tokenIds.slice(0, contextLen - 1);
  const seqLen = truncatedIds.length;

  const embeddings = truncatedIds.map(id => {
    const safeId = Math.min(id, vocabSize - 1);
    return [...model.tokenEmbedding[safeId]];
  });

  for (let i = 0; i < seqLen; i++) {
    for (let j = 0; j < embedDim; j++) {
      embeddings[i][j] += model.positionEmbedding[i][j];
    }
  }

  const { output: transformerOut, attentionWeights } = transformerLayer(embeddings, model);

  const logits = matMul2D(model.lmHead, transpose(transformerOut));

  return {
    logits: transpose(logits),
    embeddings,
    attentionWeights,
    seqLen,
    lastEmbedding: transformerOut[transformerOut.length - 1]
  };
}

// ==================== 计算损失 ====================
export function computeLLMLoss(tokenIds, model) {
  const { logits } = llmForward(tokenIds, model);
  const targetId = tokenIds[tokenIds.length - 1];
  const lastLogits = logits[logits.length - 1];
  return crossEntropy(lastLogits, targetId);
}

// ==================== 训练步骤 (真正可训练的版本) ====================
const GRADIENT_CLIP = 1.0;

export function llmTrainStep(tokenIds, model, learningRate = 0.1) {
  const { vocabSize, embedDim, contextLen } = model;
  const truncatedIds = tokenIds.slice(0, contextLen - 1);

  // 前向传播
  const { logits, embeddings, attentionWeights, lastEmbedding } = llmForward(tokenIds, model);

  // 目标 token
  const targetId = tokenIds[tokenIds.length - 1];
  const lastLogits = logits[logits.length - 1];

  // 计算损失
  const loss = crossEntropy(lastLogits, targetId);

  // 计算概率和梯度
  const probs = softmax(lastLogits);

  // ========== 1. 更新 lmHead 的梯度 ==========
  // dLoss/dLogits[i] = probs[i] - (i === targetId ? 1 : 0)
  // dLogits/dW[j][i] = lastEmbedding[j]
  const dLogits = probs.map((p, i) => p - (i === targetId ? 1 : 0));

  // 更新 lmHead: W = W - lr * dLoss/dW
  const newLmHead = model.lmHead.map((row, j) =>
    row.map((val, i) => {
      const grad = dLogits[i] * lastEmbedding[j];
      const clippedGrad = clip(grad, -GRADIENT_CLIP, GRADIENT_CLIP);
      return val - learningRate * clippedGrad;
    })
  );

  // ========== 2. 反向传播到 embedding ==========
  // dLoss/dEmbedding[j] = sum_i(dLoss/dLogits[i] * dLogits/dEmbedding[j])
  // dLogits[i]/dEmbedding[j] = lmHead[j][i] (before update)
  const dEmbedding = Array(embedDim).fill(0);
  for (let j = 0; j < embedDim; j++) {
    for (let i = 0; i < vocabSize; i++) {
      dEmbedding[j] += dLogits[i] * model.lmHead[j][i];
    }
  }

  // 更新 token embedding (目标 token 的嵌入)
  const targetEmbeddingIdx = truncatedIds[truncatedIds.length - 1];
  const newTokenEmbedding = model.tokenEmbedding.map((row, idx) => {
    if (idx === targetEmbeddingIdx) {
      return row.map((val, j) => {
        const clippedGrad = clip(dEmbedding[j], -GRADIENT_CLIP, GRADIENT_CLIP);
        return val - learningRate * clippedGrad * 0.5;
      });
    }
    return row;
  });

  // ========== 3. 简化：给 attention 和 ff 参数添加小扰动 ==========
  const noiseScale = learningRate * 0.001;

  const newAttentionParams = {
    Wq: model.attentionParams.Wq.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
    Wk: model.attentionParams.Wk.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
    Wv: model.attentionParams.Wv.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
    Wo: model.attentionParams.Wo.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
  };

  const newFfParams = {
    W1: model.ffParams.W1.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
    b1: model.ffParams.b1.map(val => val + (Math.random() - 0.5) * noiseScale),
    W2: model.ffParams.W2.map(row =>
      row.map(val => val + (Math.random() - 0.5) * noiseScale)
    ),
    b2: model.ffParams.b2.map(val => val + (Math.random() - 0.5) * noiseScale),
  };

  return {
    model: {
      ...model,
      lmHead: newLmHead,
      tokenEmbedding: newTokenEmbedding,
      attentionParams: newAttentionParams,
      ffParams: newFfParams,
    },
    loss,
    attentionWeights,
    embeddings,
    probs
  };
}

// ==================== 文本生成 ====================
export function llmGenerate(promptTokens, model, maxLength = 20, temperature = 0.8) {
  const { vocabSize, contextLen } = model;
  let tokens = [...promptTokens];
  const generated = [];

  for (let step = 0; step < maxLength; step++) {
    const inputTokens = tokens.slice(-contextLen);
    const { logits } = llmForward(inputTokens, model);
    const lastLogits = logits[logits.length - 1];

    const scaledLogits = lastLogits.map(l => l / temperature);
    const probs = softmax(scaledLogits);

    const random = Math.random();
    let cumulative = 0;
    let nextToken = VOCAB_TO_ID['<EOS>'];

    for (let i = 0; i < vocabSize; i++) {
      cumulative += probs[i];
      if (random <= cumulative) {
        nextToken = i;
        break;
      }
    }

    if (nextToken === VOCAB_TO_ID['<EOS>'] || nextToken === VOCAB_TO_ID['<PAD>']) {
      break;
    }

    generated.push(nextToken);
    tokens.push(nextToken);
  }

  return {
    tokens: generated,
    text: detokenize(generated),
    probs: softmax(llmForward(promptTokens, model).logits[promptTokens.length - 1])
  };
}

// ==================== 导出词汇表信息 ====================
export function getVocabInfo() {
  return {
    vocab: VOCAB,
    vocabToId: VOCAB_TO_ID,
    idToVocab: ID_TO_VOCAB,
    size: VOCAB.length
  };
}
