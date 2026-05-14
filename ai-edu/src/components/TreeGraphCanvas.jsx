import React, { useState, useEffect, useRef } from 'react';

export default function TreeGraphCanvas({ points, testPoints = [], treeRegions, onAddPoint, onReportClick, currentAnimation, completedSplits = [] }) {
  const baseSize = 500;
  const [dimensions, setDimensions] = useState({ width: baseSize, height: baseSize });
  const containerRef = useRef(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const animationRef = useRef(null);

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(containerWidth, baseSize);
        setDimensions({ width: newWidth, height: newWidth });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width, height } = dimensions;

  // DEBUG: 监控 points 变化
  useEffect(() => {
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      console.log('[TreeGraphCanvas DEBUG] Points 数组更新，新添加的点:', {
        index: points.length - 1,
        logicalX: lastPoint.x,
        logicalY: lastPoint.y,
        label: lastPoint.label,
        renderCx: lastPoint.x * width,
        renderCy: height - lastPoint.y * height
      });
    }
  }, [points, width, height]);

  // 动画循环
  useEffect(() => {
    if (!currentAnimation || currentAnimation.phase === 'done') {
      setScanProgress(0);
      setCurrentCandidateIndex(0);
      return;
    }

    // 基于 requestAnimationFrame 的动画
    const startTime = performance.now();
    const duration = 1500; // 扫描持续 1.5 秒

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setScanProgress(progress);

      // 更新当前候选索引（用于显示"计算纯度得分"）
      if (currentAnimation.candidates && currentAnimation.candidates.length > 0) {
        const idx = Math.floor(progress * currentAnimation.candidates.length) % currentAnimation.candidates.length;
        setCurrentCandidateIndex(idx);
      }

      if (progress < 1 && currentAnimation.phase === 'scanning') {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentAnimation]);

  const handleSvgClick = (e) => {
    e.preventDefault();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    // 计算点击位置相对于SVG元素边界的坐标
    // 使用 offsetX/offsetY 如果可用（包含 border/padding），否则手动计算
    const hasOffsetXY = typeof e.offsetX === 'number' && typeof e.offsetY === 'number';
    let xSVG, ySVG;

    if (hasOffsetXY) {
      xSVG = e.offsetX;
      ySVG = e.offsetY;
    } else {
      xSVG = e.clientX - rect.left;
      ySVG = e.clientY - rect.top;
    }

    // DEBUG: 打印点击坐标信息
    console.log('[TreeGraphCanvas DEBUG] 点击坐标:', {
      clientX: e.clientX,
      clientY: e.clientY,
      rectLeft: rect.left,
      rectTop: rect.top,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      xSVG,
      ySVG,
      width,
      height
    });

    const logicX = xSVG / width;
    const logicY = (height - ySVG) / height;

    // DEBUG: 打印转换后的逻辑坐标
    console.log('[TreeGraphCanvas DEBUG] 转换后逻辑坐标:', { logicX, logicY });

    // Class 1 if Shift key is pressed, else 0
    const label = e.shiftKey ? 1 : 0;

    if(onAddPoint) {
      onAddPoint({ x: logicX, y: logicY, label });
    }
    if (onReportClick) {
      onReportClick();
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    // 使用 offsetX/offsetY 如果可用（包含 border/padding），否则手动计算
    const hasOffsetXY = typeof e.offsetX === 'number' && typeof e.offsetY === 'number';
    let xSVG, ySVG;

    if (hasOffsetXY) {
      xSVG = e.offsetX;
      ySVG = e.offsetY;
    } else {
      xSVG = e.clientX - rect.left;
      ySVG = e.clientY - rect.top;
    }

    const logicX = xSVG / width;
    const logicY = (height - ySVG) / height;

    if(onAddPoint) {
      onAddPoint({ x: logicX, y: logicY, label: 1 }); // Class 1
    }
    if (onReportClick) {
      onReportClick();
    }
  }

  return (
    <div ref={containerRef} id="dt-graph-canvas" className="glass-panel" style={{ width: '100%', maxWidth: baseSize, aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
      <svg 
        width={width} 
        height={height} 
        onClick={handleSvgClick}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        {/* 背景决断区块 (Regions) */}
        {treeRegions.map((r, i) => {
          // 将逻辑坐标系转换到 SVG 坐标 (y向反转)
          // r.minX, r.maxX是在0~1之间。y也是0~1之间
          // 但是SVG坐标系中，y轴是朝下的。
          // 所以 r.maxY 是顶部， r.minY 是底部
          const svgX = r.minX * width;
          const rectWidth = (r.maxX - r.minX) * width;
          
          const svgY = height - r.maxY * height;
          const rectHeight = (r.maxY - r.minY) * height;

          const fillClass0 = "rgba(249, 115, 22, 0.2)"; // 橙色透明
          const fillClass1 = "rgba(59, 130, 246, 0.2)"; // 蓝色透明

          return (
            <rect
              key={`region-${i}`}
              x={svgX}
              y={svgY}
              width={rectWidth}
              height={rectHeight}
              fill={r.label === 1 ? fillClass1 : fillClass0}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              style={{ transition: 'all 0.2s ease-in-out' }}
            />
          );
        })}

        {/* 背景网格 - 在色块上方为了更清晰展示 */}
        <g stroke="rgba(255,255,255,0.05)" strokeWidth={1}>
          {[...Array(11)].map((_, i) => (
            <React.Fragment key={i}>
              <line x1={0} y1={i * 50} x2={500} y2={i * 50} />
              <line x1={i * 50} y1={0} x2={i * 50} y2={500} />
            </React.Fragment>
          ))}
        </g>

        {/* 数据散点 */}
        {points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x * width}
            cy={height - p.y * height}
            r={7}
            fill={p.label === 1 ? "var(--accent-blue)" : "#f97316"}
            stroke="#1e293b"
            strokeWidth={2}
          />
        ))}

        {/* 推理测试散点 */}
        {testPoints.map((tp, i) => {
          // 查找该点落入的决策树预测色块
          let predLabel = 0; // 默认
          if (treeRegions.length > 0) {
            // 注意存在浮点边界问题，尽量使用包含或者寻找最近
            for (const r of treeRegions) {
              if (tp.x >= r.minX && tp.x <= r.maxX && tp.y >= r.minY && tp.y <= r.maxY) {
                predLabel = r.label;
                break;
              }
            }
          }

          return (
            <g key={`testpoint-${i}`}>
              <circle
                cx={tp.x * width}
                cy={height - tp.y * height}
                r={8}
                fill="transparent"
                stroke="white"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              <circle
                cx={tp.x * width}
                cy={height - tp.y * height}
                r={6}
                fill={predLabel === 1 ? "var(--accent-blue)" : "#f97316"}
                stroke="white"
                strokeWidth={1.5}
                style={{ filter: predLabel === 1 ? 'drop-shadow(0 0 6px var(--accent-blue))' : 'drop-shadow(0 0 6px #f97316)' }}
              />
            </g>
          );
        })}

        {/* 完成的切分线列表 - 累积显示 */}
        {completedSplits.map((split, idx) => {
          if (!split) return null;
          let x1, y1, x2, y2;
          if (split.feature === 'x') {
            x1 = split.val * width;
            y1 = 0;
            x2 = split.val * width;
            y2 = height;
          } else {
            x1 = 0;
            y1 = height - split.val * height;
            x2 = width;
            y2 = height - split.val * height;
          }
          return (
            <line
              key={`completed-${idx}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#22c55e"
              strokeWidth="2"
              opacity="0.5"
              style={{ filter: 'drop-shadow(0 0 4px #22c55e)' }}
            />
          );
        })}

        {/* 当前切分扫描动画 */}
        {currentAnimation && currentAnimation.phase === 'scanning' && currentAnimation.candidates && (
          <>
            {(() => {
              const candidates = currentAnimation.candidates;
              const currentIdx = currentCandidateIndex;
              const currentCandidate = candidates[currentIdx] || candidates[0];
              const bestSplit = currentAnimation.bestSplit;

              // 根据特征和进度计算切分线位置
              let scanX1, scanY1, scanX2, scanY2;
              let bestX1, bestY1, bestX2, bestY2;

              if (currentCandidate && currentCandidate.feature === 'x') {
                // 垂直切分线 - 根据当前扫描进度计算位置
                const sortedCandidates = candidates.filter(c => c.feature === 'x').sort((a, b) => a.val - b.val);
                const sortedBest = candidates.filter(c => c.feature === 'x').sort((a, b) => a.val - b.val);
                const bestIdx = sortedBest.findIndex(c => Math.abs(c.val - bestSplit.val) < 0.001);
                const idx = Math.min(currentIdx, sortedCandidates.length - 1);
                const scanVal = sortedCandidates[idx]?.val || 0.5;

                scanX1 = scanVal * width;
                scanY1 = 0;
                scanX2 = scanVal * width;
                scanY2 = height;

                if (bestSplit.feature === 'x' && sortedBest[bestIdx]) {
                  bestX1 = sortedBest[bestIdx].val * width;
                  bestY1 = 0;
                  bestX2 = sortedBest[bestIdx].val * width;
                  bestY2 = height;
                }
              } else {
                // 水平切分线
                const sortedCandidates = candidates.filter(c => c.feature === 'y').sort((a, b) => a.val - b.val);
                const sortedBest = candidates.filter(c => c.feature === 'y').sort((a, b) => a.val - b.val);
                const idx = Math.min(currentIdx, sortedCandidates.length - 1);
                const scanVal = sortedCandidates[idx]?.val || 0.5;

                scanX1 = 0;
                scanY1 = height - scanVal * height;
                scanX2 = width;
                scanY2 = height - scanVal * height;

                if (bestSplit.feature === 'y' && sortedBest[0]) {
                  bestX1 = 0;
                  bestY1 = height - sortedBest[0].val * height;
                  bestX2 = width;
                  bestY2 = height - sortedBest[0].val * height;
                }
              }

              return (
                <>
                  {/* 扫描切分线 */}
                  <line
                    x1={scanX1}
                    y1={scanY1}
                    x2={scanX2}
                    y2={scanY2}
                    stroke="#fbbf24"
                    strokeWidth="3"
                    strokeDasharray="8 4"
                    opacity="0.9"
                    style={{
                      filter: 'drop-shadow(0 0 8px #fbbf24)'
                    }}
                  >
                    <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.3s" repeatCount="indefinite" />
                  </line>

                  {/* 最佳切分线（半透明提示） */}
                  {bestSplit && bestSplit.feature === currentCandidate?.feature && (
                    <line
                      x1={bestX1}
                      y1={bestY1}
                      x2={bestX2}
                      y2={bestY2}
                      stroke="#22c55e"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.4"
                    />
                  )}

                  {/* 当前 Gini 分数显示 */}
                  <g transform={`translate(${scanX1 + 15}, ${scanY1 + 20})`}>
                    <rect
                      x="-8"
                      y="-14"
                      width="70"
                      height="28"
                      rx="6"
                      fill="rgba(0,0,0,0.85)"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />
                    <text
                      x="27"
                      y="5"
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      Gini: {currentCandidate?.gini?.toFixed(3) || '0.000'}
                    </text>
                  </g>

                  {/* "计算中" 指示器 */}
                  <g transform={`translate(${width - 90}, 15)`}>
                    <rect
                      x="0"
                      y="0"
                      width="80"
                      height="28"
                      rx="6"
                      fill="rgba(99, 102, 241, 0.9)"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="1"
                    />
                    <text
                      x="40"
                      y="18"
                      textAnchor="middle"
                      fill="white"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      🔍 搜索中...
                    </text>
                  </g>
                </>
              );
            })()}
          </>
        )}

        {/* 切分确定动画 */}
        {currentAnimation && currentAnimation.phase === 'finalizing' && (
          <>
            {(() => {
              const bestSplit = currentAnimation.bestSplit;
              if (!bestSplit) return null;

              let x1, y1, x2, y2;
              if (bestSplit.feature === 'x') {
                x1 = bestSplit.val * width;
                y1 = 0;
                x2 = bestSplit.val * width;
                y2 = height;
              } else {
                x1 = 0;
                y1 = height - bestSplit.val * height;
                x2 = width;
                y2 = height - bestSplit.val * height;
              }

              return (
                <>
                  {/* 最终切分线（实线，带发光） */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#22c55e"
                    strokeWidth="4"
                    style={{
                      filter: 'drop-shadow(0 0 12px #22c55e)',
                      transition: 'all 0.3s ease-out'
                    }}
                  >
                    {/* 出现动画 */}
                    <animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze" />
                  </line>

                  {/* "咔哒" 提示 */}
                  <g transform={`translate(${x1 + 15}, ${y1 + 20})`}>
                    <rect
                      x="-8"
                      y="-14"
                      width="90"
                      height="28"
                      rx="6"
                      fill="rgba(34, 197, 94, 0.95)"
                      stroke="#22c55e"
                      strokeWidth="2"
                    />
                    <text
                      x="37"
                      y="5"
                      textAnchor="middle"
                      fill="white"
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ✓ 最优切分!
                    </text>
                  </g>
                </>
              );
            })()}
          </>
        )}

        {/* 切分完成状态 - 保留切分线 */}
        {currentAnimation && currentAnimation.phase === 'done' && (
          <>
            {(() => {
              const bestSplit = currentAnimation.bestSplit;
              if (!bestSplit) return null;

              let x1, y1, x2, y2;
              if (bestSplit.feature === 'x') {
                x1 = bestSplit.val * width;
                y1 = 0;
                x2 = bestSplit.val * width;
                y2 = height;
              } else {
                x1 = 0;
                y1 = height - bestSplit.val * height;
                x2 = width;
                y2 = height - bestSplit.val * height;
              }

              return (
                <>
                  {/* 保留的切分线（稍细一些，不带动画） */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#22c55e"
                    strokeWidth="2"
                    opacity="0.7"
                    style={{
                      filter: 'drop-shadow(0 0 6px #22c55e)'
                    }}
                  />
                </>
              );
            })()}
          </>
        )}

      </svg>
      {points.length === 0 && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          color: 'var(--text-secondary)', 
          pointerEvents: 'none',
          fontSize: '1.2rem',
          textAlign: 'center',
          lineHeight: '1.8'
        }}>
          💡 点击左键添加 <span style={{color: '#f97316', fontWeight: 'bold'}}>橙色组(0)</span> <br/> 
          鼠标右键添加 <span style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>蓝色组(1)</span>
        </div>
      )}
    </div>
  );
}
