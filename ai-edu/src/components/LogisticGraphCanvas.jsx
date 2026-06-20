import React, { useEffect, useState, useRef } from 'react';

export default function LogisticGraphCanvas({ points, testPoints = [], w1, w2, b, onAddPoint, onReportClick }) {
  const baseSize = 500;
  const [dimensions, setDimensions] = useState({ width: baseSize, height: baseSize });
  const containerRef = useRef(null);

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
      console.log('[LogisticGraphCanvas DEBUG] Points 数组更新，新添加的点:', {
        index: points.length - 1,
        logicalX: lastPoint.x,
        logicalY: lastPoint.y,
        label: lastPoint.label,
        renderCx: lastPoint.x * width,
        renderCy: height - lastPoint.y * height
      });
    }
  }, [points, width, height]);

  const handleSvgClick = (e) => {
    e.preventDefault();
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const xSVG = Math.max(0, Math.min(width, e.clientX - rect.left));
    const ySVG = Math.max(0, Math.min(height, e.clientY - rect.top));

    // DEBUG: 打印点击坐标信息
    console.log('[LogisticGraphCanvas DEBUG] 点击坐标:', {
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
    console.log('[LogisticGraphCanvas DEBUG] 转换后逻辑坐标:', { logicX, logicY });

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

    const xSVG = Math.max(0, Math.min(width, e.clientX - rect.left));
    const ySVG = Math.max(0, Math.min(height, e.clientY - rect.top));

    const logicX = xSVG / width;
    const logicY = (height - ySVG) / height;
    if(onAddPoint) {
      onAddPoint({ x: logicX, y: logicY, label: 1 });
    }
    if (onReportClick) {
      onReportClick();
    }
  }

  // 跨越画布边界绘制直线，防止出现截断
  let svgX1, svgY1, svgX2, svgY2;
  if (Math.abs(w2) > Math.abs(w1)) {
     svgX1 = -width;
     let logicY_Xmin1 = -(w1 * -1 + b) / w2;
     svgY1 = height - logicY_Xmin1 * height;
     
     svgX2 = 2 * width;
     let logicY_Xmax2 = -(w1 * 2 + b) / w2;
     svgY2 = height - logicY_Xmax2 * height;
  } else {
     // 若w1主导(接近垂直线)，基于Y来求X
     let logicY1 = -1;
     svgY1 = height - logicY1 * height;
     svgX1 = (-(w2 * logicY1 + b) / w1) * width;

     let logicY2 = 2;
     svgY2 = height - logicY2 * height;
     svgX2 = (-(w2 * logicY2 + b) / w1) * width;
  }

  return (
    <div ref={containerRef} id="lg-graph-canvas" className="glass-panel" style={{ width: '100%', maxWidth: baseSize, aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
      <svg 
        width={width} 
        height={height} 
        onClick={handleSvgClick}
        onContextMenu={handleContextMenu}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        {/* 背景网格 */}
        <g stroke="rgba(255,255,255,0.05)" strokeWidth={1}>
          {[...Array(11)].map((_, i) => (
            <React.Fragment key={i}>
              <line x1={0} y1={i * 50} x2={500} y2={i * 50} />
              <line x1={i * 50} y1={0} x2={i * 50} y2={500} />
            </React.Fragment>
          ))}
        </g>
        
        {/* 决策边界直线 */}
        <line
          x1={svgX1}
          y1={svgY1}
          x2={svgX2}
          y2={svgY2}
          stroke="var(--accent-purple)"
          strokeWidth={4}
          style={{ transition: 'all 0.1s linear' }}
        />

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

        {/* 测试点/推理点 */}
        {testPoints.map((tp, i) => {
          // 决策公式 w1 * X + w2 * Y + b = z
          const z = w1 * tp.x + w2 * tp.y + b;
          // sigmoid(z) 实际上如果 z > 0 则归为 class 1，否则 class 0
          const predLabel = z > 0 ? 1 : 0;
          
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
      </svg>
      {points.length === 0 && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          color: 'var(--text-secondary)', 
          pointerEvents: 'none',
          fontSize: '1rem',
          textAlign: 'center',
          lineHeight: '1.8',
          opacity: 0.8
        }}>
          💡 点击左键添加 <span style={{color: '#f97316', fontWeight: 'bold'}}>类别 0 (橙色)</span> <br/> 
          鼠标右键添加 <span style={{color: 'var(--accent-blue)', fontWeight: 'bold'}}>类别 1 (蓝色)</span>
        </div>
      )}
    </div>
  );
}
