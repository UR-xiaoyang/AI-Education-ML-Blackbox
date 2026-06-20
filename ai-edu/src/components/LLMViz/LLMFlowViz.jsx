import React, { useEffect, useMemo, useState } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import './LLMFlowViz.css';

const STAGES = [
  {
    id: 'tokens',
    label: 'Token IDs',
    eyebrow: '离散符号',
    accent: '#38bdf8',
    detail: '文本被分割成 Token 后映射为数字 ID。后续所有计算都从这串 ID 开始。',
  },
  {
    id: 'embedding',
    label: 'Embedding',
    eyebrow: '查表成向量',
    accent: '#818cf8',
    detail: '每个 ID 查表得到一条向量，模型用向量坐标表达词元的语义位置。',
  },
  {
    id: 'positional',
    label: 'Position',
    eyebrow: '注入顺序',
    accent: '#a78bfa',
    detail: '位置编码让模型知道 Token 的先后顺序，否则同一批词换顺序会难以区分。',
  },
  {
    id: 'attention',
    label: 'Attention',
    eyebrow: '上下文聚合',
    accent: '#c084fc',
    detail: '每个位置根据注意力权重读取其他位置的信息，形成上下文相关表示。',
  },
  {
    id: 'ffn',
    label: 'FFN',
    eyebrow: '特征变换',
    accent: '#e879f9',
    detail: '前馈网络对每个位置的向量做非线性变换，把注意力结果转成更有用的特征。',
  },
  {
    id: 'output',
    label: 'Next Token',
    eyebrow: '概率分布',
    accent: '#f472b6',
    detail: '语言模型头把最后的向量投影到词表，得到下一个 Token 的概率分布。',
  },
];

export default function LLMFlowViz({ tokens, isTraining = false, trainingStep = 0, currentLoss = null }) {
  const [selectedStageId, setSelectedStageId] = useState('tokens');
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);

  const tokenDetails = useMemo(() => {
    return tokens
      .map(id => ({ id, token: vocabInfo.vocab[id] || '<UNK>' }))
      .filter(item => item.token !== '<PAD>');
  }, [tokens, vocabInfo]);

  const visibleTokens = tokenDetails.slice(0, 6);
  const activeStageIndex = isTraining ? trainingStep % STAGES.length : STAGES.findIndex(stage => stage.id === selectedStageId);
  const activeStage = STAGES[Math.max(0, activeStageIndex)] || STAGES[0];
  const selectedStage = STAGES.find(stage => stage.id === selectedStageId) || STAGES[0];
  const selectedIndex = STAGES.findIndex(stage => stage.id === selectedStage.id);
  const lossSignal = currentLoss === null ? 0.5 : Math.max(0.08, Math.min(1, currentLoss / 5));
  const stageData = useMemo(() => buildStageData(visibleTokens, vocabInfo.vocab, trainingStep, lossSignal), [visibleTokens, vocabInfo, trainingStep, lossSignal]);
  const selectedStageData = stageData[selectedStage.id];

  useEffect(() => {
    if (isTraining) {
      setSelectedStageId(activeStage.id);
    }
  }, [isTraining, activeStage.id]);

  return (
    <div className="glass-panel llm-flow-viz redesigned-flow">
      <div className="panel-header flow-header">
        <div>
          <h3>LLM 数据流图</h3>
          <p>观察一串 Token 如何随训练步数和 Loss 逐层改变。</p>
        </div>
        <span className={`badge ${isTraining ? 'training' : 'idle'}`}>
          {isTraining ? `训练步 ${trainingStep}` : '等待训练'}
        </span>
      </div>

      <div className="token-ribbon" aria-label="当前 token 序列">
        <span className="ribbon-label">当前输入</span>
        <div className="ribbon-tokens">
          {visibleTokens.length > 0 ? visibleTokens.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              className="ribbon-token"
              onClick={() => setSelectedStageId('tokens')}
              title={`Token ID: ${item.id}`}
            >
              <span>{item.token.length > 6 ? `${item.token.slice(0, 5)}…` : item.token}</span>
              <small>ID {item.id}</small>
            </button>
          )) : <span className="empty-token">暂无 Token</span>}
          {tokenDetails.length > visibleTokens.length && (
            <span className="token-overflow">+{tokenDetails.length - visibleTokens.length}</span>
          )}
        </div>
      </div>

      <div className={`flow-board ${isTraining ? 'training' : ''}`}>
        <div className="flow-lane" aria-hidden="true">
          <span style={{ left: `${Math.max(3, activeStageIndex * 17)}%` }} />
        </div>

        {STAGES.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            className={`flow-stage-card ${selectedStage.id === stage.id ? 'selected' : ''} ${activeStage.id === stage.id ? 'live' : ''}`}
            style={{ '--accent': stage.accent }}
            onClick={() => setSelectedStageId(stage.id)}
          >
            <span className="stage-order">{String(index + 1).padStart(2, '0')}</span>
            <span className="stage-eyebrow">{stage.eyebrow}</span>
            <strong>{stage.label}</strong>
            <MiniArtifact stageId={stage.id} tokenDetails={visibleTokens} />
          </button>
        ))}
      </div>

      <div className="stage-inspector" style={{ '--accent': selectedStage.accent }}>
        <div className="inspector-copy">
          <span>当前阶段 {selectedIndex + 1}/6</span>
          <h4>{selectedStage.label}</h4>
          <p>{selectedStage.detail}</p>
          <div className="training-signal">
            <span>训练步数 <strong>{trainingStep}</strong></span>
            <span>当前 Loss <strong>{currentLoss === null ? '-' : currentLoss.toFixed(3)}</strong></span>
            <span>变化强度 <strong>{(1 - lossSignal).toFixed(2)}</strong></span>
          </div>
        </div>
        <div className="inspector-artifact">
          <MiniArtifact stageId={selectedStage.id} tokenDetails={visibleTokens} large />
        </div>
        <StageDataPanel data={selectedStageData} />
      </div>
    </div>
  );
}

function buildStageData(tokenDetails, vocab, trainingStep, lossSignal) {
  const baseTokens = tokenDetails.length > 0 ? tokenDetails : [{ id: 1, token: '<UNK>' }];
  const ids = baseTokens.map(item => item.id);
  const tokenNames = baseTokens.map(item => item.token);
  const learningSignal = 1 - lossSignal;
  const stepDrift = (trainingStep % 17) / 50;
  const vectors = ids.slice(0, 4).map((id, tokenIndex) => ({
    label: tokenNames[tokenIndex],
    values: Array.from({ length: 4 }, (_, dim) => Number(((((id * (dim + 3) + tokenIndex * 7 + trainingStep) % 19) / 10 - 0.9) * (0.75 + learningSignal * 0.55)).toFixed(2))),
  }));
  const positioned = vectors.map((item, index) => ({
    label: item.label,
    values: item.values.map((value, dim) => Number((value + Math.sin((index + 1 + stepDrift) / (dim + 2))).toFixed(2))),
  }));
  const attended = positioned.map((item, index) => {
    const focusIndex = (index + trainingStep) % tokenNames.length;
    return {
      label: item.label,
      focus: tokenNames[focusIndex] || item.label,
      weight: Number(Math.min(0.95, 0.28 + learningSignal * 0.32 + ((ids[index] || 1) % 5) * 0.07).toFixed(2)),
    };
  });
  const ffn = attended.map((item, index) => ({
    label: item.label,
    feature: Number((item.weight * (1.2 + index * 0.12)).toFixed(2)),
  }));
  const predictions = ids.slice(-4).reverse().map((id, index) => {
    const vocabIndex = 4 + ((id + index * 11 + trainingStep) % Math.max(1, vocab.length - 4));
    return {
      token: vocab[vocabIndex] || '<UNK>',
      prob: Math.max(8, Math.round(32 + learningSignal * 30 - index * (7 + lossSignal * 8))),
    };
  });

  return {
    tokens: {
      inputLabel: '分割后的词元',
      outputLabel: '模型实际接收的 ID 序列',
      input: tokenNames,
      output: ids.map(id => `ID ${id}`),
    },
    embedding: {
      inputLabel: '输入 ID',
      outputLabel: '查表后的向量片段',
      input: ids.map(id => `ID ${id}`),
      output: vectors.map(item => `${item.label}: [${item.values.join(', ')}]`),
    },
    positional: {
      inputLabel: 'Token 向量',
      outputLabel: '加上位置后的向量',
      input: vectors.map(item => `${item.label}: [${item.values.join(', ')}]`),
      output: positioned.map((item, index) => `pos ${index + 1} ${item.label}: [${item.values.join(', ')}]`),
    },
    attention: {
      inputLabel: '带位置的向量',
      outputLabel: '注意力聚合结果',
      input: positioned.map((item, index) => `pos ${index + 1}: ${item.label}`),
      output: attended.map(item => `${item.label} 主要关注 ${item.focus}，权重 ${item.weight}`),
    },
    ffn: {
      inputLabel: '上下文向量',
      outputLabel: '特征变换后表示',
      input: attended.map(item => `${item.label}: context=${item.weight}`),
      output: ffn.map(item => `${item.label}: feature=${item.feature}`),
    },
    output: {
      inputLabel: '最后位置表示',
      outputLabel: '候选下一个 Token 概率',
      input: ffn.slice(-2).map(item => `${item.label}: feature=${item.feature}`),
      output: predictions.map(item => `${item.token}: ${item.prob}%`),
    },
  };
}

function StageDataPanel({ data }) {
  if (!data) return null;

  return (
    <div className="stage-data-panel">
      <div>
        <span>{data.inputLabel}</span>
        <ul>
          {data.input.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
      <div>
        <span>{data.outputLabel}</span>
        <ul>
          {data.output.slice(0, 5).map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

function MiniArtifact({ stageId, tokenDetails, large = false }) {
  const tokenCount = Math.max(1, tokenDetails.length || 4);

  if (stageId === 'tokens') {
    return (
      <div className={`artifact token-artifact ${large ? 'large' : ''}`}>
        {(tokenDetails.length > 0 ? tokenDetails : [{ id: 0, token: '<空>' }]).slice(0, large ? 6 : 4).map((item, index) => (
          <span key={`${item.id}-${index}`}>{item.id}</span>
        ))}
      </div>
    );
  }

  if (stageId === 'embedding') {
    return (
      <div className={`artifact vector-artifact ${large ? 'large' : ''}`}>
        {Array.from({ length: large ? 18 : 9 }, (_, index) => (
          <span key={index} style={{ height: `${28 + ((index * 17) % 34)}%` }} />
        ))}
      </div>
    );
  }

  if (stageId === 'positional') {
    return (
      <div className={`artifact position-artifact ${large ? 'large' : ''}`}>
        {Array.from({ length: large ? 8 : 5 }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
    );
  }

  if (stageId === 'attention') {
    return (
      <div className={`artifact attention-artifact ${large ? 'large' : ''}`}>
        {Array.from({ length: tokenCount * tokenCount }, (_, index) => (
          <span key={index} style={{ opacity: 0.18 + ((index * 11) % 70) / 100 }} />
        ))}
      </div>
    );
  }

  if (stageId === 'ffn') {
    return (
      <div className={`artifact ffn-artifact ${large ? 'large' : ''}`}>
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className={`artifact output-artifact ${large ? 'large' : ''}`}>
      {[72, 48, 32, 18].map((width, index) => (
        <span key={index} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
