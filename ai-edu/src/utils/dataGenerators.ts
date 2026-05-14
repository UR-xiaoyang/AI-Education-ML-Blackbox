export interface DataPoint {
  x: number;
  y: number;
  label?: number;
}

/**
 * 模块一：投毒数据生成器
 * 专门为“实验A（学习率陷阱）”生成极易导致梯度爆炸的数据集
 */
export const generatePoisonedData = (): DataPoint[] => {
  const points: DataPoint[] = [];
  const N = 50;
  
  // 1. 特征量级放大 (Scale Up) 且不进行归一化
  // X 取值范围很大 (0 到 100)
  for (let i = 0; i < N; i++) {
    const x = Math.random() * 100;
    
    // 2. 异方差噪声
    // 基础线性关系： y = 5x + 10，并加上极大的随机噪声
    const noise = (Math.random() - 0.5) * 200; // -100 到 100 的噪声
    const y = 5 * x + 10 + noise;
    
    points.push({ x, y });
  }
  
  // 3. 极端离群点 (Outlier)
  // 强行插入 2 个极端的离群点，作为诱发大梯度的核心引信
  points.push({ x: 90, y: -500 });
  points.push({ x: 10, y: 1000 });
  
  return points;
};
