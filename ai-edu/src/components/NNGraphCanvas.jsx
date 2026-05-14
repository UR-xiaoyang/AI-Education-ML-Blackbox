import React, { useRef, useEffect, useState } from 'react';
import { nnPredict } from '../utils/nnEngine';
import { usePedagogyStore } from '../store/pedagogyStore';

export default function NNGraphCanvas({ points, testPoints = [], model, onAddPoint }) {
  const baseWidth = 620;
  const baseHeight = 560;
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: baseWidth, height: baseHeight });
  const useRelu = usePedagogyStore(state => state.useRelu);

  // DEBUG: 点击位置标记
  const [lastClickPos, setLastClickPos] = useState(null);
  const [clickMarkerVisible, setClickMarkerVisible] = useState(false);

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const aspectRatio = baseHeight / baseWidth;
        const newWidth = Math.min(containerWidth, baseWidth);
        const newHeight = newWidth * aspectRatio;
        setDimensions({ width: newWidth, height: newHeight });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const { width, height } = dimensions;

  // 背景热力图Canvas

  // 清除点击标记
  useEffect(() => {
    if (clickMarkerVisible) {
      const timer = setTimeout(() => setClickMarkerVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [clickMarkerVisible]);

  // 当模型权重更新时，重新绘制底层 Canvas 热力概率场
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    // 为了性能，不需要 500x500 次计算。采用 50x50 的网格 (即步长为10px) 即可得到很好的平滑渐现效果
    const step = 10;
    const cols = Math.floor(width / step);
    const rows = Math.floor(height / step);

    // 性能优化: 构建ImageData直接填色
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 计算每个网格中心的逻辑坐标
        const cx = (c + 0.5) * step;
        const cy = (r + 0.5) * step;

        const logicX = cx / width;
        const logicY = (height - cy) / height;

        // 神经网络推断概率
        const py = nnPredict(logicX, logicY, model, useRelu);

        // 概率向颜色映射: p=0 -> Orange (249,115,22), p=1 -> Blue (59,130,246)
        // 使用插值来实现热力渐变
        const R = Math.round(249 * (1 - py) + 59 * py);
        const G = Math.round(115 * (1 - py) + 130 * py);
        const B = Math.round(22 * (1 - py) + 246 * py);

        // 为了视觉科技感，我们在分类边界附近降低对比度
        // 通过暗化底色，模拟"能量场"效果。背景底色假设为暗黑 (15,23,42)
        const alpha = Math.abs(py - 0.5) * 2; // [0,1]，在0.5边界时最暗
        const bgR = 15, bgG = 23, bgB = 42;

        const fR = bgR + (R - bgR) * alpha * 0.7; // 不完全覆盖，保持一定灰度
        const fG = bgG + (G - bgG) * alpha * 0.7;
        const fB = bgB + (B - bgB) * alpha * 0.7;

        // 填充 10x10 的像素块
        for (let yOffset = 0; yOffset < step; yOffset++) {
          for (let xOffset = 0; xOffset < step; xOffset++) {
            const px = c * step + xOffset;
            const py_px = r * step + yOffset;
            const idx = (py_px * width + px) * 4;
            data[idx] = fR;
            data[idx + 1] = fG;
            data[idx + 2] = fB;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [model, useRelu, width, height]);

  const handleSvgClick = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    // 使用 offsetX/offsetY 如果可用（包含 border/padding 和 CSS transform），否则手动计算
    const hasOffsetXY = typeof e.offsetX === 'number' && typeof e.offsetY === 'number';
    let xSVG, ySVG;

    if (hasOffsetXY) {
      xSVG = e.offsetX;
      ySVG = e.offsetY;
    } else {
      xSVG = e.clientX - rect.left;
      ySVG = e.clientY - rect.top;
    }

    // DEBUG: 设置点击位置标记
    setLastClickPos({ x: xSVG, y: ySVG });
    setClickMarkerVisible(true);

    const logicX = xSVG / width;
    const logicY = (height - ySVG) / height;

    const label = e.shiftKey ? 1 : 0;
    if(onAddPoint) onAddPoint({ x: logicX, y: logicY, label });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    // 使用 offsetX/offsetY 如果可用，否则手动计算
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
    if(onAddPoint) onAddPoint({ x: logicX, y: logicY, label: 1 });
  }

  return (
    <div ref={containerRef} id="nn-graph-canvas" className="glass-panel" style={{ width: '100%', maxWidth: baseWidth, aspectRatio: `${baseWidth}/${baseHeight}`, position: 'relative', overflow: 'hidden' }}>

      {/* 底层画布：热力场 */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      />

      {/* 顶层矢量图：网格交互与散点 */}
      <svg
        width={width}
        height={height}
        onClick={handleSvgClick}
        onContextMenu={handleContextMenu}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, cursor: 'crosshair' }}
      >
        <g stroke="rgba(255,255,255,0.08)" strokeWidth={1}>
          {[...Array(Math.floor(width / 50) + 1)].map((_, i) => (
            <React.Fragment key={i}>
              <line x1={0} y1={i * 50} x2={width} y2={i * 50} />
              <line x1={i * 50} y1={0} x2={i * 50} y2={height} />
            </React.Fragment>
          ))}
        </g>

        {points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x * width}
            cy={height - p.y * height}
            r={7}
            fill={p.label === 1 ? "var(--accent-blue)" : "#f97316"}
            stroke="#fff"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'}}
          />
        ))}

        {/* DEBUG: 点击位置标记 - 十字准星 */}
        {clickMarkerVisible && lastClickPos && (
          <g>
            {/* 外圈 - 脉动效果 */}
            <circle
              cx={lastClickPos.x}
              cy={lastClickPos.y}
              r={20}
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth={2}
            >
              <animate attributeName="r" from="10" to="25" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.8" to="0" dur="0.8s" repeatCount="indefinite" />
            </circle>
            {/* 中心点 - 白色 */}
            <circle
              cx={lastClickPos.x}
              cy={lastClickPos.y}
              r={4}
              fill="white"
              stroke="#000"
              strokeWidth={1}
              style={{ filter: 'drop-shadow(0 0 4px white)' }}
            />
            {/* 十字线 */}
            <line x1={lastClickPos.x - 12} y1={lastClickPos.y} x2={lastClickPos.x + 12} y2={lastClickPos.y} stroke="white" strokeWidth={1.5} opacity={0.8} />
            <line x1={lastClickPos.x} y1={lastClickPos.y - 12} x2={lastClickPos.x} y2={lastClickPos.y + 12} stroke="white" strokeWidth={1.5} opacity={0.8} />
            {/* 坐标文字 */}
            <text
              x={lastClickPos.x + 15}
              y={lastClickPos.y - 10}
              fill="white"
              fontSize="11"
              fontFamily="monospace"
              style={{ textShadow: '0 0 4px black, 0 0 4px black' }}
            >
              ({lastClickPos.x.toFixed(1)}, {lastClickPos.y.toFixed(1)})
            </text>
          </g>
        )}

        {/* 推理测试散点 */}
        {testPoints.map((tp, i) => {
          // 神经网络实时推断热力概率
          const py = nnPredict(tp.x, tp.y, model, useRelu);
          const predLabel = py > 0.5 ? 1 : 0;

          // 呈现出随心灵改变颜色的呼吸灯效果
          return (
            <g key={`testpoint-${i}`}>
              <circle
                cx={tp.x * width}
                cy={height - tp.y * height}
                r={8}
                fill="transparent"
                stroke="white"
                strokeWidth={1.5}
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
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 2, pointerEvents: 'none', textAlign: 'center', lineHeight: '1.8', fontSize: '1.1rem'}}>
          💡 体验深度学习空间扭转魔法 <br/>
          <span style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem'}}>可以使用操作台一键生成极难数据集</span>
        </div>
      )}
    </div>
  );
}
