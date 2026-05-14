import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * 3D 可视化组件 - 展示神经网络的决策边界
 * 
 * 特性：
 * - 3D 表面显示决策边界
 * - 鼠标拖拽旋转视角
 * - 实时更新网络参数变化
 */
export default function NN3DVisualizer({ model, points = [], isVisible = false }) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ x: -30, y: 30 }); // 初始视角
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [surfaceData, setSurfaceData] = useState([]);

  // 计算 3D 投影
  const project3D = useCallback((x, y, z, rotX, rotY) => {
    // 先绕 Y 轴旋转
    const y1 = y;
    const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
    const z1 = x * Math.sin(rotY) + z * Math.cos(rotY);

    // 再绕 X 轴旋转
    const z2 = z1 * Math.cos(rotX) - y1 * Math.sin(rotX);
    const y2 = y1 * Math.cos(rotX) + z1 * Math.sin(rotX);
    const x2 = x1;

    // 简单的透视投影
    const scale = 400 / (400 + z2);
    return {
      x: x2 * scale + 200,
      y: -y2 * scale + 200,
      z: z2,
      scale
    };
  }, []);

  // 计算决策边界表面数据
  useEffect(() => {
    if (!model || !isVisible) return;

    const resolution = 20;
    const data = [];
    
    for (let i = 0; i <= resolution; i++) {
      const row = [];
      for (let j = 0; j <= resolution; j++) {
        const x = i / resolution;
        const y = j / resolution;
        
        // 使用模型预测
        let prob = 0;
        if (model.W1 && model.b1 && model.W2 && model.b2) {
          // 简单的 MLP 前向传播
          // W1: [2, hiddenNodes] - 2 inputs x hiddenNodes neurons
          // W2: [hiddenNodes, 1] - hiddenNodes inputs x 1 output
          const input = [x, y];
          const hiddenNodes = model.hiddenNodes || 8;
          
          // 隐藏层计算
          const hidden = [];
          for (let j = 0; j < hiddenNodes; j++) {
            const z = input[0] * model.W1[0][j] + input[1] * model.W1[1][j] + model.b1[j];
            hidden.push(Math.max(0, z)); // ReLU
          }
          
          // 输出层计算
          let sum = model.b2[0] || 0;
          for (let j = 0; j < hiddenNodes; j++) {
            sum += hidden[j] * (model.W2[j] ? model.W2[j][0] : 0);
          }
          
          prob = 1 / (1 + Math.exp(-sum)); // Sigmoid
        }
        
        row.push({ x, y, z: (prob - 0.5) * 2 }); // z 范围 -1 到 1
      }
      data.push(row);
    }
    
    setSurfaceData(data);
  }, [model, isVisible]);

  // 绘制 3D 可视化
  useEffect(() => {
    if (!isVisible || !canvasRef.current || surfaceData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = 400;
    const height = 400;
    
    canvas.width = width;
    canvas.height = height;

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const rotX = rotation.x * Math.PI / 180;
    const rotY = rotation.y * Math.PI / 180;

    // 绘制网格背景
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const p1 = project3D(i / 10, 0, -0.5, rotX, rotY);
      const p2 = project3D(i / 10, 1, -0.5, rotX, rotY);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      
      const p3 = project3D(0, i / 10, -0.5, rotX, rotY);
      const p4 = project3D(1, i / 10, -0.5, rotX, rotY);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }

    // 绘制决策边界表面（使用扫描线算法）
    const resolution = surfaceData.length;
    
    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        const p1 = surfaceData[i][j];
        const p2 = surfaceData[i + 1][j];
        const p3 = surfaceData[i + 1][j + 1];
        const p4 = surfaceData[i][j + 1];

        const proj1 = project3D(p1.x, p1.y, p1.z, rotX, rotY);
        const proj2 = project3D(p2.x, p2.y, p2.z, rotX, rotY);
        const proj3 = project3D(p3.x, p3.y, p3.z, rotX, rotY);
        const proj4 = project3D(p4.x, p4.y, p4.z, rotX, rotY);

        // 计算颜色（基于高度）
        const avgZ = (p1.z + p2.z + p3.z + p4.z) / 4;
        const intensity = (avgZ + 1) / 2; // 0 到 1
        
        // 蓝色（类别0）到红色（类别1）
        let r, g, b;
        if (avgZ < 0) {
          // 蓝色区域
          r = Math.floor(50 + intensity * 50);
          g = Math.floor(100 + intensity * 100);
          b = Math.floor(200 + intensity * 55);
        } else {
          // 红色区域
          r = Math.floor(200 + intensity * 55);
          g = Math.floor(50 + intensity * 50);
          b = Math.floor(50 + intensity * 50);
        }

        // 计算面的平均深度用于排序（简单的Painter's算法）
        const avgDepth = (proj1.z + proj2.z + proj3.z + proj4.z) / 4;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.strokeStyle = `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)}, 0.5)`;
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        ctx.moveTo(proj1.x, proj1.y);
        ctx.lineTo(proj2.x, proj2.y);
        ctx.lineTo(proj3.x, proj3.y);
        ctx.lineTo(proj4.x, proj4.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 绘制数据点
    points.forEach(point => {
      const proj = project3D(point.x, point.y, 0.2, rotX, rotY);
      
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 8 / proj.scale, 0, Math.PI * 2);
      ctx.fillStyle = point.label === 0 ? '#3b82f6' : '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 绘制坐标轴标签
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px monospace';
    
    const xLabel = project3D(1.1, 0, 0, rotX, rotY);
    ctx.fillText('X', xLabel.x, xLabel.y);
    
    const yLabel = project3D(0, 1.1, 0, rotX, rotY);
    ctx.fillText('Y', yLabel.x, yLabel.y);
    
    const zLabel = project3D(0, 0, 1.3, rotX, rotY);
    ctx.fillText('P', zLabel.x, zLabel.y);

  }, [surfaceData, rotation, points, isVisible]);

  // 鼠标拖拽处理
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.5,
      y: prev.y + deltaX * 0.5
    }));
    
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 触摸事件处理
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - lastPos.x;
    const deltaY = e.touches[0].clientY - lastPos.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.5,
      y: prev.y + deltaX * 0.5
    }));
    
    setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn3D {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      
      <div style={{
        position: 'fixed',
        bottom: '100px',
        right: '24px',
        zIndex: 10004,
        background: 'rgba(20, 20, 40, 0.95)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '16px',
        padding: '16px',
        animation: 'fadeIn3D 0.3s ease-out',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        {/* 标题 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔮</span>
          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
            3D 决策边界
          </span>
        </div>
        
        {/* 画布 */}
        <div style={{
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}>
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              borderRadius: '8px',
              touchAction: 'none'
            }}
          />
          
          {/* 旋转提示 */}
          {!isDragging && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              👆 拖拽旋转视角
            </div>
          )}
        </div>
        
        {/* 图例 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>类别 0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f97316' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>类别 1</span>
          </div>
        </div>
        
        {/* 解释 */}
        <div style={{
          marginTop: '10px',
          fontSize: '0.7rem',
          color: 'rgba(255, 255, 255, 0.5)',
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          Z轴表示模型预测概率<br/>
          曲面弯曲程度代表网络"记忆"能力
        </div>
      </div>
    </>
  );
}
