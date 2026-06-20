import React, { useMemo, useState } from 'react';
import { VOCAB, TOKENIZER_OPTIONS, detokenize, tokenizeToPieces } from '../../utils/miniLLMEngine';
import './TokenizationViz.css';

export default function TokenizationViz({ tokens, showDetails = true, tokenizerMode = 'word', sourceText = '' }) {
  const [manualCutState, setManualCutState] = useState({ sourceText: '', cuts: new Set() });
  const [confirmedCutState, setConfirmedCutState] = useState(null);
  const vocabInfo = useMemo(() => {
    const vocab = VOCAB;
    const vocabToId = {};
    vocab.forEach((token, id) => { vocabToId[token] = id; });
    return { vocab, vocabToId };
  }, []);
  const tokenizerInfo = TOKENIZER_OPTIONS.find(option => option.id === tokenizerMode) || TOKENIZER_OPTIONS[0];

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
    if (sourceText) return sourceText;
    const textTokens = displayTokens.filter(t => !t.isSpecial);
    return detokenize(textTokens.map(t => t.id));
  }, [displayTokens, sourceText]);
  const studentSourceText = useMemo(() => originalText.replace(/\s+/g, ''), [originalText]);

  const manualChars = useMemo(() => Array.from(studentSourceText), [studentSourceText]);
  const manualCuts = useMemo(() => (
    manualCutState.sourceText === studentSourceText ? manualCutState.cuts : new Set()
  ), [manualCutState, studentSourceText]);

  const toggleManualCut = (index) => {
    setManualCutState((prev) => {
      const next = new Set(prev.sourceText === studentSourceText ? prev.cuts : []);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { sourceText: studentSourceText, cuts: next };
    });
  };

  const manualTokens = useMemo(() => {
    if (manualChars.length === 0) return [];

    const pieces = [];
    let current = manualChars[0];

    for (let i = 1; i < manualChars.length; i++) {
      if (manualCuts.has(i)) {
        pieces.push(current);
        current = manualChars[i];
      } else {
        current += manualChars[i];
      }
    }

    pieces.push(current);
    return pieces;
  }, [manualChars, manualCuts]);

  const manualTokenDetails = useMemo(() => manualTokens.map(piece => {
    const id = vocabInfo.vocabToId[piece] ?? vocabInfo.vocabToId['<UNK>'];
    return {
      token: piece,
      id,
      inVocab: vocabInfo.vocabToId[piece] !== undefined,
    };
  }), [manualTokens, vocabInfo]);

  const buildTokenDetails = (pieces) => pieces.map(piece => {
    const id = vocabInfo.vocabToId[piece] ?? vocabInfo.vocabToId['<UNK>'];
    return {
      token: piece,
      id,
      inVocab: vocabInfo.vocabToId[piece] !== undefined,
    };
  });

  const confirmManualCut = () => {
    setConfirmedCutState({ sourceText: studentSourceText, tokens: manualTokenDetails });
  };

  const autoCutAll = () => {
    const pieces = tokenizeToPieces(originalText, tokenizerMode);
    const compactPieces = pieces.map(piece => piece.replace(/\s+/g, '')).filter(Boolean);
    const shouldUseAutoPieces = compactPieces.join('') === studentSourceText;
    const autoPieces = shouldUseAutoPieces ? compactPieces : Array.from(studentSourceText);
    const cuts = new Set();
    let cursor = 0;

    autoPieces.slice(0, -1).forEach((piece) => {
      cursor += Array.from(piece).length;
      cuts.add(cursor);
    });

    setManualCutState({ sourceText: studentSourceText, cuts });
    setConfirmedCutState({ sourceText: studentSourceText, tokens: buildTokenDetails(autoPieces) });
  };

  const isConfirmedForCurrentText = confirmedCutState?.sourceText === studentSourceText;
  const confirmedTokenDetails = isConfirmedForCurrentText ? confirmedCutState.tokens : [];

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
        <div className="tokenization-badges">
          <span className="badge">{tokenizerInfo.name}</span>
          <span className="badge">{isConfirmedForCurrentText ? `${confirmedTokenDetails.length} tokens` : '待学生切分'}</span>
        </div>
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
            <code>{studentSourceText}</code>
          </div>
        </div>

        {/* 箭头 */}
        <div className="flow-arrow">
          <span>↓</span>
          <span className="arrow-label">分词</span>
        </div>

        {isConfirmedForCurrentText ? (
          <>
            {/* 阶段2：Token 列表 */}
            <div className="flow-stage">
              <div className="stage-label">
                <span className="stage-num">2</span>
                <span>你切出的 Tokens</span>
              </div>
              <div className="token-sequence">
                {confirmedTokenDetails.slice(0, 8).map((t, i) => (
                  <div key={i} className={`token-chip ${t.inVocab ? '' : 'unknown'}`}>
                    <span className="token-text">{t.token}</span>
                  </div>
                ))}
                {confirmedTokenDetails.length > 8 && (
                  <div className="token-chip more">
                    <span className="token-text">+{confirmedTokenDetails.length - 8}</span>
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
                {confirmedTokenDetails.slice(0, 8).map((t, i) => (
                  <div key={i} className={`id-chip ${t.inVocab ? '' : 'unknown'}`}>
                    <span className="id-value">{t.id}</span>
                  </div>
                ))}
                {confirmedTokenDetails.length > 8 && (
                  <div className="id-chip more">
                    <span className="id-value">...</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="tokenization-locked">
            先由学生手动切分并点击“确认切分”，再揭示 Tokens 和 ID 映射。
          </div>
        )}
      </div>

      {manualChars.length > 1 && (
        <div className="manual-tokenizer">
          <div className="manual-header">
            <span className="section-label">学生手动切分:</span>
            <button type="button" className="auto-cut" onClick={autoCutAll}>自动切分全部</button>
            <button type="button" onClick={() => setManualCutState({ sourceText: studentSourceText, cuts: new Set() })}>全部合并</button>
            <button type="button" onClick={() => setManualCutState({ sourceText: studentSourceText, cuts: new Set(manualChars.slice(1).map((_, i) => i + 1)) })}>逐字切分</button>
            <button
              type="button"
              className="confirm-cut"
              onClick={confirmManualCut}
            >
              确认切分
            </button>
          </div>
          <div className="manual-cut-row" aria-label="手动分词器">
            {manualChars.map((char, index) => (
              <React.Fragment key={`${char}-${index}`}>
                <span className="manual-char">{char}</span>
                {index < manualChars.length - 1 && (
                  <button
                    type="button"
                    className={`cut-toggle ${manualCuts.has(index + 1) ? 'active' : ''}`}
                    onClick={() => toggleManualCut(index + 1)}
                    title={manualCuts.has(index + 1) ? '点击合并两侧字符' : '点击在这里切开'}
                  >
                    {manualCuts.has(index + 1) ? '|' : '·'}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
          {isConfirmedForCurrentText ? (
            <div className="manual-result">
              {confirmedTokenDetails.map((item, index) => (
                <span key={`${item.token}-${index}`} className={`manual-token ${item.inVocab ? 'known' : 'unknown'}`}>
                  {item.token}
                  <small>ID {item.id}</small>
                </span>
              ))}
            </div>
          ) : (
            <div className="manual-pending">切分结果暂不显示。先让学生决定哪些字应该组成一个 token。</div>
          )}
          <p className="manual-note">
            绿色表示切出的 token 在词表里；红色会映射为 &lt;UNK&gt;。可先手动切分，也可用“自动切分全部”瞬间完成当前文本的切分。
          </p>
        </div>
      )}

      {/* 详细信息表格 */}
      {showDetails && isConfirmedForCurrentText && confirmedTokenDetails.length > 0 && (
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
              {confirmedTokenDetails.slice(0, 10).map((t, i) => (
                <tr key={i} className={t.inVocab ? '' : 'special-row'}>
                  <td className="pos-cell">{i}</td>
                  <td className="token-cell">
                    <code>{t.token}</code>
                  </td>
                  <td className="id-cell">{t.id}</td>
                  <td className="type-cell">
                    <span className={`type-badge ${t.inVocab ? 'word' : 'special'}`}>
                      {t.inVocab ? '词元' : '<UNK>'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {confirmedTokenDetails.length > 10 && (
            <div className="table-footer">
              ... 共 {confirmedTokenDetails.length} 个 tokens
            </div>
          )}
        </div>
      )}

      {/* 说明 */}
      <div className="token-explanation">
        <div className="explanation-item">
          <span className="explain-icon">💡</span>
          <span>{tokenizerInfo.description}</span>
        </div>
        <div className="explanation-item">
          <span className="explain-icon">🔢</span>
          <span>每个 Token 映射到一个唯一的数字 ID</span>
        </div>
      </div>
    </div>
  );
}
