import React, { useMemo, useState, useEffect, useRef } from 'react';
import { computeLoss } from '../utils/mlEngine';

export default function ParameterSpaceViz({
  parameterPath = [],
  currentW,
  currentB,
  points = [],
  learningRate = 0.1
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(360);

  // 动态计算参数范围（基于轨迹数据）
  const paramRange = useMemo(() => {
    if (parameterPath.length === 0 && currentW == null) {
      return { wMin: -2, wMax: 3, bMin: -1, bMax: 2 };
    }

    let wMin = currentW ?? 0;
    let wMax = currentW ?? 1;
    let bMin = currentB ?? 0;
    let bMax = currentB ?? 1;

    parameterPath.forEach(pt => {
      wMin = Math.min(wMin, pt.w);
      wMax = Math.max(wMax, pt.w);
      bMin = Math.min(bMin, pt.b);
      bMax = Math.max(bMax, pt.b);
    });

    // 如果只有一个点或初始点，添加默认范围
    if (wMax === wMin) { wMin -= 1; wMax += 1; }
    if (bMax === bMin) { bMin -= 0.5; bMax += 0.5; }

    // 添加 padding
    const wPad = (wMax - wMin) * 0.3 || 1;
    const bPad = (bMax - bMin) * 0.3 || 0.5;

    return {
      wMin: wMin - wPad,
      wMax: wMax + wPad,
      bMin: bMin - bPad,
      bMax: bMax + bPad
    };
  }, [parameterPath, currentW, currentB]);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const width = containerWidth;
  const height = Math.min(200, width * 0.5); // 保持合理的比例

  // 直接使用 paramRange 的属性
  const { wMin, wMax, bMin, bMax } = paramRange;

  const mapWtoX = (w) => ((w - wMin) / (wMax - wMin)) * width;
  const mapBtoY = (b) => height - ((b - bMin) / (bMax - bMin)) * height;

  // 计算等高线数据
  const { contourData, minLoss, maxLoss } = useMemo(() => {
    if (points.length === 0) return { contourData: [], minLoss: 0, maxLoss: 1 };

    const resolution = 30;
    const dw = (wMax - wMin) / resolution;
    const db = (bMax - bMin) / resolution;
    const lossGrid = [];

    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const w = wMin + i * dw;
        const b = bMin + j * db;
        const loss = computeLoss(points, w, b);
        lossGrid.push({ w, b, loss });
      }
    }

    const losses = lossGrid.map(g => g.loss);
    return {
      contourData: lossGrid,
      minLoss: Math.min(...losses),
      maxLoss: Math.max(...losses)
    };
  }, [points, wMin, wMax, bMin, bMax]);

  // 热力图颜色映射
  const getHeatColor = (loss) => {
    if (points.length === 0) return 'rgba(255,255,255,0.03)';
    const n = (loss - minLoss) / (maxLoss - minLoss || 1);
    if (n < 0.25) { const t = n / 0.25; return `rgba(0,${Math.floor(50+t*100)},200,0.2)`; }
    if (n < 0.5)  { const t = (n-0.25)/0.25; return `rgba(0,200,${Math.floor(200-t*100)},0.2)`; }
    if (n < 0.75) { const t = (n-0.5)/0.25;  return `rgba(${Math.floor(t*200)},200,0,0.2)`; }
    const t = (n-0.75)/0.25;
    return `rgba(200,${Math.floor(200-t*200)},0,0.25)`;
  };

  // 等高线背景
  const renderContour = () => {
    if (points.length === 0) return null;
    const resolution = 30;
    const cellW = width / resolution;
    const cellH = height / resolution;
    return contourData.map((g, i) => (
      <rect
        key={i}
        x={mapWtoX(g.w) - cellW/2}
        y={mapBtoY(g.b) - cellH/2}
        width={cellW}
        height={cellH}
        fill={getHeatColor(g.loss)}
      />
    ));
  };

  // 绘制轨迹线（在足迹下方）
  const renderTrail = () => {
    if (parameterPath.length < 2) return null;

    // 限制显示最近的轨迹点（最多显示30个）
    const displayPath = parameterPath.slice(-30);
    const d = displayPath.map((pt, i) => {
      const x = mapWtoX(pt.w);
      const y = mapBtoY(pt.b);
      return `${i===0?'M':'L'} ${x} ${y}`;
    }).join(' ');

    return (
      <path d={d} fill="none"
        stroke="#10b981" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        opacity="0.7"
        style={{ filter: 'drop-shadow(0 0 6px #10b981)' }} />
    );
  };

  // 绘制所有足迹（轨迹上的每个点都留下足迹）
  const renderFootprints = () => {
    if (parameterPath.length === 0) return null;

    // 限制显示最近的足迹（最多显示15个）
    const displayPath = parameterPath.slice(-15);

    return displayPath.map((pt, i) => {
      const actualIndex = parameterPath.length - displayPath.length + i;
      const x = mapWtoX(pt.w);
      const y = mapBtoY(pt.b);
      const isFirst = actualIndex === 0;
      const isLast = actualIndex === parameterPath.length - 1;
      const isCurrent = actualIndex === parameterPath.length - 1;

      // 跳过超出可视范围的点
      if (x < -10 || x > width + 10 || y < -10 || y > height + 10) return null;

      const r = isFirst ? 6 : isLast ? 7 : 5;

      return (
        <g key={i}>
          {/* 足迹外发光 */}
          <circle cx={x} cy={y} r={r + 3}
            fill="none"
            stroke={isFirst ? 'rgba(59,130,246,0.4)' : 'rgba(16,185,129,0.3)'}
            strokeWidth={2} />

          {/* 足迹主体 */}
          <circle cx={x} cy={y} r={r}
            fill={isFirst ? '#3b82f6' : isLast ? '#10b981' : '#10b981'}
            stroke="#fff"
            strokeWidth={1.5} />

          {/* 步骤编号（只在关键点上显示） */}
          {(isFirst || isLast) && (
            <text x={x} y={y + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill="#fff" fontSize="8px"
              fontWeight="bold" style={{ pointerEvents: 'none', textShadow: '0 0 3px rgba(0,0,0,0.9)' }}>
              {actualIndex + 1}
            </text>
          )}
        </g>
      );
    });
  };

  // 绘制当前位置（最上层）
  const renderCurrentPosition = () => {
    if (currentW == null || currentB == null) return null;

    const x = mapWtoX(currentW);
    const y = mapBtoY(currentB);

    // 检查是否在可视范围内
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) {
      return (
        <g>
          {/* 显示一个指示器在边缘 */}
          <circle cx={Math.max(10, Math.min(width - 10, x))} cy={Math.max(10, Math.min(height - 10, y))} r="8"
            fill="#fbbf24" stroke="#fff" strokeWidth="2"
            style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }} />
          <text x={Math.max(20, Math.min(width - 20, x))} y={Math.max(20, Math.min(height - 20, y)) - 12}
            fill="#fbbf24" fontSize="9px" fontWeight="bold"
            style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))' }}>
            w:{currentW.toFixed(2)} b:{currentB.toFixed(2)}
          </text>
        </g>
      );
    }

    return (
      <g>
        <circle cx={x} cy={y} r="18"
          fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.5">
          <animate attributeName="r" from="12" to="24" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={x} cy={y} r="8"
          fill="#fbbf24" stroke="#fff" strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 5px #fbbf24)' }} />
        <text x={x + 12} y={y - 8}
          fill="#fbbf24" fontSize="9px" fontWeight="bold"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))' }}>
          w={currentW.toFixed(2)}
        </text>
        <text x={x + 12} y={y + 2}
          fill="#fbbf24" fontSize="9px" fontWeight="bold"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))' }}>
          b={currentB.toFixed(2)}
        </text>
      </g>
    );
  };

  if (points.length === 0) {
    return (
      <div ref={containerRef} className="glass-panel" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: height + 60, padding: '10px'
      }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '4px', opacity: 0.4 }}>🗺️</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>参数空间可视化</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: '2px' }}>添加数据后显示轨迹</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="glass-panel" style={{
      position: 'relative', overflow: 'hidden', width: '100%', boxSizing: 'border-box',
      paddingBottom: '4px'
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '6px 10px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>
          梯度下降轨迹
        </div>
        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>
          步数: {parameterPath.length} | w:[{wMin.toFixed(1)},{wMax.toFixed(1)}] b:[{bMin.toFixed(1)},{bMax.toFixed(1)}]
        </div>
      </div>

      {/* 可视化区域 */}
      <div style={{ position: 'relative', background: '#0a0a0a', padding: '4px' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* 1. 等高线热力图背景 */}
          {renderContour()}
          {/* 2. 轨迹线 */}
          {renderTrail()}
          {/* 3. 足迹（每个训练步骤留下一个） */}
          {renderFootprints()}
          {/* 4. 当前位置（金色脉冲） */}
          {renderCurrentPosition()}
        </svg>

        {/* w 坐标轴刻度 */}
        <div style={{
          position: 'absolute', bottom: 6, left: 30, right: 4,
          display: 'flex', justifyContent: 'space-between',
          fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)'
        }}>
          <span>{wMin.toFixed(1)}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>w</span>
          <span>{wMax.toFixed(1)}</span>
        </div>
        {/* b 坐标轴刻度 */}
        <div style={{
          position: 'absolute', top: 20, bottom: 15, right: 4,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.5rem', color: 'rgba(255,255,255,0.25)'
        }}>
          <span>{bMax.toFixed(1)}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>b</span>
          <span>{bMin.toFixed(1)}</span>
        </div>
      </div>

      {/* 图例 */}
      <div style={{
        padding: '4px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', border: '1px solid #fff' }} />起点
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', border: '1px solid #fff' }} />轨迹
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', border: '1px solid #fff' }} />当前位置
        </span>
      </div>
    </div>
  );
}