/**
 * 数据点类型定义
 */
export interface DataPoint {
  x: number;
  y: number;
}

/**
 * 带标签的数据点类型（用于分类问题）
 */
export interface LabeledDataPoint extends DataPoint {
  label: number;
}

/**
 * 生成一组带有适度噪音的线性分布数据（X 范围 0-10）
 */
export function generateStandardData(): DataPoint[] {
  const data: DataPoint[] = [];
  for (let i = 0; i <= 10; i += 0.5) {
    const noise = (Math.random() - 0.5) * 2; // -1 to 1
    data.push({
      x: i,
      y: 2 * i + 5 + noise,
    });
  }
  return data;
}

/**
 * 生成带有一个极端离群点的数据
 * 大部分数据在常规范围内，但在数组末尾强行插入一个极端的离群点。
 * 这个点是专门用来诱发线性模型崩溃或迫使复杂模型严重扭曲的。
 */
export function generateOutlierData(): DataPoint[] {
  const data = generateStandardData();
  // 插入极端离群点，例如 {x: 90, y: -500}
  data.push({
    x: 90,
    y: -500,
  });
  return data;
}

/**
 * 生成带噪音的线性分布数据
 * 比标准数据有更大的噪音范围，用于模拟真实场景中的噪声数据
 */
export function generateNoisyData(): DataPoint[] {
  const data: DataPoint[] = [];
  for (let i = 0; i <= 10; i += 0.3) {
    // 增加噪音范围到 -3 到 3
    const noise = (Math.random() - 0.5) * 6;
    data.push({
      x: i,
      y: 2 * i + 5 + noise,
    });
  }
  return data;
}

/**
 * 生成带噪音和多个离群点的数据
 * 用于模拟被污染的数据集
 */
export function generatePoisonedData(): DataPoint[] {
  const data: DataPoint[] = [];
  // 正常数据点
  for (let i = 0; i <= 10; i += 0.5) {
    const noise = (Math.random() - 0.5) * 2;
    data.push({
      x: i,
      y: 2 * i + 5 + noise,
    });
  }
  // 注入多个极端离群点
  data.push({ x: 10, y: -5 });
  data.push({ x: -10, y: 15 });
  data.push({ x: 20, y: -100 });
  data.push({ x: -15, y: 80 });
  return data;
}

/**
 * 生成稀疏数据集
 * 只有少量数据点，用于测试模型在数据不足时的表现
 */
export function generateSparseData(): DataPoint[] {
  const data: DataPoint[] = [];
  // 只有 5 个数据点
  const xValues = [1, 3, 5, 7, 9];
  for (const x of xValues) {
    const noise = (Math.random() - 0.5) * 1;
    data.push({
      x,
      y: 2 * x + 5 + noise,
    });
  }
  return data;
}

/**
 * 生成分类问题用的标准数据集（两个类别）
 * 类别0在左下区域，类别1在右上区域
 */
export function generateClassificationData(): LabeledDataPoint[] {
  const data: LabeledDataPoint[] = [];
  const N = 30;

  // 类别 0：左下区域
  for (let i = 0; i < N; i += 1) {
    data.push({
      x: Math.random() * 0.4,
      y: Math.random() * 0.4,
      label: 0
    });
  }

  // 类别 1：右上区域
  for (let i = 0; i < N; i += 1) {
    data.push({
      x: 0.6 + Math.random() * 0.4,
      y: 0.6 + Math.random() * 0.4,
      label: 1
    });
  }

  return data;
}

/**
 * 生成分类问题用的 XOR 数据集
 * 左下和右上为类别0，右上和左下为类别1
 */
export function generateXORData(): LabeledDataPoint[] {
  const data: LabeledDataPoint[] = [];
  const N = 25;

  // 左下象限：类别 0
  for (let i = 0; i < N / 2; i += 1) {
    data.push({
      x: Math.random() * 0.35,
      y: Math.random() * 0.35,
      label: 0
    });
  }

  // 右上象限：类别 0
  for (let i = 0; i < N / 2; i += 1) {
    data.push({
      x: 0.65 + Math.random() * 0.35,
      y: 0.65 + Math.random() * 0.35,
      label: 0
    });
  }

  // 左上象限：类别 1
  for (let i = 0; i < N / 2; i += 1) {
    data.push({
      x: Math.random() * 0.35,
      y: 0.65 + Math.random() * 0.35,
      label: 1
    });
  }

  // 右下象限：类别 1
  for (let i = 0; i < N / 2; i += 1) {
    data.push({
      x: 0.65 + Math.random() * 0.35,
      y: Math.random() * 0.35,
      label: 1
    });
  }

  return data;
}

/**
 * 生成分类问题用的带噪音数据集
 */
export function generateNoisyClassificationData(): LabeledDataPoint[] {
  const data: LabeledDataPoint[] = [];
  const N = 30;

  // 类别 0：左下区域（带噪音）
  for (let i = 0; i < N; i += 1) {
    data.push({
      x: Math.random() * 0.45 - 0.05,
      y: Math.random() * 0.45 - 0.05,
      label: 0
    });
  }

  // 类别 1：右上区域（带噪音）
  for (let i = 0; i < N; i += 1) {
    data.push({
      x: 0.55 + Math.random() * 0.45,
      y: 0.55 + Math.random() * 0.45,
      label: 1
    });
  }

  return data;
}

/**
 * 生成分类问题用的同心圆数据集
 */
export function generateCircleData(): LabeledDataPoint[] {
  const data: LabeledDataPoint[] = [];
  const N = 40;

  // 内圈：类别 0
  for (let i = 0; i < N; i += 1) {
    const r = Math.random() * 0.2;
    const theta = Math.random() * 2 * Math.PI;
    data.push({
      x: 0.5 + r * Math.cos(theta),
      y: 0.5 + r * Math.sin(theta),
      label: 0
    });
  }

  // 外圈：类别 1
  for (let i = 0; i < N * 1.5; i += 1) {
    const r = 0.4 + Math.random() * 0.05;
    const theta = Math.random() * 2 * Math.PI;
    data.push({
      x: 0.5 + r * Math.cos(theta),
      y: 0.5 + r * Math.sin(theta),
      label: 1
    });
  }

  return data;
}

/**
 * 生成分类问题用的双月牙数据集
 */
export function generateMoonsData(): LabeledDataPoint[] {
  const data: LabeledDataPoint[] = [];
  const N = 40;

  // 上半月牙：类别 0
  for (let i = 0; i < N; i += 1) {
    const t = Math.PI * (i / N);
    data.push({
      x: 0.5 + 0.3 * Math.cos(t) + (Math.random() - 0.5) * 0.05,
      y: 0.5 + 0.3 * Math.sin(t) + (Math.random() - 0.5) * 0.05,
      label: 0
    });
  }

  // 下半月牙：类别 1
  for (let i = 0; i < N; i += 1) {
    const t = Math.PI * (i / N);
    data.push({
      x: 0.5 - 0.3 * Math.cos(t) + (Math.random() - 0.5) * 0.05,
      y: 0.5 - 0.3 * Math.sin(t) - 0.25 + (Math.random() - 0.5) * 0.05,
      label: 1
    });
  }

  return data;
}

/**
 * 生成分类问题用的带污染数据集
 * 在同心圆数据基础上添加极端离群点
 */
export function generatePoisonedClassificationData(): LabeledDataPoint[] {
  const data = generateCircleData();
  // 添加极端离群点
  data.push({ x: 10, y: -5, label: 0 });
  data.push({ x: -10, y: 15, label: 1 });
  return data;
}

/**
 * 生成极易导致梯度爆炸的数据
 * 特点：极端的离群点，y 值远超正常范围
 */
export function generateExtremeGradientExplosionData(): DataPoint[] {
  const data: DataPoint[] = [];
  // 大部分正常数据
  for (let i = 0; i <= 10; i += 0.5) {
    const noise = (Math.random() - 0.5) * 2;
    data.push({
      x: i,
      y: 2 * i + 5 + noise,
    });
  }
  // 添加极端离群点 - 这些会导致梯度爆炸
  data.push({ x: 50, y: -1000 });   // 左上极端
  data.push({ x: -20, y: 2000 });   // 右下极端
  data.push({ x: 100, y: 5000 });   // 右上极端
  data.push({ x: -50, y: -3000 });  // 左下极端
  return data;
}

/**
 * 生成极易导致梯度消失的数据
 * 特点：数据变化极其微小，y 值几乎相同
 */
export function generateExtremeGradientVanishData(): DataPoint[] {
  const data: DataPoint[] = [];
  // 数据点 y 值几乎相同，只有微小变化
  const baseY = 10;
  for (let i = 0; i <= 100; i += 1) {
    const noise = (Math.random() - 0.5) * 0.0001; // 极小的噪音
    data.push({
      x: i,
      y: baseY + noise,
    });
  }
  return data;
}

/**
 * 生成用于过拟合的数据
 * 特点：训练集完美拟合，验证集差异极大
 */
export function generateExtremeOverfittingData(): DataPoint[] {
  const data: DataPoint[] = [];
  // 训练数据：完美的线性关系 + 小噪音
  for (let i = 0; i <= 10; i += 0.2) {
    const noise = (Math.random() - 0.5) * 0.1; // 极小噪音
    data.push({
      x: i,
      y: 2 * i + 5 + noise,
    });
  }
  // 添加一些"陷阱"点 - 靠近边界的位置会严重影响泛化
  data.push({ x: 0.5, y: 0.5 });    // 打破模式
  data.push({ x: 0.7, y: 0.3 });     // 打破模式
  data.push({ x: 9.3, y: 19.5 });    // 打破模式
  data.push({ x: 9.5, y: 19.7 });    // 打破模式
  return data;
}

/**
 * 数据集类型枚举
 */
export type DatasetType =
  | 'standard'       // 标准线性数据
  | 'outlier'        // 带离群点的数据
  | 'noisy'          // 带噪音的数据
  | 'poisoned'       // 被污染的数据（多个离群点）
  | 'sparse'         // 稀疏数据
  | 'classification' // 基础分类数据
  | 'xor'            // XOR 数据集
  | 'circle'         // 同心圆数据集
  | 'moons'          // 双月牙数据集
  | 'poisoned-classification' // 污染的分类数据
  | 'extreme-gradient-explosion'  // 极易梯度爆炸的数据
  | 'extreme-gradient-vanish'    // 极易梯度消失的数据
  | 'extreme-overfitting';       // 过拟合专用数据

/**
 * 数据生成器映射
 */
export const dataGenerators: Record<DatasetType, () => DataPoint[]> = {
  standard: generateStandardData,
  outlier: generateOutlierData,
  noisy: generateNoisyData,
  poisoned: generatePoisonedData,
  sparse: generateSparseData,
  classification: generateClassificationData,
  xor: generateXORData,
  circle: generateCircleData,
  moons: generateMoonsData,
  'poisoned-classification': generatePoisonedClassificationData,
  'extreme-gradient-explosion': generateExtremeGradientExplosionData,
  'extreme-gradient-vanish': generateExtremeGradientVanishData,
  'extreme-overfitting': generateExtremeOverfittingData,
};

/**
 * 获取指定类型的数据集
 */
export function getDataset(type: DatasetType): DataPoint[] {
  const generator = dataGenerators[type];
  if (!generator) {
    console.warn(`Unknown dataset type: ${type}, falling back to standard`);
    return generateStandardData();
  }
  return generator();
}
