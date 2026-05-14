import React, { useRef, useEffect, useState } from 'react';

/**
 * 故障诊断拟合曲线可视化组件
 * 采用与其他模块一致的 SVG + 响应式设计
 */
export default function FaultGraphCanvas({
  curvePoints = [],      // 拟合曲线上的点 [{x, y}]
  dataset = [],          // 数据集 [{x, y}]（用户点击添加的点）
  statusType = 'normal', // 'normal' | 'warning' | 'error'
  faultType = null,
  onAddPoint = null      // 点击添加数据点的回调
}) {
  const baseWidth = 500;
  const baseHeight = 300;
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: baseWidth, height: baseHeight });

  // 点击标记状态
  const [clickMarker, setClickMarker] = useState(null);

  // 响应式尺寸
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(containerWidth, baseWidth);
        setDimensions({ width: newWidth, height: baseHeight });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 清除点击标记
  useEffect(() => {
    if (clickMarker) {
      const timer = setTimeout(() => setClickMarker(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [clickMarker]);

  const { width, height } = dimensions;

  // 计算坐标范围
  const allX = dataset.map(d => d.x);
  const allY = dataset.map(d => d.y);

  // 如果有曲线点，也要考虑曲线范围
  if (curvePoints.length > 0) {
    allX.push(...curvePoints.map(p => p.x));
    allY.push(...curvePoints.map(p => p.y));
  }

  // 默认范围
  let minX = Math.min(...allX, 0);
  let maxX = Math.max(...allX, 10);
  let minY = Math.min(...allY, 0);
  let maxY = Math.max(...allY, 30);

  // 添加边距
  const xMargin = (maxX - minX) * 0.12 || 1;
  const yMargin = (maxY - minY) * 0.12 || 2;
  minX -= xMargin;
  maxX += xMargin;
  minY -= yMargin;
  maxY += yMargin;

  // 坐标映射函数
  const mapX = (x) => ((x - minX) / (maxX - minX)) * width;
  const mapY = (y) => height - ((y - minY) / (maxY - minY)) * height;

  // 反向映射：从 SVG 坐标到逻辑坐标
  const unmapX = (svgX) => (svgX / width) * (maxX - minX) + minX;
  const unmapY = (svgY) => ((height - svgY) / height) * (maxY - minY) + minY;

  // 处理点击事件
  const handleSvgClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hasOffsetXY = typeof e.offsetX === 'number' && typeof e.offsetY === 'number';
    let xSVG, ySVG;

    if (hasOffsetXY) {
      xSVG = e.offsetX;
      ySVG = e.offsetY;
    } else {
      xSVG = e.clientX - rect.left;
      ySVG = e.clientY - rect.top;
    }

    // 转换到逻辑坐标
    const logicX = unmapX(xSVG);
    const logicY = unmapY(ySVG);

    // 添加点击标记
    setClickMarker({ x: xSVG, y: ySVG });

    // 调用回调添加数据点
    if (onAddPoint) {
      onAddPoint({ x: logicX, y: logicY });
    }
  };

  // 曲线颜色
  const lineColor = statusType === 'error' ? '#ff4d4f' :
                    statusType === 'warning' ? '#ff9800' : '#4dabf7';

  // 生成曲线路径
  const generateCurvePath = () => {
    if (curvePoints.length === 0) return '';

    const validPoints = curvePoints.filter(p =>
      !Number.isNaN(p.x) && !Number.isNaN(p.y) &&
      p.x >= minX && p.x <= maxX &&
      p.y >= minY - 50 && p.y <= maxY + 50
    );

    if (validPoints.length === 0) return '';

    return validPoints.map((pt, i) => {
      const px = mapX(pt.x);
      const py = mapY(pt.y);
      return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
    }).join(' ');
  };

  // 生成面积填充路径（用于渐变效果）
  const generateAreaPath = () => {
    if (curvePoints.length === 0) return '';

    const validPoints = curvePoints.filter(p =>
      !Number.isNaN(p.x) && !Number.isNaN(p.y) &&
      p.x >= minX && p.x <= maxX &&
      p.y >= minY - 50 && p.y <= maxY + 50
    );

    if (validPoints.length === 0) return '';

    const linePath = validPoints.map((pt, i) => {
      const px = mapX(pt.x);
      const py = mapY(pt.y);
      return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
    }).join(' ');

    // 闭合到基线
    const lastPt = validPoints[validPoints.length - 1];
    const firstPt = validPoints[0];
    return `${linePath} L ${mapX(lastPt.x)} ${height} L ${mapX(firstPt.x)} ${height} Z`;
  };

  // 判断是否为离群点
  const isOutlier = (d) => Math.abs(d.x) > 50 || Math.abs(d.y) > 50;

  return (
    <div
      ref={containerRef}
      id="fault-graph-canvas"
      className="glass-panel"
      style={{
        width: '100%',
        maxWidth: baseWidth,
        aspectRatio: `${baseWidth}/${baseHeight}`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <svg
        width={width}
        height={height}
        onClick={handleSvgClick}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {/* 背景渐变 */}
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(30,30,50,1)" />
            <stop offset="100%" stopColor="rgba(20,20,35,1)" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(77,171,247,0.8)" />
            <stop offset="100%" stopColor={lineColor} />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* 背景 */}
        <rect x={0} y={0} width={width} height={height} fill="url(#bgGradient)" rx="4" />

        {/* 网格线 */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth={1}>
          {/* 水平线 */}
          {[...Array(11)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={(i / 10) * height}
              x2={width}
              y2={(i / 10) * height}
            />
          ))}
          {/* 垂直线 */}
          {[...Array(11)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={(i / 10) * width}
              y1={0}
              x2={(i / 10) * width}
              y2={height}
            />
          ))}
        </g>

        {/* 错误状态遮罩 */}
        {statusType === 'error' && (
          <>
            <rect
              x={0} y={0} width={width} height={height}
              fill="rgba(255,0,0,0.15)"
              rx="4"
            />
            <text
              x={width / 2}
              y={height / 2 - 10}
              textAnchor="middle"
              fill="#ff4d4f"
              fontSize="14"
              fontWeight="bold"
            >
              ⚠️ 训练崩溃
            </text>
            <text
              x={width / 2}
              y={height / 2 + 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize="12"
            >
              数值溢出 (NaN/Inf)
            </text>
          </>
        )}

        {/* 面积填充 */}
        {statusType !== 'error' && curvePoints.length > 0 && (
          <path
            d={generateAreaPath()}
            fill="url(#areaGradient)"
          />
        )}

        {/* 拟合曲线 */}
        {statusType !== 'error' && curvePoints.length > 0 && (
          <path
            d={generateCurvePath()}
            fill="none"
            stroke={lineColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* 数据点 */}
        {dataset.map((d, i) => {
          const px = mapX(d.x);
          const py = mapY(d.y);
          const outlier = isOutlier(d);

          return (
            <g key={`point-${i}`}>
              <circle
                cx={px}
                cy={py}
                r={outlier ? 7 : 5}
                fill={outlier ? '#ff4d4f' : '#4dabf7'}
                stroke="#fff"
                strokeWidth={outlier ? 2 : 1.5}
                style={{ filter: outlier ? 'drop-shadow(0 0 6px #ff4d4f)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
              />
              {/* 离群点标签 */}
              {outlier && (
                <>
                  <line
                    x1={px + 5}
                    y1={py - 5}
                    x2={px + 40}
                    y2={py - 25}
                    stroke="rgba(255,77,79,0.5)"
                    strokeWidth={1}
                  />
                  <text
                    x={px + 42}
                    y={py - 22}
                    fill="#ff4d4f"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    离群点
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* 用户添加的点（特殊样式） */}
        {dataset.map((d, i) => {
          const px = mapX(d.x);
          const py = mapY(d.y);

          return (
            <g key={`user-point-${i}`}>
              {/* 外圈光晕 */}
              <circle
                cx={px}
                cy={py}
                r={12}
                fill="none"
                stroke="rgba(156,39,176,0.4)"
                strokeWidth={2}
              >
                <animate
                  attributeName="r"
                  from="8"
                  to="16"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.6"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* 中心点 - 紫色 */}
              <circle
                cx={px}
                cy={py}
                r={6}
                fill="#9c27b0"
                stroke="#e1bee7"
                strokeWidth={2}
                style={{ filter: 'drop-shadow(0 0 8px #9c27b0)' }}
              />
              {/* 坐标标签 */}
              <text
                x={px + 10}
                y={py - 8}
                fill="#e1bee7"
                fontSize="9"
                fontWeight="bold"
              >
                ({d.x.toFixed(1)}, {d.y.toFixed(1)})
              </text>
            </g>
          );
        })}

        {/* 点击标记 */}
        {clickMarker && (
          <g>
            {/* 脉冲环 */}
            <circle
              cx={clickMarker.x}
              cy={clickMarker.y}
              r={20}
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={2}
            >
              <animate
                attributeName="r"
                from="10"
                to="25"
                dur="0.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.8"
                to="0"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </circle>
            {/* 中心点 */}
            <circle
              cx={clickMarker.x}
              cy={clickMarker.y}
              r={4}
              fill="white"
              stroke="#000"
              strokeWidth={1}
            />
            {/* 十字线 */}
            <line
              x1={clickMarker.x - 15}
              y1={clickMarker.y}
              x2={clickMarker.x + 15}
              y2={clickMarker.y}
              stroke="white"
              strokeWidth={1.5}
              opacity={0.8}
            />
            <line
              x1={clickMarker.x}
              y1={clickMarker.y - 15}
              x2={clickMarker.x}
              y2={clickMarker.y + 15}
              stroke="white"
              strokeWidth={1.5}
              opacity={0.8}
            />
          </g>
        )}
      </svg>

      {/* 空状态提示 */}
      {curvePoints.length === 0 && dataset.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.9rem',
          pointerEvents: 'none'
        }}>
          📊 开始训练以查看拟合曲线
        </div>
      )}

      {/* 故障类型标签 */}
      {faultType && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          background: statusType === 'error' ? 'rgba(255,77,79,0.9)' :
                      statusType === 'warning' ? 'rgba(255,152,0,0.9)' :
                      'rgba(77,171,247,0.9)',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          {faultType === 'gradient-explosion' && '⚡ 梯度爆炸'}
          {faultType === 'gradient-vanishing' && '📉 梯度消失'}
          {faultType === 'overfitting' && '🎯 过拟合'}
          {faultType === 'data-poisoning' && '☠️ 数据污染'}
          {faultType === 'local-minima' && '🌀 局部最小值'}
          {faultType === 'bad-initialization' && '⚙️ 不良初始化'}
        </div>
      )}
    </div>
  );
}