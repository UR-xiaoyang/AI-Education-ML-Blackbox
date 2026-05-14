import React, { useMemo, useRef, useEffect } from 'react';
import './LLMLossChart.css';

export default function LLMLossChart({ lossHistory = [], width = 300, height = 150 }) {
  const canvasRef = useRef(null);

  // 计算损失统计数据
  const stats = useMemo(() => {
    if (lossHistory.length === 0) {
      return { min: 0, max: 5, current: 0, avg: 0 };
    }

    const recentLosses = lossHistory.slice(-100);
    const min = Math.min(...recentLosses);
    const max = Math.max(...recentLosses);
    const current = lossHistory[lossHistory.length - 1];
    const avg = recentLosses.reduce((a, b) => a + b, 0) / recentLosses.length;

    return { min, max, current, avg };
  }, [lossHistory]);

  // 绘制损失曲线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // 设置 canvas 尺寸
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    if (lossHistory.length < 2) {
      // 绘制空状态
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('开始训练以观察损失曲线', width / 2, height / 2);
      return;
    }

    // 绘制区域
    const padding = { top: 10, right: 10, bottom: 25, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 计算范围
    let minLoss = Math.min(...lossHistory);
    let maxLoss = Math.max(...lossHistory);
    const range = maxLoss - minLoss || 1;
    minLoss = Math.max(0, minLoss - range * 0.1);
    maxLoss = maxLoss + range * 0.1;

    // 绘制网格线
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y 轴标签
      const value = maxLoss - ((maxLoss - minLoss) * i) / 4;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(2), padding.left - 5, y + 3);
    }

    // 绘制损失曲线
    const segmentWidth = chartWidth / Math.max(lossHistory.length - 1, 1);

    // 填充区域
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    lossHistory.forEach((loss, i) => {
      const x = padding.left + i * segmentWidth;
      const y = padding.top + chartHeight - ((loss - minLoss) / (maxLoss - minLoss)) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + (lossHistory.length - 1) * segmentWidth, padding.top + chartHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(244, 114, 182, 0.4)');
    gradient.addColorStop(1, 'rgba(244, 114, 182, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制线条
    ctx.beginPath();
    lossHistory.forEach((loss, i) => {
      const x = padding.left + i * segmentWidth;
      const y = padding.top + chartHeight - ((loss - minLoss) / (maxLoss - minLoss)) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制当前点
    const lastX = padding.left + (lossHistory.length - 1) * segmentWidth;
    const lastY = padding.top + chartHeight - ((stats.current - minLoss) / (maxLoss - minLoss)) * chartHeight;

    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f472b6';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // X 轴标签
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('训练步数', width / 2, height - 5);

  }, [lossHistory, width, height, stats]);

  return (
    <div className="glass-panel llm-loss-chart">
      <div className="panel-header">
        <h3>训练损失</h3>
        <span className="badge">Cross-Entropy</span>
      </div>

      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>

      <div className="loss-stats">
        <div className="stat-item">
          <span className="stat-label">当前</span>
          <span className="stat-value current">{stats.current.toFixed(4)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">平均</span>
          <span className="stat-value">{stats.avg.toFixed(4)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">最低</span>
          <span className="stat-value best">{stats.min.toFixed(4)}</span>
        </div>
      </div>

      <div className="chart-explanation">
        <p>损失越低，模型预测下一个词的能力越强。理想情况下，损失应该随着训练逐渐下降。</p>
      </div>
    </div>
  );
}
