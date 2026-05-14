import React, { useState, useRef } from 'react';

const LABEL_COLORS = {
  0: '#f97316', // orange for label 0
  1: '#3b82f6', // blue for label 1
};

/**
 * Reusable DatasetPanel component.
 *
 * Props:
 *   type: 'regression' | 'logistic' | 'tree'
 *   points: Array<{ x, y, label? }>
 *   onAddPoint: (point) => void
 *   onRemovePoint: (index) => void
 *   onImportCSV: (points) => void          // optional; if provided, shows import section
 *   onGeneratePreset: (type) => void       // optional; if provided, shows preset buttons
 *   onClearAll: () => void
 */
export default function DatasetPanel({
  type = 'regression',
  points = [],
  onAddPoint,
  onRemovePoint,
  onImportCSV,
  onGeneratePreset,
  onClearAll,
}) {
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputLabel, setInputLabel] = useState('0');
  const [inputError, setInputError] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [activeSection, setActiveSection] = useState(null); // 'input' | 'import' | 'list'
  const fileInputRef = useRef();

  // ---- Stats ----
  const label0Count = points.filter((p) => p.label === 0).length;
  const label1Count = points.filter((p) => p.label === 1).length;
  const xValues = points.map((p) => p.x);
  const yValues = points.map((p) => p.y);
  const xRange = xValues.length
    ? [Math.min(...xValues), Math.max(...xValues)]
    : null;
  const yRange = yValues.length
    ? [Math.min(...yValues), Math.max(...yValues)]
    : null;

  // Show up to 8 most recent points
  const recentPoints = [...points].reverse().slice(0, 8);

  // ---- Manual Input ----
  const handleAddManual = () => {
    setInputError('');
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    if (isNaN(x) || isNaN(y)) {
      setInputError('x 和 y 必须是有效的数字');
      return;
    }
    const point = { x, y };
    if (type !== 'regression') {
      const label = parseInt(inputLabel, 10);
      if (isNaN(label) || (label !== 0 && label !== 1)) {
        setInputError('标签必须是 0 或 1');
        return;
      }
      point.label = label;
    }
    onAddPoint(point);
    setInputX('');
    setInputY('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddManual();
  };

  // ---- CSV Import ----
  const handleImport = () => {
    setImportError('');
    const text = importText.trim();
    if (!text) {
      setImportError('请输入 CSV 数据');
      return;
    }
    const lines = text.split('\n').filter((l) => l.trim());
    const newPoints = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) {
        setImportError(`第 ${i + 1} 行格式错误，应为 "x,y" 或 "x,y,label"`);
        return;
      }
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (isNaN(x) || isNaN(y)) {
        setImportError(`第 ${i + 1} 行：x 和 y 必须是数字`);
        return;
      }
      const point = { x, y };
      if (type !== 'regression') {
        if (parts.length < 3) {
          setImportError(`第 ${i + 1} 行缺少标签（应为 0 或 1）`);
          return;
        }
        const label = parseInt(parts[2], 10);
        if (isNaN(label) || (label !== 0 && label !== 1)) {
          setImportError(`第 ${i + 1} 行标签必须是 0 或 1`);
          return;
        }
        point.label = label;
      }
      newPoints.push(point);
    }
    if (onImportCSV) {
      onImportCSV(newPoints);
    }
    setImportText('');
    setImportError('');
    setActiveSection(null);
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target.result);
    };
    reader.readAsText(file);
  };

  // ---- Point label badge ----
  const labelBadge = (label) => {
    const color = LABEL_COLORS[label] || '#fff';
    return (
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
    );
  };

  const sectionBtn = (id, label) => (
    <button
      className="btn"
      onClick={() => setActiveSection(activeSection === id ? null : id)}
      style={{
        flex: 1,
        fontSize: '0.75rem',
        padding: '6px 4px',
        background: activeSection === id ? 'rgba(255,255,255,0.1)' : '',
        opacity: 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="glass-panel nn-dataset-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 200, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>数据集</h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            共 {points.length} 个样本
          </p>
        </div>
        {onClearAll && (
          <button
            className="btn"
            onClick={onClearAll}
            style={{ fontSize: '0.75rem', padding: '5px 10px', opacity: 0.7 }}
          >
            清空
          </button>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: type === 'regression' ? '1fr 1fr' : '1fr 1fr 1fr',
          gap: '6px',
        }}
      >
        {type === 'regression' ? (
          <>
            <StatChip label="X 范围" value={xRange ? `${xRange[0].toFixed(2)} – ${xRange[1].toFixed(2)}` : '—'} />
            <StatChip label="Y 范围" value={yRange ? `${yRange[0].toFixed(2)} – ${yRange[1].toFixed(2)}` : '—'} />
          </>
        ) : (
          <>
            <StatChip label="类别 0" value={label0Count} color={LABEL_COLORS[0]} />
            <StatChip label="类别 1" value={label1Count} color={LABEL_COLORS[1]} />
            <StatChip label="总计" value={points.length} />
          </>
        )}
      </div>

      {/* Preset generation buttons (optional) */}
      {onGeneratePreset && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>快速生成</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {type === 'logistic' ? (
              <>
                <button className="btn" onClick={() => onGeneratePreset('circle')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>同心圆</button>
                <button className="btn" onClick={() => onGeneratePreset('xor')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>异或</button>
                <button className="btn" onClick={() => onGeneratePreset('moons')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>双月牙</button>
                <button className="btn" onClick={() => onGeneratePreset('spiral')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>螺旋</button>
              </>
            ) : type === 'tree' ? (
              <>
                <button className="btn" onClick={() => onGeneratePreset('circle')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>同心圆</button>
                <button className="btn" onClick={() => onGeneratePreset('xor')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>异或</button>
                <button className="btn" onClick={() => onGeneratePreset('moons')} style={{ flex: 1, fontSize: '0.75rem', padding: '5px 4px' }}>双月牙</button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Toggle buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {sectionBtn('input', '📝 输入')}
        {onImportCSV && sectionBtn('import', '📄 导入')}
        {sectionBtn('list', '📋 列表')}
      </div>

      {/* Input Section */}
      {activeSection === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>X</label>
              <input
                type="number"
                value={inputX}
                onChange={(e) => setInputX(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0.5"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Y</label>
              <input
                type="number"
                value={inputY}
                onChange={(e) => setInputY(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0.5"
                style={inputStyle}
              />
            </div>
            {type !== 'regression' && (
              <div style={{ width: 60 }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>标签</label>
                <select
                  value={inputLabel}
                  onChange={(e) => setInputLabel(e.target.value)}
                  style={{ ...inputStyle, padding: '5px 4px', fontSize: '0.8rem' }}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                </select>
              </div>
            )}
          </div>
          {inputError && (
            <div style={{ color: '#f87171', fontSize: '0.75rem' }}>{inputError}</div>
          )}
          <button className="btn btn-primary" onClick={handleAddManual} style={{ fontSize: '0.82rem' }}>
            添加点
          </button>
        </div>
      )}

      {/* Import Section */}
      {activeSection === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {type === 'regression'
              ? '格式：每行一个点，x,y（例：0.5,0.3）'
              : '格式：每行一个点，x,y,label（例：0.5,0.3,0）'}
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={
              type === 'regression'
                ? '0.1,0.2\n0.3,0.4\n0.5,0.1'
                : '0.1,0.2,0\n0.3,0.4,1\n0.5,0.1,0'
            }
            style={{
              width: '100%',
              minHeight: '80px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              padding: '8px',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          {importError && (
            <div style={{ color: '#f87171', fontSize: '0.75rem' }}>{importError}</div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn" onClick={handleImport} style={{ flex: 1, fontSize: '0.82rem' }}>
              解析导入
            </button>
            <label className="btn" style={{ flex: 1, fontSize: '0.82rem', textAlign: 'center', cursor: 'pointer' }}>
              选择文件
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {importText && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              已加载 {importText.split('\n').filter((l) => l.trim()).length} 行
            </div>
          )}
        </div>
      )}

      {/* Point List */}
      {activeSection === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {points.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
              还没有数据，点击画布或使用上方工具添加
            </div>
          ) : (
            recentPoints.map((point, i) => {
              const realIndex = points.length - 1 - i;
              return (
                <div
                  key={`${point.x}-${point.y}-${realIndex}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    fontSize: '0.78rem',
                  }}
                >
                  {type !== 'regression' && labelBadge(point.label)}
                  <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                    ({point.x.toFixed(3)}, {point.y.toFixed(3)})
                  </span>
                  {type !== 'regression' && (
                    <span style={{ color: LABEL_COLORS[point.label] || '#fff', marginLeft: '2px' }}>
                      [{point.label}]
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {onRemovePoint && (
                    <button
                      className="btn"
                      onClick={() => onRemovePoint(realIndex)}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        opacity: 0.6,
                        minWidth: 0,
                      }}
                      title="删除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
          {points.length > 8 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              ... 共 {points.length} 个点
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '8px',
        padding: '6px 8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: color || '#fff', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};
