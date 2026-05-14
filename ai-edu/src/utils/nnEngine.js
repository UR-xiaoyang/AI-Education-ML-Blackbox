// Neural Network Engine (Lightweight MLP for 2D classification)

// Xavier/Glorot initialization for better gradient flow
function xavierInit(fanIn, fanOut) {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  return Math.random() * 2 * limit - limit;
}

export function initNNModel(hiddenNodes) {
  // W1: [2, hiddenNodes], b1: [hiddenNodes]
  // W2: [hiddenNodes, 1], b2: [1]
  // Using Xavier initialization for better gradient flow
  const W1 = Array(2).fill(0).map(() => Array(hiddenNodes).fill(0).map(() => xavierInit(2, hiddenNodes)));
  const b1 = Array(hiddenNodes).fill(0).map(() => 0.1); // Small positive bias to keep ReLU neurons alive

  const W2 = Array(hiddenNodes).fill(0).map(() => [xavierInit(hiddenNodes, 1)]);
  const b2 = [0];

  return { W1, b1, W2, b2, hiddenNodes };
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function relu(z) {
  return Math.max(0, z);
}

// 激活值裁剪阈值，防止数值爆炸
const RELU_CLIP_MAX = 100;

function reluDerivative(z) {
  return z > 0 ? 1 : 0;
}

// 裁剪后的 ReLU，防止极端值导致数值爆炸
function reluClipped(z) {
  return Math.max(0, Math.min(z, RELU_CLIP_MAX));
}

export function nnPredict(x1, x2, model, useRelu = false) {
  const { W1, b1, W2, b2, hiddenNodes } = model;

  // Layer 1
  let a1 = Array(hiddenNodes).fill(0);
  for (let j = 0; j < hiddenNodes; j++) {
    const z1 = x1 * W1[0][j] + x2 * W1[1][j] + b1[j];
    a1[j] = useRelu ? reluClipped(z1) : z1; // 使用裁剪后的 ReLU 防止数值爆炸
  }

  // Layer 2
  let z2 = b2[0];
  for (let j = 0; j < hiddenNodes; j++) {
    z2 += a1[j] * W2[j][0];
  }

  return sigmoid(z2);
}

export function computeNNLoss(points, model, useRelu = false) {
  if (points.length === 0) return 0;
  let totalLoss = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const yPred = nnPredict(p.x, p.y, model, useRelu);
    const p_clipped = Math.max(Math.min(yPred, 0.99999), 0.00001);
    
    if (p.label === 1) {
      totalLoss -= Math.log(p_clipped);
    } else {
      totalLoss -= Math.log(1 - p_clipped);
    }
  }
  return totalLoss / points.length;
}

export function nnTrainStep(points, model, learningRate, useRelu = false) {
  const { W1, b1, W2, b2, hiddenNodes } = model;
  const N = points.length;
  if (N === 0) return model;

  // Gradients
  let dW1 = Array(2).fill(0).map(() => Array(hiddenNodes).fill(0));
  let db1 = Array(hiddenNodes).fill(0);
  let dW2 = Array(hiddenNodes).fill(0).map(() => [0]);
  let db2 = [0];

  for (let i = 0; i < N; i++) {
    const x1 = points[i].x;
    const x2 = points[i].y;
    const y = points[i].label;

    // Forward pass 记录中间变量
    let z1 = Array(hiddenNodes).fill(0);
    let a1 = Array(hiddenNodes).fill(0);
    for (let j = 0; j < hiddenNodes; j++) {
      z1[j] = x1 * W1[0][j] + x2 * W1[1][j] + b1[j];
      a1[j] = useRelu ? reluClipped(z1[j]) : z1[j]; // 使用裁剪后的 ReLU 防止数值爆炸
    }
    
    let z2 = b2[0];
    for (let j = 0; j < hiddenNodes; j++) {
      z2 += a1[j] * W2[j][0];
    }
    let a2 = sigmoid(z2);

    // Backward pass (Backpropagation)
    let dz2 = a2 - y; // 对于交叉熵 + sigmoid的组合，倒数就是 (A - Y)

    db2[0] += dz2;
    for (let j = 0; j < hiddenNodes; j++) {
      dW2[j][0] += a1[j] * dz2;
    }

    // Layer 1 Error
    let da1 = Array(hiddenNodes).fill(0);
    let dz1 = Array(hiddenNodes).fill(0);
    for (let j = 0; j < hiddenNodes; j++) {
      da1[j] = dz2 * W2[j][0];
      dz1[j] = da1[j] * (useRelu ? reluDerivative(z1[j]) : 1); // 线性激活的导数是1
      
      db1[j] += dz1[j];
      dW1[0][j] += x1 * dz1[j];
      dW1[1][j] += x2 * dz1[j];
    }
  }

  // 检查梯度是否有效
  const hasNaN = dW1.some(row => row.some(v => isNaN(v))) ||
                 db1.some(v => isNaN(v)) ||
                 dW2.some(row => row.some(v => isNaN(v))) ||
                 isNaN(db2[0]);
  if (hasNaN) {
    // 返回原始模型（跳过这次更新），让训练自然停止
    return model;
  }

  // Update Weights
  const newW1 = Array(2).fill(0).map(() => Array(hiddenNodes).fill(0));
  const newb1 = Array(hiddenNodes).fill(0);
  const newW2 = Array(hiddenNodes).fill(0).map(() => [0]);
  const newb2 = [0];

  for (let j = 0; j < hiddenNodes; j++) {
    newW1[0][j] = W1[0][j] - learningRate * (dW1[0][j] / N);
    newW1[1][j] = W1[1][j] - learningRate * (dW1[1][j] / N);
    newb1[j] = b1[j] - learningRate * (db1[j] / N);
    
    newW2[j][0] = W2[j][0] - learningRate * (dW2[j][0] / N);
  }
  newb2[0] = b2[0] - learningRate * (db2[0] / N);

  return { W1: newW1, b1: newb1, W2: newW2, b2: newb2, hiddenNodes };
}
