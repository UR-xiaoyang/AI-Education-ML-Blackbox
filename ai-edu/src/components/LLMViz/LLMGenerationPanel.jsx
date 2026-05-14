import React, { useMemo } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import './LLMGenerationPanel.css';

export default function LLMGenerationPanel({
  prompt,
  onPromptChange,
  onGenerate,
  onGenerateStep,
  generatedTokens = [],
  generationProbs = [],
}) {
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);

  // 获取前 N 个概率最高的 token
  const topProbs = useMemo(() => {
    if (!generationProbs || generationProbs.length === 0) return [];

    return generationProbs
      .map((prob, id) => ({ id, prob, token: vocabInfo.vocab[id] || '<UNK>' }))
      .filter(item => item.token !== '<PAD>' && item.token !== '<UNK>' && item.token !== '<BOS>')
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 8);
  }, [generationProbs, vocabInfo]);

  return (
    <div className="glass-panel llm-generation-panel">
      <div className="panel-header">
        <h3>文本生成</h3>
      </div>

      {/* 输入区域 */}
      <div className="prompt-section">
        <span className="section-label">输入提示词:</span>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="输入提示词..."
          className="prompt-input"
          rows={2}
        />
      </div>

      {/* 生成按钮 */}
      <div className="generation-controls">
        <button className="btn btn-secondary" onClick={onGenerateStep}>
          单步生成
        </button>
        <button className="btn btn-primary" onClick={onGenerate}>
          生成文本
        </button>
      </div>

      {/* 生成结果 */}
      <div className="generation-result">
        <span className="section-label">生成结果:</span>
        <div className="generated-text">
          {generatedTokens.length > 0 ? (
            <div className="token-stream">
              {generatedTokens.map((id) => (
                <span key={id} className="generated-token">
                  {vocabInfo.vocab[id] || '<UNK>'}
                </span>
              ))}
            </div>
          ) : (
            <span className="empty-hint">点击"生成"按钮开始生成文本</span>
          )}
        </div>
      </div>

      {/* 概率分布 */}
      <div className="prob-section">
        <span className="section-label">下一个词概率分布:</span>
        <div className="prob-bars">
          {topProbs.length > 0 ? (
            topProbs.map((item) => (
              <div key={item.id} className="prob-item">
                <span className="prob-token">{item.token}</span>
                <div className="prob-bar-container">
                  <div
                    className="prob-bar"
                    style={{ width: `${item.prob * 100}%` }}
                  />
                </div>
                <span className="prob-value">{(item.prob * 100).toFixed(1)}%</span>
              </div>
            ))
          ) : (
            <span className="empty-hint">等待生成...</span>
          )}
        </div>
      </div>

      {/* Temperature 说明 */}
      <div className="temp-explanation">
        <p>Temperature 控制生成随机性：
          <br />
          <span className="temp-low">低值 (0.1-0.5)</span> 更确定，<span className="temp-high">高值 (1.0+)</span> 更多样
        </p>
      </div>
    </div>
  );
}
