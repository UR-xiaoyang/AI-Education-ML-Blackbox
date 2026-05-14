import React, { useMemo, useState } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import './TokenEmbedViz.css';

export default function TokenEmbedViz({ tokens, embeddings }) {
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);

  // 将 token IDs 转换为 token 文本
  const tokenTexts = useMemo(() => {
    return tokens.map(id => vocabInfo.vocab[id] || '<UNK>');
  }, [tokens, vocabInfo]);

  // 获取当前 token 的嵌入向量
  const currentEmbedding = useMemo(() => {
    if (!embeddings || embeddings.length === 0) return null;
    return embeddings[embeddings.length - 1]; // 最后一个 token 的嵌入
  }, [embeddings]);

  // 将嵌入向量转换为柱状图数据
  const embeddingBars = useMemo(() => {
    if (!currentEmbedding) return [];
    return currentEmbedding.map((val, i) => ({
      index: i,
      value: val,
      color: val >= 0 ? 'var(--embed-positive, #38bdf8)' : 'var(--embed-negative, #f97316)',
      height: Math.abs(val) * 100 + 5, // 归一化高度
    }));
  }, [currentEmbedding]);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="glass-panel token-embed-viz">
        <div className="panel-header">
          <h3>Token 嵌入可视化</h3>
        </div>
        <div className="empty-state">
          输入文本以观察 Token 如何转换为向量
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel token-embed-viz">
      <div className="panel-header">
        <h3>Token 嵌入可视化</h3>
        <span className="badge">推理模式</span>
      </div>

      <div className="token-sequence">
        <span className="section-label">输入 Tokens:</span>
        <div className="token-chips">
          {tokenTexts.map((text, i) => (
            <span
              key={i}
              className={`token-chip ${i === tokenTexts.length - 1 ? 'active' : ''}`}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      <div className="embedding-matrix">
        <span className="section-label">嵌入矩阵 (词表 → 向量空间):</span>
        <div className="matrix-grid">
          {tokenTexts.map((text, i) => (
            <div key={i} className="matrix-row">
              <span className="token-label">{text}</span>
              <div className="mini-bars">
                {embeddings && embeddings[i] && embeddings[i].slice(0, 8).map((val, j) => (
                  <div
                    key={j}
                    className="mini-bar"
                    style={{
                      backgroundColor: val >= 0 ? 'var(--embed-positive, #38bdf8)' : 'var(--embed-negative, #f97316)',
                      height: `${Math.abs(val) * 50 + 2}%`
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {currentEmbedding && (
        <div className="embedding-vector">
          <span className="section-label">当前 Token 向量 ({tokenTexts[tokenTexts.length - 1]}):</span>
          <div className="vector-bars">
            {embeddingBars.map((bar, i) => (
              <div key={i} className="vector-bar-container" title={`[${i}]: ${bar.value.toFixed(3)}`}>
                <div
                  className="vector-bar"
                  style={{
                    backgroundColor: bar.color,
                    height: `${bar.height}%`,
                  }}
                />
                <span className="bar-value">{bar.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="vector-legend">
            <span className="legend-positive">正值</span>
            <span className="legend-negative">负值</span>
          </div>
        </div>
      )}

      {/* 语义相似性对比 */}
      {embeddings && embeddings.length >= 2 && (
        <div className="embedding-vector" style={{ marginTop: '8px' }}>
          <span className="section-label">💡 语义相似性对比:</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
            {(() => {
              const selectedTokens = [
                { idx: 0, label: tokenTexts[0] },
                { idx: Math.floor(embeddings.length / 2), label: tokenTexts[Math.floor(embeddings.length / 2)] },
                { idx: embeddings.length - 1, label: tokenTexts[embeddings.length - 1] }
              ].filter(t => t.idx < embeddings.length && t.label !== '<PAD>');

              return selectedTokens.map(({ idx, label }) => {
                const vec = embeddings[idx];
                const currentVec = embeddings[embeddings.length - 1];
                if (!vec || !currentVec) return null;
                // 计算余弦相似度
                const dot = vec.reduce((sum, v, i) => sum + v * currentVec[i], 0);
                const normA = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
                const normB = Math.sqrt(currentVec.reduce((sum, v) => sum + v * v, 0));
                const sim = normA > 0 && normB > 0 ? dot / (normA * normB) : 0;
                const simColor = sim > 0.7 ? '#4ade80' : sim > 0.3 ? '#fbbf24' : '#f87171';
                return (
                  <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 8px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', fontSize: '0.75rem' }}>
                    <span style={{ color: '#e2e8f0' }}>{label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span>
                    <span style={{ color: '#e2e8f0' }}>{tokenTexts[embeddings.length - 1]}</span>
                    <span style={{ color: simColor, fontWeight: 'bold' }}>{sim.toFixed(2)}</span>
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            相似度 &gt; 0.7 表示语义相近，&lt; 0.3 表示语义差异大
          </div>
        </div>
      )}

      <div className="embed-explanation">
        <p>每个 Token 被转换为一个 {embeddings?.[0]?.length || 32} 维的向量，这个向量包含了Token的语义信息。</p>
      </div>
    </div>
  );
}
