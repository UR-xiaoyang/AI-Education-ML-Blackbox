import React, { useEffect, useState, useRef } from 'react';

export default function GraphCanvas({ points, testPoints = [], w, b, onAddPoint, onReportClick }) {
  const baseSize = 500;
  const [dimensions, setDimensions] = useState({ width: baseSize, height: baseSize });
  const containerRef = useRef(null);
  const [newestPointIndex, setNewestPointIndex] = useState(-1); // 用于动画反馈
  const [showHint, setShowHint] = useState(true); // 提示是否显示
  const [clickRipple, setClickRipple] = useState(null); // 点击涟漪效果
  const [pointCount, setPointCount] = useState(0); // 用于触发重新渲染

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

  // 监控 points 变化，触发动画反馈
  useEffect(() => {
    if (points.length > pointCount) {
      setNewestPointIndex(points.length - 1);
      setShowHint(false);
      setPointCount(points.length);
      const timer = setTimeout(() => setNewestPointIndex(-1), 600);
      return () => clearTimeout(timer);
    } else if (points.length === 0) {
      setShowHint(true);
      setPointCount(0);
    }
  }, [points.length, pointCount]);

  const handleSvgClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const hasOffsetXY = typeof e.offsetX === 'number' && typeof e.offsetY === 'number';
    let xSVG, ySVG;

    if (hasOffsetXY) {
      xSVG = e.offsetX;
      ySVG = e.offsetY;
    } else {
      xSVG = e.clientX - rect.left;
      ySVG = e.clientY - rect.top;
    }

    // 涟漪效果
    setClickRipple({ x: xSVG, y: ySVG, key: Date.now() });
    setTimeout(() => setClickRipple(null), 500);

    const logicX = xSVG / width;
    const logicY = (height - ySVG) / height;

    if(onAddPoint) {
      onAddPoint({ x: logicX, y: logicY });
    }
    if (onReportClick) {
      onReportClick();
    }
  };

  // 将逻辑线段映射到 SVG 坐标
  const logicYAt0 = w * 0 + b;
  const svgYAt0 = height - (logicYAt0 * height);
  
  const logicYAt1 = w * 1 + b;
  const svgYAt1 = height - (logicYAt1 * height);

  return (
    <div ref={containerRef} id="lr-graph-canvas" className="glass-panel" style={{ width: '100%', maxWidth: baseSize, aspectRatio: '1', position: 'relative', overflow: 'hidden' }}>
      <svg 
        width={width} 
        height={height} 
        onClick={handleSvgClick}
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
        
        {/* 绘制误差虚线 (从点到模型直线的垂直线) */}
        {points.map((p, i) => {
          const modelYLogic = w * p.x + b;
          return (
            <line
              key={`loss-${i}`}
              x1={p.x * width}
              y1={height - p.y * height}
              x2={p.x * width}
              y2={height - modelYLogic * height}
              stroke="var(--accent-red)"
              strokeWidth={2}
              strokeDasharray="5 5"
              opacity={0.8}
            />
          );
        })}

        {/* 模型拟合直线 */}
        <line
          x1={0}
          y1={svgYAt0}
          x2={width}
          y2={svgYAt1}
          stroke="var(--accent-green)"
          strokeWidth={4}
          style={{ transition: 'all 0.1s linear' }}
        />

        {/* 数据散点 - 带动画 */}
        {points.map((p, i) => {
          const isNew = i === newestPointIndex;
          return (
            <g key={`point-${i}`}>
              {/* 发光效果 (仅新点) */}
              {isNew && (
                <circle
                  cx={p.x * width}
                  cy={height - p.y * height}
                  r={18}
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth={3}
                  opacity={0.6}
                  style={{ animation: 'glowPulse 0.6s ease-out forwards' }}
                />
              )}
              <circle
                cx={p.x * width}
                cy={height - p.y * height}
                r={isNew ? 0 : 7}
                fill="var(--accent-blue)"
                stroke="#1e293b"
                strokeWidth={2}
                style={isNew ? { animation: 'pointAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}}
              />
            </g>
          );
        })}

        {/* 推理测试点 */}
        {testPoints.map((tp, i) => {
          const modelYLogic = w * tp.x + b;
          const pxX = tp.x * width;
          const pxY = height - tp.y * height;
          const pxPredY = height - modelYLogic * height;
          
          return (
            <g key={`testpoint-${i}`}>
              {/* 真身点 (空心) */}
              <circle
                cx={pxX}
                cy={pxY}
                r={6}
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeDasharray="2 2"
              />
              {/* 预测射线 */}
              <line
                x1={pxX}
                y1={pxY}
                x2={pxX}
                y2={pxPredY}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              {/* 模型推断出的投射点 */}
              <circle
                cx={pxX}
                cy={pxPredY}
                r={5}
                fill="var(--accent-purple)"
                style={{ filter: 'drop-shadow(0 0 6px var(--accent-purple))' }}
              />
              <text 
                x={pxX + 10} 
                y={pxPredY - 10} 
                fill="white" 
                fontSize="12px" 
                style={{ pointerEvents: 'none', textShadow: '0px 0px 4px #000' }}
              >
                Pred: {modelYLogic.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 点击涟漪效果 */}
      {clickRipple && (
        <div
          key={clickRipple.key}
          style={{
            position: 'absolute',
            left: clickRipple.x,
            top: clickRipple.y,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.6)',
            transform: 'translate(-50%, -50%)',
            animation: 'ripple 0.5s ease-out forwards',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 增强的交互提示 */}
      {points.length === 0 && showHint && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          animation: 'fadeInUp 0.5s ease-out'
        }}>
          <div style={{ fontSize: '2.5rem', animation: 'bounce 1.5s ease-in-out infinite' }}>👆</div>
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))',
            padding: '16px 24px',
            borderRadius: '16px',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: 'var(--accent-blue)',
            fontWeight: 500,
            fontSize: '1.05rem',
            textShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.2)'
          }}>
            点击这里添加数据点
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            opacity: 0.8
          }}>
            试着在画布上随意点击
          </div>
        </div>
      )}

      {/* 添加点成功后的提示 (临时) */}
      {points.length > 0 && newestPointIndex >= 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34, 197, 94, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: 500,
          animation: 'fadeInUp 0.3s ease-out, fadeOut 0.3s ease-in 1s forwards',
          boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)'
        }}>
          ✨ 点已添加！继续添加更多点吧
        </div>
      )}

      <style>{`
        @keyframes pointAppear {
          0% { r: 0; opacity: 0; }
          50% { r: 12; }
          100% { r: 7; opacity: 1; }
        }
        @keyframes glowPulse {
          0% { r: 10; opacity: 0.8; }
          100% { r: 25; opacity: 0; }
        }
        @keyframes ripple {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          100% { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
