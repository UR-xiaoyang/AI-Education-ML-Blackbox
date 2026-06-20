import React, { useMemo, useState } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import './AttentionViz.css';

export default function AttentionViz({ tokens, attentionWeights, numHeads = 4 }) {
  const [selectedHead, setSelectedHead] = useState('avg');
  const [selectedCell, setSelectedCell] = useState(null);
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

  // 计算平均注意力权重
  const avgAttentionWeights = useMemo(() => {
    if (!attentionWeights || attentionWeights.length === 0) return null;

    const seqLen = tokenTexts.length;
    if (seqLen === 0) return null;

    // attentionWeights: [numHeads, seqLen, seqLen]
    // 计算所有头的平均值
    const numHeadsActual = attentionWeights.length;
    const avgWeights = Array(seqLen).fill(0).map(() => Array(seqLen).fill(0));

    for (let h = 0; h < numHeadsActual; h++) {
      const headWeights = attentionWeights[h];
      if (headWeights) {
        for (let i = 0; i < seqLen; i++) {
          for (let j = 0; j < seqLen; j++) {
            avgWeights[i][j] += headWeights[i][j] / numHeadsActual;
          }
        }
      }
    }

    return avgWeights;
  }, [attentionWeights, tokenTexts.length]);

  const displayedAttentionWeights = useMemo(() => {
    if (!attentionWeights || attentionWeights.length === 0) return null;
    if (selectedHead === 'avg') return avgAttentionWeights;
    return attentionWeights[selectedHead] || avgAttentionWeights;
  }, [attentionWeights, avgAttentionWeights, selectedHead]);

  // 获取热力图颜色
  const getHeatColor = (value) => {
    // 0: 浅绿 -> 0.5: 黄色 -> 1: 红色
    if (value < 0.25) {
      return `rgba(34, 197, 94, ${0.2 + value * 2})`; // 绿色
    } else if (value < 0.5) {
      return `rgba(250, 204, 21, ${0.4 + (value - 0.25) * 2})`; // 黄色
    } else if (value < 0.75) {
      return `rgba(249, 115, 22, ${0.6 + (value - 0.5) * 2})`; // 橙色
    } else {
      return `rgba(239, 68, 68, ${0.8 + (value - 0.75) * 0.8})`; // 红色
    }
  };

  // 找出每个位置最关注的 token
  const mostAttended = useMemo(() => {
    if (!displayedAttentionWeights) return [];

    return displayedAttentionWeights.map((row, i) => {
      let maxIdx = 0;
      let maxVal = 0;
      for (let j = 0; j < row.length; j++) {
        if (row[j] > maxVal) {
          maxVal = row[j];
          maxIdx = j;
        }
      }
      return { from: i, to: maxIdx, value: maxVal };
    });
  }, [displayedAttentionWeights]);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="glass-panel attention-viz">
        <div className="panel-header">
          <h3>注意力机制可视化</h3>
        </div>
        <div className="empty-state">
          输入文本以观察注意力权重分布
        </div>
      </div>
    );
  }

  if (!attentionWeights || attentionWeights.length === 0) {
    return (
      <div className="glass-panel attention-viz">
        <div className="panel-header">
          <h3>注意力机制可视化</h3>
        </div>
        <div className="empty-state">
          等待注意力计算...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel attention-viz">
      <div className="panel-header">
        <h3>注意力机制可视化</h3>
        <span className="badge">{numHeads} 头注意力</span>
      </div>

      <div className="head-selector">
        <button className={selectedHead === 'avg' ? 'active' : ''} onClick={() => setSelectedHead('avg')}>平均</button>
        {attentionWeights.map((_, h) => (
          <button key={h} className={selectedHead === h ? 'active' : ''} onClick={() => setSelectedHead(h)}>Head {h + 1}</button>
        ))}
      </div>

      {/* 注意力热力图 */}
      <div className="attention-heatmap">
        <span className="section-label">注意力权重热力图 (行=Query, 列=Key):</span>

        {/* 列标签 (Key tokens) */}
        <div className="heatmap-container">
          <div className="row-labels">
            {tokenTexts.map((token, i) => (
              <span key={i} className="row-label">{token}</span>
            ))}
          </div>

          <div className="heatmap-grid">
            {/* 热力图 */}
            <div className="heatmap">
              {displayedAttentionWeights.map((row, i) => (
                <div key={i} className="heatmap-row">
                  {row.map((val, j) => (
                    <div
                      key={j}
                      className={`heatmap-cell ${selectedCell?.from === i && selectedCell?.to === j ? 'selected' : ''}`}
                      style={{ backgroundColor: getHeatColor(val) }}
                      onClick={() => setSelectedCell({ from: i, to: j, value: val })}
                      title={`Query: "${tokenTexts[i]}" → Key: "${tokenTexts[j]}" = ${val.toFixed(3)}`}
                    >
                      {val > 0.5 && (
                        <span className="cell-value">{val.toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* 行标签 (Query tokens) */}
            <div className="col-labels">
              {tokenTexts.map((token, i) => (
                <span key={i} className="col-label">{token}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 每个头的注意力 */}
      {attentionWeights.length > 1 && (
        <div className="multi-head-attention">
          <span className="section-label">各注意力头权重:</span>
          <div className="head-heatmaps">
            {attentionWeights.map((headWeights, h) => (
              <div key={h} className="head-heatmap">
                <span className="head-label">Head {h + 1}</span>
                <div className="mini-heatmap">
                  {headWeights.map((row, i) => (
                    <div key={i} className="mini-row">
                      {row.map((val, j) => (
                        <div
                          key={j}
                          className="mini-cell"
                          style={{ backgroundColor: getHeatColor(val) }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 注意力解释 */}
      <div className="attention-summary">
        <span className="section-label">注意力解读:</span>
        {selectedCell && (
          <div className="selected-attention">
            你选中了 <strong>"{tokenTexts[selectedCell.from]}"</strong> 关注 <strong>"{tokenTexts[selectedCell.to]}"</strong>，权重为 <strong>{(selectedCell.value * 100).toFixed(1)}%</strong>。
          </div>
        )}
        <div className="summary-items">
          {mostAttended.map((item, i) => (
            <div key={i} className="summary-item">
              <span className="from-token">"{tokenTexts[item.from]}"</span>
              <span className="arrow">→</span>
              <span className="to-token">"{tokenTexts[item.to]}"</span>
              <span className="weight">({(item.value * 100).toFixed(0)}%)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="attention-explanation">
        <p><strong>自注意力机制：</strong>模型学习每个Token应该"关注"序列中哪些其他Token。颜色越深(红)，表示注意力越强。</p>
      </div>
    </div>
  );
}
