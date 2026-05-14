import React, { useMemo } from 'react';
import { VOCAB } from '../../utils/miniLLMEngine';
import { detokenize } from '../../utils/miniLLMEngine';
import './TokenizationViz.css';

export default function TokenizationViz({ tokens, showDetails = true }) {
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);

  // 将 token IDs 转换为详细信息
  const tokenDetails = useMemo(() => {
    return tokens.map(id => ({
      id,
      token: vocabInfo.vocab[id] || '<UNK>',
      isSpecial: id <= 3, // <PAD>, <UNK>, <BOS>, <EOS>
    }));
  }, [tokens, vocabInfo]);

  // 过滤掉 PAD token
  const displayTokens = tokenDetails.filter(t => t.token !== '<PAD>');

  // 获取原始文本
  const originalText = useMemo(() => {
    const textTokens = displayTokens.filter(t => !t.isSpecial);
    return detokenize(textTokens.map(t => t.id));
  }, [displayTokens]);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="glass-panel tokenization-viz">
        <div className="panel-header">
          <h3>Tokenization 可视化</h3>
        </div>
        <div className="empty-state">
          <span className="empty-icon">📝</span>
          <p>选择一个训练主题开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel tokenization-viz">
      <div className="panel-header">
        <h3>Tokenization 可视化</h3>
        <span className="badge">{displayTokens.length} tokens</span>
      </div>

      {/* 流程示意 */}
      <div className="tokenization-flow">
        {/* 阶段1：原始文本 */}
        <div className="flow-stage">
          <div className="stage-label">
            <span className="stage-num">1</span>
            <span>原始文本</span>
          </div>
          <div className="original-text">
            <code>{originalText}</code>
          </div>
        </div>

        {/* 箭头 */}
        <div className="flow-arrow">
          <span>↓</span>
          <span className="arrow-label">分词</span>
        </div>

        {/* 阶段2：Token 列表 */}
        <div className="flow-stage">
          <div className="stage-label">
            <span className="stage-num">2</span>
            <span>Tokens</span>
          </div>
          <div className="token-sequence">
            {displayTokens.slice(0, 8).map((t, i) => (
              <div key={i} className={`token-chip ${t.isSpecial ? 'special' : ''}`}>
                <span className="token-text">{t.token}</span>
              </div>
            ))}
            {displayTokens.length > 8 && (
              <div className="token-chip more">
                <span className="token-text">+{displayTokens.length - 8}</span>
              </div>
            )}
          </div>
        </div>

        {/* 箭头 */}
        <div className="flow-arrow">
          <span>↓</span>
          <span className="arrow-label">ID映射</span>
        </div>

        {/* 阶段3：Token IDs */}
        <div className="flow-stage">
          <div className="stage-label">
            <span className="stage-num">3</span>
            <span>Token IDs</span>
          </div>
          <div className="token-ids">
            {displayTokens.slice(0, 8).map((t, i) => (
              <div key={i} className={`id-chip ${t.isSpecial ? 'special' : ''}`}>
                <span className="id-value">{t.id}</span>
              </div>
            ))}
            {displayTokens.length > 8 && (
              <div className="id-chip more">
                <span className="id-value">...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详细信息表格 */}
      {showDetails && displayTokens.length > 0 && (
        <div className="token-table-container">
          <table className="token-table">
            <thead>
              <tr>
                <th>位置</th>
                <th>Token</th>
                <th>ID</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody>
              {displayTokens.slice(0, 10).map((t, i) => (
                <tr key={i} className={t.isSpecial ? 'special-row' : ''}>
                  <td className="pos-cell">{i}</td>
                  <td className="token-cell">
                    <code>{t.token}</code>
                  </td>
                  <td className="id-cell">{t.id}</td>
                  <td className="type-cell">
                    <span className={`type-badge ${t.isSpecial ? 'special' : 'word'}`}>
                      {t.isSpecial ? getSpecialTokenName(t.id) : '词元'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayTokens.length > 10 && (
            <div className="table-footer">
              ... 共 {displayTokens.length} 个 tokens
            </div>
          )}
        </div>
      )}

      {/* 说明 */}
      <div className="token-explanation">
        <div className="explanation-item">
          <span className="explain-icon">💡</span>
          <span>Token 是文本处理的最小单位，中文通常按词分割</span>
        </div>
        <div className="explanation-item">
          <span className="explain-icon">🔢</span>
          <span>每个 Token 映射到一个唯一的数字 ID</span>
        </div>
      </div>
    </div>
  );
}

function getSpecialTokenName(id) {
  switch (id) {
    case 0: return '<PAD>';
    case 1: return '<UNK>';
    case 2: return '<BOS>';
    case 3: return '<EOS>';
    default: return '特殊';
  }
}
